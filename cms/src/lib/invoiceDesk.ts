import type { Access, Endpoint, PayloadRequest } from 'payload'
import { hasRole } from '../access/roles'
import { audit } from './audit'
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
  client?: { id: number | string; clientName?: string | null; contactName?: string | null; clientEmail?: string | null } | number | string | null
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
      const why = notSendable(inv)
      if (why) return Response.json({ error: why }, { status: 400 })
      const now = new Date()
      const issuing = !inv.issuedAt
      if (issuing) {
        const today = new Date(now)
        today.setUTCHours(0, 0, 0, 0)
        const due = inv.dueDate && Date.parse(inv.dueDate) >= today.getTime() ? inv.dueDate : new Date(now.getTime() + PAY_WITHIN_DAYS * DAY).toISOString()
        inv = (await req.payload.update({
          collection: 'invoices',
          id: inv.id,
          data: { issuedAt: now.toISOString(), dateIssued: now.toISOString(), dueDate: due, draftNote: null } as never,
          depth: 1,
          overrideAccess: true,
          req,
        })) as unknown as Inv
      }
      const client = inv.client && typeof inv.client === 'object' ? inv.client : null
      let emailed = false
      try {
        const mail = invoiceEmail(inv, !issuing)
        await req.payload.sendEmail({ to: client?.clientEmail, subject: mail.subject, html: mail.html, text: mail.text })
        emailed = true
        await req.payload.update({ collection: 'invoices', id: inv.id, data: { lastSentAt: new Date().toISOString() } as never, overrideAccess: true, req })
      } catch (err) {
        req.payload.logger.error({ err, invoice: inv.id }, 'The invoice email failed')
      }
      await audit(req, {
        action: issuing ? 'invoice.issued' : 'invoice.resent',
        summary: `Invoice ${inv.invoiceId} ${issuing ? 'issued' : 'sent again'}${emailed ? ` and emailed to ${client?.clientEmail}` : ', but the email failed'}`,
        subjectType: 'invoices',
        subjectId: inv.id,
      })
      return Response.json({ ok: true, issued: issuing, emailed, to: client?.clientEmail ?? null, link: payLink(inv) })
    },
  },
]
