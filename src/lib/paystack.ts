/**
 * Paystack settlement.
 *
 * The previous verification endpoint took a browser-supplied `documentId`,
 * confirmed only that *some* Paystack transaction had succeeded, then PATCHed
 * the invoice. It never checked the amount, the currency, whether the reference
 * belonged to that invoice, or whether it had already been used — so one
 * genuine 1-cedi reference could clear an invoice of any size, repeatedly. It
 * also wrote status 'Paid' against a lowercase-only enum and never inspected
 * the response, so in practice no invoice was ever marked paid at all.
 *
 * The fix rests on four properties:
 *
 *   1. Invoice identity comes from Paystack's echoed metadata.invoiceId, which
 *      we set server-side at initialise time — never from the request body.
 *   2. The amount and currency are asserted against the invoice's stored
 *      amountMinor. To get invoice X marked paid you must produce a genuinely
 *      successful transaction for X's exact amount, at which point it is paid.
 *   3. `paystackReference` is uniquely indexed, so a reference settles once.
 *   4. The write is checked. A failure after money has moved is the one
 *      outcome that must never be silent.
 */

export type SettleResult = {
  status: number
  body: Record<string, unknown>
}

const PAYSTACK_API = 'https://api.paystack.co'

const ok = (body: Record<string, unknown>): SettleResult => ({ status: 200, body: { ok: true, ...body } })
const err = (status: number, code: string, message: string): SettleResult => ({
  status,
  body: { ok: false, code, error: message },
})

function payloadHeaders(token: string) {
  return { Authorization: `users API-Key ${token}` }
}

/**
 * Settle an invoice from a Paystack reference. Safe to call repeatedly and from
 * more than one caller (browser callback and webhook race on the same
 * reference) — replays return 200 without mutating.
 */
export async function settleInvoice(reference: string): Promise<SettleResult> {
  // 1. Shape check before spending a network call.
  if (!reference || !/^[A-Za-z0-9._-]{6,100}$/.test(reference)) {
    return err(400, 'BAD_REFERENCE', 'Missing or malformed payment reference.')
  }

  // 2. Configuration. A 503 distinguishes "we are misconfigured" from
  //    "your payment is bad", which matters when reading logs at 2am.
  // .trim(): see the note in paystack-init.ts — a newline pasted into the
  // Vercel dashboard makes Paystack reject an otherwise-correct key.
  const secret = import.meta.env.PAYSTACK_SECRET_KEY?.trim()
  const payloadToken = import.meta.env.PAYLOAD_API_KEY?.trim()
  const baseUrl = import.meta.env.PUBLIC_PAYLOAD_URL?.trim().replace(/\/+$/, '')
  if (!secret || !payloadToken || !baseUrl) {
    console.error('[paystack] missing config', {
      secret: !!secret,
      payloadToken: !!payloadToken,
      baseUrl: !!baseUrl,
    })
    return err(503, 'NOT_CONFIGURED', 'Payment verification is not configured.')
  }

  // 3. Ask Paystack. This is the only source of truth for what happened.
  let verify: any
  try {
    const res = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    verify = await res.json()
    if (!res.ok) {
      return err(502, 'PAYSTACK_UNAVAILABLE', verify?.message || 'Could not reach Paystack.')
    }
  } catch (e) {
    console.error('[paystack] verify call failed:', e)
    return err(502, 'PAYSTACK_UNAVAILABLE', 'Could not reach Paystack.')
  }

  if (!verify?.status) {
    return err(400, 'VERIFY_FAILED', verify?.message || 'Payment verification failed.')
  }

  const data = verify.data ?? {}

  // 4. Not successful: report the state, mutate nothing. 402 rather than 400 —
  //    the request was well-formed, the payment just did not complete.
  if (data.status !== 'success') {
    return err(402, 'NOT_SUCCESSFUL', `Payment status is ${data.status}.`)
  }

  // 5. Identity from Paystack's echo of what we set at initialise time.
  const invoiceId = data.metadata?.invoiceId
  if (!invoiceId) {
    console.error('[paystack] successful charge with no metadata.invoiceId:', reference)
    return err(422, 'NO_INVOICE_METADATA', 'This payment is not linked to an invoice.')
  }

  // 6. Load the invoice. skipCache matters: payloadFetch memoises for 60s, and
  //    settling against a stale copy would re-settle an already-paid invoice.
  const query = new URLSearchParams({ 'where[invoiceId][equals]': String(invoiceId), limit: '2' })
  let invoice: any
  try {
    const res = await fetch(`${baseUrl}/api/invoices?${query}`, { headers: payloadHeaders(payloadToken) })
    if (!res.ok) {
      console.error('[paystack] invoice lookup failed:', await res.text())
      return err(502, 'LOOKUP_FAILED', 'Could not load the invoice.')
    }
    const docs = (await res.json())?.docs ?? []
    if (docs.length === 0) return err(404, 'INVOICE_NOT_FOUND', 'Invoice not found.')
    if (docs.length > 1) {
      console.error('[paystack] duplicate invoiceId:', invoiceId)
      return err(409, 'AMBIGUOUS_INVOICE', 'Invoice reference is ambiguous.')
    }
    invoice = docs[0]
  } catch (e) {
    console.error('[paystack] invoice lookup threw:', e)
    return err(502, 'LOOKUP_FAILED', 'Could not load the invoice.')
  }

  // 7. Idempotency. The webhook and the browser callback both land here, and
  //    with deposits an invoice can legitimately have two references — so
  //    "already applied" means "this reference is one we have recorded", not
  //    "the invoice is paid".
  if (invoice.paystackReference === reference || invoice.balanceReference === reference) {
    return ok({ alreadyApplied: true, invoiceId })
  }
  if (String(invoice.status).toLowerCase() === 'paid') {
    // Fully settled already, by some other reference. Refunding is a human
    // decision, so record loudly and still answer 200 so Paystack stops retrying.
    console.error('[paystack] PAYMENT AGAINST A SETTLED INVOICE', {
      invoiceId,
      existing: invoice.paystackReference,
      incoming: reference,
    })
    return ok({ alreadyPaid: true, invoiceId })
  }

  // 8. Amount and currency. This is what makes tampering with metadata
  //    worthless — you would have to actually pay the invoice.
  const expectedMinor = Number(invoice.amountMinor)
  const paidMinor = Number(data.amount)
  const expectedCurrency = String(invoice.currency || 'USD').toUpperCase()
  const paidCurrency = String(data.currency || '').toUpperCase()

  if (!Number.isFinite(expectedMinor) || expectedMinor <= 0) {
    console.error('[paystack] invoice has no usable amountMinor:', invoiceId)
    return err(409, 'NO_EXPECTED_AMOUNT', 'Invoice total is not available for verification.')
  }
  if (paidCurrency !== expectedCurrency) {
    console.error('[paystack] currency mismatch', { invoiceId, paidCurrency, expectedCurrency })
    return err(409, 'CURRENCY_MISMATCH', 'Payment currency does not match the invoice.')
  }

  // 8b. How much was already collected, and therefore what this payment has to
  //     cover. Without a deposit this is the full total, exactly as before.
  //     With one, the first payment may settle the deposit and the second must
  //     clear whatever is left — never less, so a client cannot pay GH₵1 twice
  //     and call the invoice settled.
  const alreadyPaidMinor = Math.max(0, Number(invoice.amountPaidMinor) || 0)
  const outstandingMinor = expectedMinor - alreadyPaidMinor
  const depositMinor = Number(invoice.depositMinor) || 0
  const isFirstPayment = alreadyPaidMinor <= 0
  const depositIsOpen = isFirstPayment && depositMinor > 0 && depositMinor < expectedMinor

  // A first payment may settle the deposit OR the whole invoice; anything after
  // must clear the remaining balance.
  const minimumAcceptable = depositIsOpen ? depositMinor : outstandingMinor

  if (paidMinor < minimumAcceptable) {
    console.error('[paystack] underpayment', {
      invoiceId, paidMinor, minimumAcceptable, expectedMinor, alreadyPaidMinor,
    })
    return err(
      409,
      'AMOUNT_MISMATCH',
      depositIsOpen
        ? 'Payment is less than the deposit due on this invoice.'
        : 'Payment amount does not match the balance outstanding.',
    )
  }

  const newPaidTotalMinor = alreadyPaidMinor + paidMinor
  const fullySettled = newPaidTotalMinor >= expectedMinor

  // 9. Record it, and check that the write landed. The old code PATCHed
  //    status 'Paid' against a lowercase enum and ignored the response, so it
  //    failed silently on every single payment.
  try {
    const res = await fetch(`${baseUrl}/api/invoices/${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...payloadHeaders(payloadToken) },
      body: JSON.stringify({
        // Status only moves to paid once the money actually covers the total.
        // A deposit leaves it pending so the overdue chaser keeps working on
        // the balance.
        ...(fullySettled ? { status: 'paid', paidAt: new Date().toISOString() } : {}),
        amountPaidMinor: newPaidTotalMinor,
        // First reference goes in paystackReference, second in balanceReference.
        // Both are uniquely indexed, so one reference can never settle two
        // invoices, nor the same invoice twice.
        ...(isFirstPayment
          ? { paystackReference: reference, paystackAmountMinor: paidMinor, paystackStatus: data.status }
          : { balanceReference: reference, balanceAmountMinor: paidMinor }),
      }),
    })
    if (!res.ok) {
      console.error('[paystack] SETTLE WRITE FAILED: money taken, invoice not updated', {
        invoiceId,
        reference,
        body: await res.text(),
      })
      return err(
        500,
        'SETTLE_WRITE_FAILED',
        'Your payment went through but we could not update the invoice. Please contact us with your reference.',
      )
    }
  } catch (e) {
    console.error('[paystack] SETTLE WRITE THREW: money taken, invoice not updated', {
      invoiceId,
      reference,
      error: e,
    })
    return err(500, 'SETTLE_WRITE_FAILED', 'Your payment went through but we could not update the invoice.')
  }

  return ok({
    invoiceId,
    reference,
    fullySettled,
    // Callers show "deposit received, balance due" rather than "paid" when this
    // is set, so the client is never told an invoice is closed while it isn't.
    balanceMinor: Math.max(0, expectedMinor - newPaidTotalMinor),
    overpaid: newPaidTotalMinor > expectedMinor,
  })
}
