import type { CollectionAfterChangeHook, PayloadRequest, TaskConfig } from 'payload'
import { adminIds, notify } from './notify'
import { reportProblem } from './problems'

/**
 * Paystack payments become Client Payments (spec 4.5, test 13).
 *
 * The website's Paystack flow raises an invoice's `amountPaidMinor`. That save
 * must never fail on our account: if it did, the client would have paid and
 * the invoice would not say so. So the invoice's hook only drops a job in the
 * queue, on its own connection, outside the payment's transaction, and never
 * throws. A few minutes later the job compares what the invoice says was paid
 * with the payments already recorded against it, and records the difference.
 * It is safe to run twice: the second time there is no difference.
 */

export const queueInvoicePayment: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req, context }) => {
  if (operation !== 'update' || context?.fromClientPayment) return doc
  if ((Number(doc.amountPaidMinor) || 0) <= (Number(previousDoc?.amountPaidMinor) || 0)) return doc
  try {
    await req.payload.jobs.queue({ task: 'recordInvoicePayment', input: { invoiceId: String(doc.id) } })
  } catch (err) {
    await reportProblem(req, `payment-queue:${doc.id}`, `A payment on invoice ${doc.invoiceId || doc.id} was not recorded as a client payment. Record it by hand in Payments.`, err)
  }
  return doc
}

export async function recordInvoicePayment(req: PayloadRequest, invoiceId: number) {
  const invoice = await req.payload.findByID({ collection: 'invoices', id: invoiceId, depth: 0, overrideAccess: true, req }).catch(() => null)
  if (!invoice) return 'no invoice'
  const recorded = await req.payload.find({
    collection: 'client-payments',
    where: { and: [{ invoice: { equals: invoiceId } }, { amountMinor: { greater_than: 0 } }] },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const sum = recorded.docs.reduce((n, p) => n + Number(p.amountMinor || 0), 0)
  const missing = (Number(invoice.amountPaidMinor) || 0) - sum
  if (missing <= 0) return 'nothing to record'

  const refs = [invoice.paystackReference, invoice.balanceReference].filter(Boolean) as string[]
  const used = new Set(recorded.docs.map((p) => p.reference))
  const reference = refs.find((r) => !used.has(r)) ?? null
  try {
    await req.payload.create({
      collection: 'client-payments',
      data: {
        invoice: invoiceId,
        method: reference ? 'paystack' : 'bank',
        reference,
        currency: invoice.currency,
        amountMinor: missing,
        clearedAt: invoice.paidAt || new Date().toISOString(),
        notes: reference ? 'Recorded automatically from the Paystack payment.' : 'Recorded automatically from the invoice’s amount paid.',
      } as never,
      context: { fromInvoice: true },
      overrideAccess: true,
      req,
    })
    return 'recorded'
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err)
    await notify(req, {
      to: await adminIds(req),
      kind: 'payment-unrecorded',
      title: `A payment on invoice ${invoice.invoiceId} needs recording by hand`,
      body: `${invoice.currency} ${(missing / 100).toLocaleString('en-GB')} was paid, but it could not be recorded as a client payment: ${why}`,
      link: '/payments',
      key: `payment-unrecorded:${invoiceId}:${invoice.amountPaidMinor}`,
    })
    return 'failed'
  }
}

export const recordInvoicePaymentTask: TaskConfig<any> = {
  slug: 'recordInvoicePayment',
  retries: 2,
  inputSchema: [{ name: 'invoiceId', type: 'text', required: true }],
  outputSchema: [{ name: 'result', type: 'text' }],
  handler: async ({ input, req }) => ({ output: { result: await recordInvoicePayment(req, Number(input.invoiceId)) } }),
}
