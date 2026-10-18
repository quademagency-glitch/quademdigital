import { randomBytes } from 'node:crypto'
import type { Access, Endpoint, PayloadRequest } from 'payload'
import { hasRole } from '../access/roles'
import { audit } from './audit'
import { correction } from './invoiceCorrection'
import { currentDeal, draftInvoice, fmt, PAY_WITHIN_DAYS, type DraftClient, type DraftDeal, type DraftInvoice } from './invoiceDraft'
import { button, escape, firstName, layout } from './teamEmails'

/**
 * Invoices from the founder portal: a draft filled in from what was agreed
 * (lib/invoiceDraft.ts), checked and corrected, then sent.
 *
 * An invoice is a draft until it is sent, and only Ernest sees a draft: the
 * website's account reads issued invoices only, so a draft never appears on
 * the client's portal, cannot be opened or paid by its link, and is never
 * chased by the overdue reminders. Sending issues it and emails the client
 * the link to view and pay it.
 */

export const SITE = 'https://quademdigital.com'
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DAY = 86_400_000

/** Ernest reads and changes every invoice; the website only issued ones. */
export const invoiceAccess: Access = ({ req: { user } }) => {
  if (hasRole(user, 'admin')) return true
  if (hasRole(user, 'site')) return { issuedAt: { exists: true } }
  return false
}

export const payLink = (inv: { invoiceId?: string | null; accessToken?: string | null }) =>
  `${SITE}/invoice/${encodeURIComponent(String(inv.invoiceId ?? ''))}/?t=${encodeURIComponent(String(inv.accessToken ?? ''))}`

const day = (iso?: string | null) => (iso ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Accra' }).format(new Date(iso)) : '')

type Inv = {
  id: number | string
  invoiceId?: string | null
  accessToken?: string | null
  currency?: string | null
  amountMinor?: number | null
  depositMinor?: number | null
  depositPercent?: number | null
  amountPaidMinor?: number | null
  dueDate?: string | null
  issuedAt?: string | null
  items?: { description?: string | null; quantity?: number | null; rate?: number | null }[] | null
  client?: { id: number | string; clientName?: string | null; contactName?: string | null; clientEmail?: string | null; phone?: string | null } | number | string | null
}

/*
  What happened to an invoice once it left (collections/InvoiceEvents.ts,
  18 October 2026): every send is written down, and its email carries tags so
  Resend's "delivered", "opened" and "bounced" come back to it through the
  website's webhook.
*/
type EventKind = 'issued' | 'emailed' | 'resent' | 'reminder' | 'whatsapp' | 'failed' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'viewed'
export async function invoiceEvent(req: PayloadRequest, invoice: number | string, kind: EventKind, data: { at?: string; to?: string | null; sendId?: string | null; pdf?: boolean; note?: string | null } = {}) {
  await req.payload.create({
    collection: 'invoice-events',
    data: { invoice: Number(invoice), kind, at: data.at ?? new Date().toISOString(), to: data.to ?? null, sendId: data.sendId ?? null, pdf: Boolean(data.pdf), note: data.note ?? null } as never,
    overrideAccess: true,
    req,
  })
}
export const newSendId = () => randomBytes(9).toString('hex')

/** The website's own calls (its webhook, the client's invoice page, the reminders): the secret the two share. */
const fromWebsite = (req: PayloadRequest) => {
  const secret = process.env.CMS_WEBHOOK_SECRET
  return Boolean(secret) && req.headers.get('x-quadem-secret') === secret
}

/** The invoice on WhatsApp: the same few lines as the email, for Ernest to send from his own WhatsApp. */
export function invoiceWhatsApp(inv: Inv) {
  const client = inv.client && typeof inv.client === 'object' ? inv.client : null
  const phone = String(client?.phone ?? '').replace(/\D/g, '')
  const first = firstName(client?.contactName || client?.clientName)
  const currency = String(inv.currency || 'GHS').toUpperCase()
  const owed = Math.max(0, (Number(inv.amountMinor) || 0) - Math.max(0, Number(inv.amountPaidMinor) || 0))
  const what = (inv.items ?? []).map((i) => String(i?.description ?? '').trim()).filter(Boolean)
  const text = [
    `${first ? `Hello ${first}` : 'Hello'}, here is invoice ${inv.invoiceId} from Quadem Digital${what.length ? ` for ${what.slice(0, 3).join(', ')}${what.length > 3 ? ' and more' : ''}` : ''}.`,
    `${Number(inv.amountPaidMinor) > 0 ? 'Left to pay' : 'Amount due'}: ${fmt(owed, currency)}${inv.dueDate ? `, by ${day(inv.dueDate)}` : ''}.`,
    `View and pay it here: ${payLink(inv)}`,
  ].join('\n')
  return { phone: phone.length >= 8 ? phone : null, text, link: phone.length >= 8 ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : null }
}

/** Issue a draft: its date, and a due date not in the past. Returns the issued invoice; one already issued as it is. */
async function issue(req: PayloadRequest, inv: Inv): Promise<{ inv: Inv; issued: boolean }> {
  if (inv.issuedAt) return { inv, issued: false }
  const now = new Date()
  const today = new Date(now)
  today.setUTCHours(0, 0, 0, 0)
  const due = inv.dueDate && Date.parse(inv.dueDate) >= today.getTime() ? inv.dueDate : new Date(now.getTime() + PAY_WITHIN_DAYS * DAY).toISOString()
  const done = (await req.payload.update({
    collection: 'invoices',
    id: inv.id,
    data: { issuedAt: now.toISOString(), dateIssued: now.toISOString(), dueDate: due, draftNote: null } as never,
    depth: 1,
    overrideAccess: true,
    req,
  })) as unknown as Inv
  await invoiceEvent(req, inv.id, 'issued')
  return { inv: done, issued: true }
}

/** A PDF the portal sends to go with the email: base64, a real PDF, at most 3 MB. */
function pdfFrom(b64: unknown): Buffer | null {
  if (typeof b64 !== 'string' || !b64) return null
  const bytes = Buffer.from(b64, 'base64')
  return bytes.length > 0 && bytes.length <= 3 * 1024 * 1024 && bytes.subarray(0, 5).toString('latin1') === '%PDF-' ? bytes : null
}

/** The email that carries an invoice to the client. */
export function invoiceEmail(inv: Inv, again = false) {
  const client = inv.client && typeof inv.client === 'object' ? inv.client : null
  const first = firstName(client?.contactName || client?.clientName)
  const currency = String(inv.currency || 'GHS').toUpperCase()
  const total = Number(inv.amountMinor) || 0
  const paid = Math.max(0, Number(inv.amountPaidMinor) || 0)
  const owed = Math.max(0, total - paid)
  const deposit = paid <= 0 && Number(inv.depositMinor) > 0 && Number(inv.depositMinor) < total ? Number(inv.depositMinor) : 0
  const link = payLink(inv)
  const what = (inv.items ?? []).map((i) => String(i?.description ?? '').trim()).filter(Boolean)
  const lines = [
    `<p style="margin:0 0 12px">${first ? `Hello ${escape(first)},` : 'Hello,'}</p>`,
    `<p style="margin:0 0 12px">${again ? 'Here again is' : 'Here is'} invoice <strong>${escape(String(inv.invoiceId))}</strong> from Quadem Digital${what.length ? ` for ${escape(what.slice(0, 3).join(', '))}${what.length > 3 ? ' and more' : ''}` : ''}.</p>`,
    `<p style="margin:16px 0 4px;color:#5b6474;font-size:14px">${paid > 0 ? 'Left to pay' : 'Amount due'}</p>`,
    `<p style="margin:0;font-size:24px;font-weight:800">${escape(fmt(owed, currency))}</p>`,
    deposit ? `<p style="margin:6px 0 0;color:#5b6474;font-size:14px">A ${escape(String(inv.depositPercent))}% deposit of ${escape(fmt(deposit, currency))} is enough to start.</p>` : '',
    inv.dueDate ? `<p style="margin:6px 0 0;color:#5b6474;font-size:14px">Due by ${escape(day(inv.dueDate))}</p>` : '',
    button(link, 'View and pay the invoice'),
    `<p style="margin:24px 0 0">You can pay online, or by bank transfer to the account shown on the invoice. Reply to this email with any questions.</p>`,
  ]
  const text = [
    first ? `Hello ${first},` : 'Hello,',
    '',
    `${again ? 'Here again is' : 'Here is'} invoice ${inv.invoiceId} from Quadem Digital${what.length ? ` for ${what.slice(0, 3).join(', ')}${what.length > 3 ? ' and more' : ''}` : ''}.`,
    '',
    `${paid > 0 ? 'Left to pay' : 'Amount due'}: ${fmt(owed, currency)}`,
    deposit ? `A ${inv.depositPercent}% deposit of ${fmt(deposit, currency)} is enough to start.` : '',
    inv.dueDate ? `Due by ${day(inv.dueDate)}` : '',
    '',
    `View and pay the invoice: ${link}`,
    '',
    'You can pay online, or by bank transfer to the account shown on the invoice. Reply to this email with any questions.',
    '',
    'Quadem Digital',
  ]
  return { subject: `Invoice ${inv.invoiceId} from Quadem Digital`, html: layout(lines.filter(Boolean).join('\n')), text: text.filter((l, i, a) => l || a[i - 1]).join('\n') }
}

/** Why an invoice cannot be sent yet, in words; null when it can. */
export function notSendable(inv: Inv): string | null {
  const client = inv.client && typeof inv.client === 'object' ? inv.client : null
  if (!EMAIL_OK.test(client?.clientEmail ?? '')) return 'Add the client’s email address first: the invoice goes to it.'
  const items = inv.items ?? []
  if (!items.length) return 'Add at least one line.'
  if (items.some((i) => !String(i?.description ?? '').trim())) return 'Every line needs a description.'
  if (!(Number(inv.amountMinor) > 0)) return 'The total is nothing. Put a price on the lines first.'
  if (!inv.accessToken) return 'This invoice has no link yet. Save it once, then send.'
  return null
}

const denied = (req: PayloadRequest) => (hasRole(req.user, 'admin') ? null : Response.json({ error: 'Only the founder can do this.' }, { status: req.user ? 403 : 401 }))

async function body(req: PayloadRequest): Promise<Record<string, unknown>> {
  try {
    return ((await req.json?.()) ?? {}) as Record<string, unknown>
  } catch {
    return {}
  }
}

export const invoiceDeskEndpoints: Endpoint[] = [
  {
    // A draft for a client, filled in from their deal, their record or their last invoice.
    path: '/draft',
    method: 'post',
    handler: async (req) => {
      const no = denied(req)
      if (no) return no
      const { client: clientId, deal: dealId } = await body(req)
      if (!/^\d+$/.test(String(clientId ?? ''))) return Response.json({ error: 'Choose the client.' }, { status: 400 })
      const client = await req.payload.findByID({ collection: 'clients', id: Number(clientId), depth: 0, overrideAccess: true, req, disableErrors: true })
      if (!client) return Response.json({ error: 'That client is not there.' }, { status: 404 })
      const [deals, previous] = await Promise.all([
        req.payload.find({ collection: 'proposals', where: { client: { equals: client.id } }, depth: 0, limit: 50, overrideAccess: true, req }),
        req.payload.find({ collection: 'invoices', where: { client: { equals: client.id } }, sort: '-createdAt', depth: 0, limit: 200, overrideAccess: true, req }),
      ])
      const chosen = dealId ? (deals.docs.find((d) => String(d.id) === String(dealId)) ?? null) : null
      if (dealId && !chosen) return Response.json({ error: 'That deal is not this client’s.' }, { status: 400 })
      const deal = (chosen ?? currentDeal(deals.docs as unknown as DraftDeal[])) as DraftDeal | null
      const draft = draftInvoice({ client: client as unknown as DraftClient, deal, previous: previous.docs as unknown as DraftInvoice[] })
      const doc = await req.payload.create({
        collection: 'invoices',
        data: { client: client.id, status: 'pending', draftNote: draft.from, ...draft.data } as never,
        overrideAccess: true,
        req,
      })
      await audit(req, { action: 'invoice.drafted', summary: `Invoice ${doc.invoiceId} drafted for ${client.clientName ?? `client ${client.id}`}`, subjectType: 'invoices', subjectId: doc.id })
      return Response.json({ ok: true, doc, from: draft.from }, { status: 201 })
    },
  },
  {
    // Issue a draft and email it, or email an issued invoice again.
    path: '/:id/send',
    method: 'post',
    handler: async (req) => {
      const no = denied(req)
      if (no) return no
      const id = (req.routeParams as { id?: string } | undefined)?.id
      if (!id || !/^\d+$/.test(id)) return Response.json({ error: 'That invoice is not there.' }, { status: 404 })
      let inv = (await req.payload.findByID({ collection: 'invoices', id: Number(id), depth: 1, overrideAccess: true, req, disableErrors: true })) as unknown as Inv | null
      if (!inv) return Response.json({ error: 'That invoice is not there.' }, { status: 404 })
      // How Ernest chose to send it (18 October 2026): by email unless he says not, with the PDF when the portal sends one.
      // Read once: a request's body can only be read once.
      const choice = await body(req)
      const byEmail = choice.email !== false
      const why = notSendable(inv)
      // An invoice issued to share on WhatsApp only needs no email address.
      if (why && !(!byEmail && why.startsWith('Add the client’s email'))) return Response.json({ error: why }, { status: 400 })
      const issued = await issue(req, inv)
      inv = issued.inv
      // The first email, even when the portal issued it a moment before to make its PDF (/:id/issue).
      const issuing = issued.issued || choice.first === true
      const client = inv.client && typeof inv.client === 'object' ? inv.client : null
      const pdf = pdfFrom(choice.pdf)
      let emailed = false
      const sendId = newSendId()
      if (byEmail) {
        try {
          const mail = invoiceEmail(inv, !issuing)
          await req.payload.sendEmail({
            to: client?.clientEmail,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
            ...(pdf ? { attachments: [{ filename: `Invoice-${String(inv.invoiceId).replace(/[^\w-]/g, '')}.pdf`, content: pdf, contentType: 'application/pdf' }] } : {}),
            tags: { invoice_id: String(inv.id), send_id: sendId },
          } as never)
          emailed = true
          await req.payload.update({ collection: 'invoices', id: inv.id, data: { lastSentAt: new Date().toISOString() } as never, overrideAccess: true, req })
          await invoiceEvent(req, inv.id, issuing ? 'emailed' : 'resent', { to: client?.clientEmail, sendId, pdf: Boolean(pdf) })
        } catch (err) {
          req.payload.logger.error({ err, invoice: inv.id }, 'The invoice email failed')
          await invoiceEvent(req, inv.id, 'failed', { to: client?.clientEmail, sendId, note: 'The email could not be sent.' })
        }
      }
      await audit(req, {
        action: issued.issued ? 'invoice.issued' : issuing ? 'invoice.emailed' : 'invoice.resent',
        summary: `Invoice ${inv.invoiceId} ${issued.issued ? 'issued' : issuing ? 'sent' : 'sent again'}${!byEmail ? ', not emailed' : emailed ? ` and emailed to ${client?.clientEmail}${pdf ? ' with its PDF' : ''}` : ', but the email failed'}`,
        subjectType: 'invoices',
        subjectId: inv.id,
      })
      return Response.json({ ok: true, issued: issuing, emailed, byEmail, pdf: Boolean(pdf && emailed), to: client?.clientEmail ?? null, link: payLink(inv), whatsapp: invoiceWhatsApp(inv) })
    },
  },
  {
    /*
      Correct an issued invoice, money in or not (lib/invoiceCorrection.ts).
      The whole record goes back with only the lines, tax, due date, status and
      paidAt changed, because an update re-fills a field it is not given from
      its default. The invoiceCorrection flag lets it past the lock on amounts
      in collections/Invoices.ts and keeps the deposit the client was shown.
    */
    path: '/:id/correct',
    method: 'post',
    handler: async (req) => {
      const no = denied(req)
      if (no) return no
      const id = (req.routeParams as { id?: string } | undefined)?.id
      if (!id || !/^\d+$/.test(id)) return Response.json({ error: 'That invoice is not there.' }, { status: 404 })
      const inv = (await req.payload.findByID({ collection: 'invoices', id: Number(id), depth: 0, overrideAccess: true, req, disableErrors: true })) as unknown as
        | (Inv & { status?: string | null; paidAt?: string | null; createdAt?: string; updatedAt?: string })
        | null
      if (!inv) return Response.json({ error: 'That invoice is not there.' }, { status: 404 })
      const b = await body(req)
      const currency = String(inv.currency || 'GHS').toUpperCase()
      const money = (minor: number) => fmt(minor, currency)
      const c = correction({ invoice: inv, items: b.items, taxRate: b.taxRate, dueDate: b.dueDate || inv.dueDate, reason: b.reason, fmt: money })
      if ('error' in c) return Response.json({ error: c.error }, { status: 400 })
      const { id: _id, createdAt: _c, updatedAt: _u, ...whole } = inv
      const saved = (await req.payload.update({
        collection: 'invoices',
        id: inv.id,
        data: { ...whole, items: c.items, taxRate: c.taxRate, dueDate: c.dueDate, status: c.status, paidAt: c.paidAt } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: { invoiceCorrection: true },
      })) as unknown as Inv & { status?: string | null }
      const before = Number(inv.amountMinor) || 0
      const after = Number(saved.amountMinor) || 0
      await audit(req, {
        action: 'invoice.corrected',
        summary: `Invoice ${inv.invoiceId} corrected${before === after ? ', total unchanged at ' + money(after) : ` from ${money(before)} to ${money(after)}`}. Why: ${c.reason}`,
        subjectType: 'invoices',
        subjectId: inv.id,
      })
      return Response.json({ ok: true, amountMinor: after, status: saved.status, owedMinor: Math.max(0, after - (Number(saved.amountPaidMinor) || 0)) })
    },
  },
  {
    /*
      Issue a draft without emailing it: so the portal can make its PDF from
      the issued invoice before sending it (it must not say draft), or share
      it on WhatsApp only. Issuing again does nothing.
    */
    path: '/:id/issue',
    method: 'post',
    handler: async (req) => {
      const no = denied(req)
      if (no) return no
      const id = (req.routeParams as { id?: string } | undefined)?.id
      const inv = id && /^\d+$/.test(id) ? ((await req.payload.findByID({ collection: 'invoices', id: Number(id), depth: 1, overrideAccess: true, req, disableErrors: true })) as unknown as Inv | null) : null
      if (!inv) return Response.json({ error: 'That invoice is not there.' }, { status: 404 })
      const why = notSendable(inv)
      if (why && !why.startsWith('Add the client’s email')) return Response.json({ error: why }, { status: 400 })
      const r = await issue(req, inv)
      if (r.issued) await audit(req, { action: 'invoice.issued', summary: `Invoice ${inv.invoiceId} issued`, subjectType: 'invoices', subjectId: inv.id })
      return Response.json({ ok: true, issued: r.issued, link: payLink(r.inv), whatsapp: invoiceWhatsApp(r.inv) })
    },
  },
  {
    // Exactly what the client gets, before it goes: the email, and the WhatsApp message.
    path: '/:id/email-preview',
    method: 'get',
    handler: async (req) => {
      const no = denied(req)
      if (no) return no
      const id = (req.routeParams as { id?: string } | undefined)?.id
      const inv = id && /^\d+$/.test(id) ? ((await req.payload.findByID({ collection: 'invoices', id: Number(id), depth: 1, overrideAccess: true, req, disableErrors: true })) as unknown as Inv | null) : null
      if (!inv) return Response.json({ error: 'That invoice is not there.' }, { status: 404 })
      const client = inv.client && typeof inv.client === 'object' ? inv.client : null
      const mail = invoiceEmail(inv, Boolean(inv.issuedAt))
      return Response.json({ to: client?.clientEmail ?? null, subject: mail.subject, html: mail.html, text: mail.text, whatsapp: invoiceWhatsApp(inv) })
    },
  },
  {
    // Ernest opened WhatsApp to share it: written down, though only he sees whether he pressed send.
    path: '/:id/whatsapp',
    method: 'post',
    handler: async (req) => {
      const no = denied(req)
      if (no) return no
      const id = (req.routeParams as { id?: string } | undefined)?.id
      const inv = id && /^\d+$/.test(id) ? ((await req.payload.findByID({ collection: 'invoices', id: Number(id), depth: 1, overrideAccess: true, req, disableErrors: true })) as unknown as Inv | null) : null
      if (!inv) return Response.json({ error: 'That invoice is not there.' }, { status: 404 })
      if (!inv.issuedAt) return Response.json({ error: 'Send it first: a draft has no link the client can open.' }, { status: 400 })
      const wa = invoiceWhatsApp(inv)
      await invoiceEvent(req, inv.id, 'whatsapp', { to: wa.phone ? `+${wa.phone}` : null })
      return Response.json({ ok: true })
    },
  },
  {
    /*
      Resend's news about an invoice email, passed on by the website's webhook
      (src/pages/api/resend-webhook.ts) from the tags the email carried. Each is
      kept once: Resend sends an event again when it is not sure it arrived.
    */
    path: '/delivery-event',
    method: 'post',
    handler: async (req) => {
      if (!fromWebsite(req)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
      const b = await body(req)
      const kinds: Record<string, EventKind> = { delivered: 'delivered', opened: 'opened', clicked: 'clicked', bounced: 'bounced', complained: 'complained' }
      const kind = kinds[String(b.event)]
      const invoice = Number(b.invoiceId)
      const sendId = String(b.sendId ?? '').slice(0, 64)
      if (!kind || !Number.isInteger(invoice) || !sendId) return Response.json({ error: 'Not an invoice email event.' }, { status: 400 })
      const known = await req.payload.find({ collection: 'invoice-events', where: { and: [{ invoice: { equals: invoice } }, { sendId: { equals: sendId } }] }, limit: 50, depth: 0, overrideAccess: true, req })
      if (!known.docs.length) return Response.json({ ok: true, known: false })
      if (!known.docs.some((d) => (d as { kind?: string }).kind === kind)) {
        const at = Number.isFinite(Date.parse(String(b.at))) ? new Date(String(b.at)).toISOString() : new Date().toISOString()
        await invoiceEvent(req, invoice, kind, { at, to: (known.docs[0] as { to?: string }).to ?? null, sendId })
      }
      return Response.json({ ok: true, known: true })
    },
  },
  {
    /*
      The client opened their invoice (src/pages/invoice/[id].astro), counted
      once in half an hour, so a reload or a link checker is not ten visits.
      The token proves it is their link, not someone guessing ids.
    */
    path: '/link-opened',
    method: 'post',
    handler: async (req) => {
      if (!fromWebsite(req)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
      const b = await body(req)
      const found = await req.payload.find({ collection: 'invoices', where: { invoiceId: { equals: String(b.invoiceId ?? '') } }, limit: 1, depth: 0, overrideAccess: true, req })
      const inv = found.docs[0] as unknown as Inv | undefined
      if (!inv || !inv.accessToken || String(b.token ?? '') !== inv.accessToken || !inv.issuedAt) return Response.json({ ok: true, counted: false })
      const recent = await req.payload.find({ collection: 'invoice-events', where: { and: [{ invoice: { equals: inv.id } }, { kind: { equals: 'viewed' } }, { at: { greater_than: new Date(Date.now() - 30 * 60_000).toISOString() } }] }, limit: 1, depth: 0, overrideAccess: true, req })
      if (recent.docs.length) return Response.json({ ok: true, counted: false })
      await invoiceEvent(req, inv.id, 'viewed')
      return Response.json({ ok: true, counted: true })
    },
  },
  {
    // A reminder the website's daily job sent (src/pages/api/cron/chase-invoices.ts), with the tags its email carried.
    path: '/:id/reminder-sent',
    method: 'post',
    handler: async (req) => {
      if (!fromWebsite(req)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
      const id = (req.routeParams as { id?: string } | undefined)?.id
      if (!id || !/^\d+$/.test(id)) return Response.json({ error: 'That invoice is not there.' }, { status: 404 })
      const b = await body(req)
      await invoiceEvent(req, Number(id), 'reminder', { to: String(b.to ?? '').slice(0, 200) || null, sendId: String(b.sendId ?? '').slice(0, 64) || null, note: String(b.note ?? '').slice(0, 200) || null })
      return Response.json({ ok: true })
    },
  },
]
