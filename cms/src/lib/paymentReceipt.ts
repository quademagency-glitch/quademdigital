import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Endpoint, Payload, PayloadRequest, TaskConfig } from 'payload'
import { hasRole } from '../access/roles'
import { SERVICE_OPTIONS } from '../collections/JourneyTemplates'
import { audit } from './audit'
import { payLink } from './invoiceDesk'
import { refId } from './moneyContext'
import { adminIds, notify } from './notify'

/*
  A receipt for every payment a client makes (Ernest, 14 October 2026: "when
  a client payment is entered, the client should receive a receipt for the
  payment with the balance being stated"). Every way money comes in ends as
  a client payment: entered by hand, paid on Paystack, or added on an
  invoice (lib/invoicePayments.ts). Each new one queues this, so the receipt
  goes within five minutes, after the invoice has counted the money. A
  refund gets a refund confirmation instead (his choice), with no balance:
  a refund leaves the invoice as it was. Every one is copied, unseen, to
  Ernest. The PDF is pdf-lib's own Helvetica (the CMS has no font kit), so
  amounts read "GHS 6,000.00", never the cedi sign it cannot draw.
*/

export const RECEIPT_COPY_TO = process.env.RECEIPT_COPY_TO || 'ernest@quademdigital.com'
const FROM = 'Ernest at Quadem Digital <ernest@quademdigital.com>'

const METHOD: Record<string, string> = { paystack: 'Card or mobile money (Paystack)', bank: 'Bank transfer', grey: 'Grey', 'mobile-money': 'Mobile money', cash: 'Cash' }
const SERVICE: Record<string, string> = Object.fromEntries(SERVICE_OPTIONS.map((o: { label: string; value: string }) => [o.value, o.label]))

export const receiptNumber = (p: { id: number | string; clearedAt?: string | null }) =>
  `QD-R-${String(p.clearedAt || new Date().toISOString()).slice(0, 4)}-${String(p.id).padStart(4, '0')}`

export const money = (minor: number, currency: string) =>
  `${currency} ${(minor / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const day = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Accra' }).format(new Date(iso)) : ''

/** What the client still owes, as the receipt states it. */
export type Balance =
  | { kind: 'invoice'; label: string; currency: string; totalMinor: number; paidMinor: number; balanceMinor: number; link: string | null }
  | { kind: 'deal'; label: string; currency: string; totalMinor: number; paidMinor: number; balanceMinor: number }
  | { kind: 'account'; currency: string; balanceMinor: number; invoices: number }
  | { kind: 'refund' }

type Doc = Record<string, any>

/**
 * The balance a receipt states, in this order: the invoice it paid (its total,
 * what has come in on it, what is left); else a one-off deal (its agreed total
 * less every payment and refund on it); else whatever is still open on the
 * client's issued invoices in that currency.
 */
export async function balanceFor(payload: Payload, payment: Doc): Promise<Balance> {
  if (Number(payment.amountMinor) < 0) return { kind: 'refund' }
  const invoice = refId(payment.invoice) ? await payload.findByID({ collection: 'invoices', id: refId(payment.invoice)!, depth: 0, overrideAccess: true }).catch(() => null) : null
  if (invoice) {
    const totalMinor = Number(invoice.amountMinor) || 0
    const paidMinor = Number(invoice.amountPaidMinor) || 0
    const balanceMinor = Math.max(0, totalMinor - paidMinor)
    return { kind: 'invoice', label: `Invoice ${invoice.invoiceId}`, currency: String(invoice.currency || payment.currency).toUpperCase(), totalMinor, paidMinor, balanceMinor, link: balanceMinor > 0 && invoice.accessToken ? payLink(invoice) : null }
  }
  const deal = refId(payment.deal) ? await payload.findByID({ collection: 'proposals', id: refId(payment.deal)!, depth: 0, overrideAccess: true }).catch(() => null) : null
  if (deal && !deal.recurring && Number(deal.total) > 0 && String(deal.currency || payment.currency).toUpperCase() === payment.currency) {
    const payments = await payload.find({ collection: 'client-payments', where: { and: [{ deal: { equals: deal.id } }, { currency: { equals: payment.currency } }] }, limit: 1000, depth: 0, overrideAccess: true, pagination: false })
    const paidMinor = payments.docs.reduce((n, p: Doc) => n + (Number(p.amountMinor) || 0), 0)
    const totalMinor = Math.round(Number(deal.total) * 100)
    return { kind: 'deal', label: SERVICE[String(deal.service)] || 'Your project', currency: payment.currency, totalMinor, paidMinor, balanceMinor: Math.max(0, totalMinor - paidMinor) }
  }
  const client = refId(payment.client)
  const open = client
    ? await payload.find({ collection: 'invoices', where: { and: [{ client: { equals: client } }, { currency: { equals: payment.currency } }, { issuedAt: { exists: true } }, { status: { not_in: ['paid', 'cancelled', 'draft'] } }] }, limit: 500, depth: 0, overrideAccess: true, pagination: false })
    : { docs: [] as Doc[] }
  const owed = open.docs.map((i: Doc) => Math.max(0, (Number(i.amountMinor) || 0) - (Number(i.amountPaidMinor) || 0))).filter((n) => n > 0)
  return { kind: 'account', currency: payment.currency, balanceMinor: owed.reduce((a, b) => a + b, 0), invoices: owed.length }
}

/** What the payment was for, in a few words. */
async function forWhat(payload: Payload, payment: Doc): Promise<string> {
  const invoice = refId(payment.invoice) ? await payload.findByID({ collection: 'invoices', id: refId(payment.invoice)!, depth: 0, overrideAccess: true }).catch(() => null) : null
  if (invoice) {
    const items = (invoice.items ?? []).map((i: Doc) => String(i.description || '').trim()).filter(Boolean)
    return [`Invoice ${invoice.invoiceId}`, items.slice(0, 2).join(', ') + (items.length > 2 ? ` and ${items.length - 2} more` : '')].filter(Boolean).join(': ')
  }
  const deal = refId(payment.deal) ? await payload.findByID({ collection: 'proposals', id: refId(payment.deal)!, depth: 0, overrideAccess: true }).catch(() => null) : null
  if (deal) return `${SERVICE[String(deal.service)] || 'Your project'}${deal.recurring ? ', month ' + (payment.retainerMonth || 1) : ''}`
  return 'Your account with Quadem Digital'
}

/** The lines of the balance, as both the email and the PDF give them. */
export function balanceLines(b: Balance): { headline: string; detail: string | null } {
  if (b.kind === 'refund') return { headline: '', detail: null }
  if (b.kind === 'account') {
    return b.balanceMinor > 0
      ? { headline: `Still owed: ${money(b.balanceMinor, b.currency)}`, detail: `Across ${b.invoices} open invoice${b.invoices === 1 ? '' : 's'}.` }
      : { headline: 'You owe nothing more right now.', detail: null }
  }
  const detail = `${b.kind === 'invoice' ? 'Invoice total' : 'Agreed fee'} ${money(b.totalMinor, b.currency)}, paid so far ${money(b.paidMinor, b.currency)}.`
  return b.balanceMinor > 0
    ? { headline: `Balance on ${b.kind === 'invoice' ? b.label : 'your project'}: ${money(b.balanceMinor, b.currency)}`, detail }
    : { headline: `${b.kind === 'invoice' ? b.label : 'Your project'} is now paid in full.`, detail }
}

// ── The PDF ──

/** Only what the standard PDF fonts can draw: accents dropped, anything else a question mark. */
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')
export function pdfSafe(text: unknown) {
  return [...String(text ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '')]
    .map((ch) => (ch === '\n' ? ' ' : (ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) <= 0x7e) || (ch.charCodeAt(0) >= 0xa0 && ch.charCodeAt(0) <= 0xff) || WIN_ANSI_EXTRA.has(ch) ? ch : '?'))
    .join('')
}

const NAVY = rgb(13 / 255, 27 / 255, 110 / 255)
const BLUE = rgb(0, 180 / 255, 216 / 255)
const INK = rgb(0.1, 0.1, 0.12)
const MUTED = rgb(0.38, 0.4, 0.45)

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = pdfSafe(text).split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line)
      line = w
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

export type ReceiptData = {
  number: string
  refund: boolean
  corrected: boolean
  clientName: string
  contactName: string
  amount: string
  date: string
  method: string
  reference: string | null
  forWhat: string
  balance: Balance
  issuer: { name: string; address: string | null; email: string | null; phone: string | null }
}

export async function receiptPdf(r: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`${r.refund ? 'Refund' : 'Receipt'} ${r.number}`)
  pdf.setAuthor('Quadem Digital Enterprise')
  const page: PDFPage = pdf.addPage([595.28, 841.89])
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const left = 56
  const right = 595.28 - 56
  let y = 841.89 - 64
  const text = (t: string, x: number, size: number, font = regular, color = INK) => page.drawText(pdfSafe(t), { x, y, size, font, color })

  // The Quadem logo, cropped to the mark and its words (cms/public/logo-receipt.png, from logo.png).
  try {
    const logo = await pdf.embedPng(await readFile(path.join(process.cwd(), 'public', 'logo-receipt.png')))
    const w = 118
    const h = (w * logo.height) / logo.width
    page.drawImage(logo, { x: left, y: y - h + 22, width: w, height: h })
  } catch {
    text('Quadem Digital', left, 18, bold, NAVY)
  }
  y -= 4
  const title = r.refund ? 'REFUND' : r.corrected ? 'CORRECTED RECEIPT' : 'RECEIPT'
  page.drawText(title, { x: right - bold.widthOfTextAtSize(title, 22), y, size: 22, font: bold, color: NAVY })
  y -= 20
  const num = pdfSafe(r.number)
  page.drawText(num, { x: right - regular.widthOfTextAtSize(num, 11), y, size: 11, font: regular, color: MUTED })
  y -= 70
  page.drawRectangle({ x: left, y, width: right - left, height: 2, color: BLUE })
  y -= 28

  // From and to.
  const half = (right - left) / 2
  text('From', left, 9, bold, MUTED)
  page.drawText('Received from', { x: left + half, y, size: 9, font: bold, color: MUTED })
  y -= 16
  text(r.issuer.name, left, 11, bold)
  page.drawText(pdfSafe(r.clientName), { x: left + half, y, size: 11, font: bold, color: INK })
  y -= 15
  const fromLines = [r.issuer.address, r.issuer.email, r.issuer.phone].filter(Boolean).flatMap((l) => wrap(String(l), regular, 10, half - 16))
  const toLines = r.contactName && r.contactName !== r.clientName ? [r.contactName] : []
  for (let i = 0; i < Math.max(fromLines.length, toLines.length); i++) {
    if (fromLines[i]) text(fromLines[i], left, 10, regular, MUTED)
    if (toLines[i]) page.drawText(pdfSafe(toLines[i]), { x: left + half, y, size: 10, font: regular, color: MUTED })
    y -= 14
  }
  y -= 22

  // The payment.
  const rows: [string, string][] = [
    [r.refund ? 'Refunded on' : 'Received on', r.date],
    [r.refund ? 'Refunded by' : 'Paid by', r.method],
    ...(r.reference ? ([['Reference', r.reference]] as [string, string][]) : []),
    ['For', r.forWhat],
  ]
  for (const [label, value] of rows) {
    text(label, left, 10, regular, MUTED)
    const lines = wrap(value, regular, 11, right - left - 140)
    lines.forEach((l, i) => page.drawText(l, { x: left + 140, y: y - i * 14, size: 11, font: regular, color: INK }))
    y -= 14 * lines.length + 8
  }
  y -= 10
  page.drawRectangle({ x: left, y: y - 46, width: right - left, height: 58, color: rgb(232 / 255, 246 / 255, 251 / 255) })
  y -= 8
  text(r.refund ? 'Amount refunded' : 'Amount received', left + 16, 11, bold, NAVY)
  const amt = pdfSafe(r.amount)
  page.drawText(amt, { x: right - 16 - bold.widthOfTextAtSize(amt, 20), y: y - 8, size: 20, font: bold, color: NAVY })
  y -= 70

  // What is still owed.
  const b = balanceLines(r.balance)
  if (b.headline) {
    for (const l of wrap(b.headline, bold, 13, right - left)) {
      text(l, left, 13, bold, INK)
      y -= 18
    }
    if (b.detail) {
      text(b.detail, left, 10, regular, MUTED)
      y -= 16
    }
    if (r.balance.kind === 'invoice' && r.balance.link) {
      text('Pay the balance online from your invoice link, or by bank transfer as on the invoice.', left, 10, regular, MUTED)
      y -= 16
    }
  }

  // Foot.
  page.drawRectangle({ x: left, y: 72, width: right - left, height: 0.5, color: MUTED })
  page.drawText(pdfSafe(r.refund ? 'We have sent this money back to you. Keep this for your records.' : 'Thank you. Keep this receipt for your records.'), { x: left, y: 56, size: 9, font: regular, color: MUTED })
  page.drawText(pdfSafe(`${r.issuer.name}${r.issuer.email ? ` · ${r.issuer.email}` : ''}`), { x: left, y: 42, size: 9, font: regular, color: MUTED })
  return pdf.save()
}

// ── The email ──

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export function receiptEmail(r: ReceiptData) {
  const b = balanceLines(r.balance)
  const subject = r.refund
    ? `Refund ${r.number}: ${r.amount} sent back to you`
    : `${r.corrected ? 'Corrected receipt' : 'Receipt'} ${r.number}: ${r.amount} received, thank you`
  const rows: [string, string][] = [
    [r.refund ? 'Refunded on' : 'Received on', r.date],
    [r.refund ? 'Refunded by' : 'Paid by', r.method],
    ...(r.reference ? ([['Reference', r.reference]] as [string, string][]) : []),
    ['For', r.forWhat],
    ['Receipt number', r.number],
  ]
  const html = `
<div style="font-family:Calibri,Arial,sans-serif;max-width:600px;margin:24px auto;border:1px solid #dde3f0;border-radius:10px;overflow:hidden;">
  <div style="background:#0D1B6E;padding:24px 28px;">
    <div style="color:#00B4D8;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Quadem Digital</div>
    <div style="color:#fff;font-size:22px;font-weight:bold;">${r.refund ? 'Your refund' : r.corrected ? 'Your corrected receipt' : 'Payment received, thank you'}</div>
  </div>
  <div style="background:#fff;padding:28px;">
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;margin:0 0 18px;">
      Hi ${esc(r.contactName)}, ${r.refund ? `we have refunded <strong>${esc(r.amount)}</strong> to ${esc(r.clientName)}.` : r.corrected ? `here is the corrected receipt for your payment of <strong>${esc(r.amount)}</strong>. It replaces the one we sent before.` : `we have received <strong>${esc(r.amount)}</strong> from ${esc(r.clientName)}. Thank you.`}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;">
      ${rows.map(([k, v]) => `<tr><td style="padding:8px 0;color:#666;font-size:13px;width:38%;vertical-align:top;border-bottom:1px solid #eef1f6;">${esc(k)}</td><td style="padding:8px 0;color:#1A1A1A;font-size:14px;border-bottom:1px solid #eef1f6;">${esc(v)}</td></tr>`).join('')}
    </table>
    ${b.headline ? `<div style="background:#E8F6FB;border-left:4px solid #00B4D8;padding:14px 18px;border-radius:0 8px 8px 0;">
      <div style="color:#0D1B6E;font-weight:bold;font-size:16px;">${esc(b.headline)}</div>
      ${b.detail ? `<div style="color:#333;font-size:13px;line-height:1.6;margin-top:4px;">${esc(b.detail)}</div>` : ''}
      ${r.balance.kind === 'invoice' && r.balance.link ? `<a href="${esc(r.balance.link)}" style="display:inline-block;margin-top:12px;background:#0D1B6E;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:bold;">View the invoice and pay the balance</a>` : ''}
    </div>` : ''}
    <p style="color:#555;font-size:13px;line-height:1.7;margin:20px 0 0;">The ${r.refund ? 'confirmation' : 'receipt'} is attached as a PDF for your records. Any questions, just reply to this email.</p>
  </div>
</div>`
  return { subject, html }
}

// ── Sending ──

export type ReceiptResult = { sent: true; to: string; number: string } | { sent: false; reason: string }

/**
 * Write and send the receipt (or refund confirmation) for one payment, and
 * note on it when and to whom. Never throws for a client with no email: that
 * is noted, and Ernest is told, so he can send it by hand.
 */
export async function sendPaymentReceipt(req: PayloadRequest, paymentId: number | string, opts: { corrected?: boolean } = {}): Promise<ReceiptResult> {
  const payload = req.payload
  const payment = (await payload.findByID({ collection: 'client-payments', id: paymentId, depth: 0, overrideAccess: true, req }).catch(() => null)) as Doc | null
  if (!payment) return { sent: false, reason: 'That payment is not there any more.' }
  const client = refId(payment.client) ? ((await payload.findByID({ collection: 'clients', id: refId(payment.client)!, depth: 0, overrideAccess: true, req }).catch(() => null)) as Doc | null) : null
  const number = receiptNumber({ id: payment.id as number, clearedAt: payment.clearedAt as string | null })
  const note = (data: Doc) => payload.db.updateOne({ collection: 'client-payments', id: payment.id, data: { receipt: { ...(payment.receipt ?? {}), number, ...data } }, returning: false, req } as never)
  const email = String(client?.clientEmail || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const reason = client ? `${client.clientName || 'The client'} has no email address on their record.` : 'The payment is not linked to a client.'
    await note({ problem: reason })
    await notify(req, { to: await adminIds(req), kind: 'receipt-not-sent', title: `No receipt sent for ${payment.title}`, body: `${reason} Add it on their page, then press Send the receipt on the payment.`, link: `/money/payments/${payment.id}`, email: false, key: `receipt-not-sent:${payment.id}` }).catch(() => {})
    return { sent: false, reason }
  }
  const settings = (await payload.findGlobal({ slug: 'siteSettings', depth: 0, overrideAccess: true, req }).catch(() => null)) as Doc | null
  const refund = Number(payment.amountMinor) < 0
  const data: ReceiptData = {
    number,
    refund,
    corrected: Boolean(opts.corrected),
    clientName: String(client?.clientName || 'Your business'),
    contactName: String(client?.contactName || client?.clientName || 'there'),
    amount: money(Math.abs(Number(payment.amountMinor) || 0), String(payment.currency || 'GHS')),
    date: day(payment.clearedAt),
    method: METHOD[payment.method] || 'Bank transfer',
    reference: payment.reference ? String(payment.reference) : null,
    forWhat: await forWhat(payload, payment),
    balance: await balanceFor(payload, payment),
    issuer: { name: 'Quadem Digital Enterprise', address: settings?.address || null, email: settings?.email || 'ernest@quademdigital.com', phone: settings?.whatsappNumber ? `+${String(settings.whatsappNumber).replace(/\D/g, '')}` : null },
  }
  const { subject, html } = receiptEmail(data)
  const pdf = await receiptPdf(data)
  await payload.sendEmail({
    from: FROM,
    to: email,
    bcc: RECEIPT_COPY_TO,
    replyTo: 'ernest@quademdigital.com',
    subject,
    html,
    attachments: [{ filename: `${refund ? 'Refund' : 'Receipt'}-${number}.pdf`, content: Buffer.from(pdf), contentType: 'application/pdf' }],
  })
  await note({ sentAt: new Date().toISOString(), sentTo: email, problem: null })
  await audit(req, { action: refund ? 'payment.refund-confirmation-sent' : 'payment.receipt-sent', summary: `${refund ? 'Refund confirmation' : opts.corrected ? 'Corrected receipt' : 'Receipt'} ${number} emailed to ${email}`, subjectType: 'client-payments', subjectId: payment.id })
  return { sent: true, to: email, number }
}

export const paymentReceiptTask: TaskConfig<any> = {
  slug: 'paymentReceipt',
  retries: 2,
  inputSchema: [{ name: 'paymentId', type: 'text', required: true }],
  outputSchema: [{ name: 'result', type: 'text' }],
  handler: async ({ input, req }) => {
    const r = await sendPaymentReceipt(req, input.paymentId)
    return { output: { result: r.sent ? `sent to ${r.to}` : r.reason } }
  },
}

/** Ernest, from a payment's page: send the receipt now (again, or corrected). */
export const paymentReceiptEndpoints: Endpoint[] = [
  {
    path: '/payment-receipts/:id/send',
    method: 'post',
    handler: async (req) => {
      if (!hasRole(req.user, 'admin')) return Response.json({ error: 'Only Ernest sends receipts.' }, { status: 403 })
      const body = ((await req.json?.().catch(() => null)) ?? {}) as { corrected?: boolean }
      try {
        const r = await sendPaymentReceipt(req, String(req.routeParams?.id ?? ''), { corrected: body.corrected === true })
        return r.sent ? Response.json(r) : Response.json({ error: r.reason }, { status: 400 })
      } catch (error) {
        return Response.json({ error: error instanceof Error ? `The receipt could not be sent: ${error.message}` : 'The receipt could not be sent.' }, { status: 502 })
      }
    },
  },
]
