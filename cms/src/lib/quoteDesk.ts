import { randomBytes } from 'node:crypto'
import type { Endpoint, PayloadRequest } from 'payload'
import { hasRole } from '../access/roles'
import { provisionFromProposal } from '../utils/provisionFromProposal'
import { audit } from './audit'
import { fmt } from './invoiceDraft'
import { adminIds, notify } from './notify'
import { suggestQuote, type CatalogueItem, type Generate, type SuggestedLine } from './quoteAi'
import { button, escape, firstName, layout } from './teamEmails'

/**
 * Quotations from the founder portal (spec 14.9).
 *
 * A quotation is a deal (a proposal record) that has not been accepted yet. It
 * is drafted in the portal, from the price list or from the founder's notes of
 * a conversation (lib/quoteAi.ts), corrected, and sent: the client gets an
 * email with a private link to a page on the website where they accept or
 * decline it. Accepting it is the deal starting, so it runs the same
 * provisioning as the deal page's button: the client (unless the quotation is
 * for an existing one), a draft invoice and their journey, and the founder is
 * told at once.
 *
 * The website never reads proposals. It passes the link's token to the
 * quote-link endpoints with its own key, and gets back only what the client
 * may see.
 */

export const SITE = 'https://quademdigital.com'
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DAY = 86_400_000
export const VALID_DAYS = 30

export const quoteLink = (token: string) => `${SITE}/quote/${encodeURIComponent(token)}/`
export const newQuoteToken = () => randomBytes(24).toString('base64url')

type Line = { id?: string; description?: string | null; quantity?: number | null; rate?: number | null; plan?: unknown }
export type Quote = {
  id: number | string
  quoteNumber?: string | null
  quoteToken?: string | null
  quoteSentAt?: string | null
  quoteViewedAt?: string | null
  quoteViewCount?: number | null
  validUntil?: string | null
  clientName?: string | null
  contactName?: string | null
  clientEmail?: string | null
  service?: string | null
  currency?: string | null
  total?: number | null
  recurring?: boolean | null
  durationMonths?: number | null
  depositPercent?: number | null
  startDate?: string | null
  summary?: string | null
  deliverables?: { item?: string | null }[] | null
  lineItems?: Line[] | null
  paymentTerms?: string | null
  specialTerms?: string | null
  dealStatus?: string | null
  acceptedAt?: string | null
  acceptedName?: string | null
  declinedAt?: string | null
  client?: unknown
}

export type QuoteState = 'draft' | 'open' | 'accepted' | 'declined' | 'expired'

/** Where a quotation stands, as the client and the founder both see it. */
export function quoteState(q: Pick<Quote, 'quoteSentAt' | 'acceptedAt' | 'dealStatus' | 'declinedAt' | 'validUntil'>, now = Date.now()): QuoteState {
  if (q.acceptedAt) return 'accepted'
  if (q.dealStatus === 'declined' || q.declinedAt) return 'declined'
  if (!q.quoteSentAt) return 'draft'
  if (q.validUntil) {
    const end = new Date(q.validUntil)
    end.setUTCHours(23, 59, 59, 999)
    if (end.getTime() < now) return 'expired'
  }
  return 'open'
}

const lines = (q: Quote) => (q.lineItems ?? []).map((l) => ({ description: String(l.description ?? ''), quantity: Number(l.quantity) || 1, rate: Number(l.rate) || 0 }))

/** What the client may see: no notes, no credit, no AI reasoning. */
export function publicQuote(q: Quote, now = Date.now()) {
  const state = quoteState(q, now)
  return {
    number: q.quoteNumber,
    state,
    clientName: q.clientName,
    contactName: q.contactName,
    sentAt: q.quoteSentAt,
    validUntil: q.validUntil,
    currency: String(q.currency || 'GHS').toUpperCase(),
    total: Number(q.total) || 0,
    recurring: Boolean(q.recurring),
    durationMonths: q.durationMonths ?? null,
    depositPercent: Number(q.depositPercent) || 0,
    startDate: q.startDate ?? null,
    summary: q.summary ?? '',
    deliverables: (q.deliverables ?? []).map((d) => String(d.item ?? '')).filter(Boolean),
    lines: lines(q),
    paymentTerms: q.paymentTerms ?? '',
    specialTerms: q.specialTerms ?? '',
    acceptedAt: q.acceptedAt ?? null,
    acceptedName: q.acceptedName ?? null,
  }
}

const day = (iso?: string | null) => (iso ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Accra' }).format(new Date(iso)) : '')

/** The email carrying a quotation to the client. */
export function quoteEmail(q: Quote, again = false) {
  const first = firstName(q.contactName || q.clientName)
  const currency = String(q.currency || 'GHS').toUpperCase()
  const total = fmt(Math.round((Number(q.total) || 0) * 100), currency) + (q.recurring ? ' a month' : '')
  const link = quoteLink(String(q.quoteToken))
  const html = layout(
    [
      `<p style="margin:0 0 12px">${first ? `Hello ${escape(first)},` : 'Hello,'}</p>`,
      `<p style="margin:0 0 12px">${again ? 'Here again is' : 'Thank you for speaking with us. Here is'} our quotation <strong>${escape(String(q.quoteNumber))}</strong>${q.clientName ? ` for ${escape(q.clientName)}` : ''}.</p>`,
      q.summary ? `<p style="margin:0 0 12px;color:#334155">${escape(q.summary)}</p>` : '',
      `<p style="margin:16px 0 4px;color:#5b6474;font-size:14px">${q.recurring ? 'Monthly' : 'Total'}</p>`,
      `<p style="margin:0;font-size:24px;font-weight:800">${escape(total)}</p>`,
      q.validUntil ? `<p style="margin:6px 0 0;color:#5b6474;font-size:14px">Valid until ${escape(day(q.validUntil))}</p>` : '',
      button(link, 'View and accept the quotation'),
      `<p style="margin:24px 0 0">Everything it includes is on the page, with a button to accept it. Reply to this email with any questions or changes.</p>`,
    ]
      .filter(Boolean)
      .join('\n'),
  )
  const text = [
    first ? `Hello ${first},` : 'Hello,',
    '',
    `${again ? 'Here again is' : 'Thank you for speaking with us. Here is'} our quotation ${q.quoteNumber}${q.clientName ? ` for ${q.clientName}` : ''}.`,
    q.summary ? `\n${q.summary}` : '',
    '',
    `${q.recurring ? 'Monthly' : 'Total'}: ${total}`,
    q.validUntil ? `Valid until ${day(q.validUntil)}` : '',
    '',
    `View and accept the quotation: ${link}`,
    '',
    'Everything it includes is on the page, with a button to accept it. Reply to this email with any questions or changes.',
    '',
    'Quadem Digital',
  ]
  return { subject: `Quotation ${q.quoteNumber} from Quadem Digital`, html, text: text.filter((l, i, a) => l || a[i - 1]).join('\n') }
}

/** Why a quotation cannot be sent yet, in words; null when it can. */
export function notSendableQuote(q: Quote): string | null {
  if (!String(q.clientName ?? '').trim()) return 'Add the client’s or business’s name.'
  if (!EMAIL_OK.test(q.clientEmail ?? '')) return 'Add the client’s email address: the quotation goes to it.'
  const ls = lines(q)
  if (!ls.length) return 'Add at least one line.'
  if (ls.some((l) => !l.description.trim())) return 'Every line needs a description.'
  if (!(Number(q.total) > 0)) return 'The total is nothing. Put a price on the lines.'
  if (!q.service) return 'Choose the service: the client’s set-up depends on it when they accept.'
  return null
}

/** The next quotation number this year: QT-2026-0001. */
async function nextNumber(req: PayloadRequest) {
  const prefix = `QT-${new Date().getFullYear()}-`
  const latest = await req.payload.find({ collection: 'proposals', where: { quoteNumber: { like: prefix } }, sort: '-quoteNumber', limit: 1, depth: 0, overrideAccess: true, req })
  const n = Number(String((latest.docs[0] as Quote | undefined)?.quoteNumber ?? '').slice(prefix.length)) || 0
  return `${prefix}${String(n + 1).padStart(4, '0')}`
}

const total = (ls: SuggestedLine[] | { quantity: number; rate: number }[]) => Math.round(ls.reduce((n, l) => n + l.quantity * l.rate, 0) * 100) / 100

async function body(req: PayloadRequest): Promise<Record<string, any>> {
  try {
    return ((await req.json?.()) ?? {}) as Record<string, any>
  } catch {
    return {}
  }
}
const founderOnly = (req: PayloadRequest) => (hasRole(req.user, 'admin') ? null : Response.json({ error: 'Only the founder can do this.' }, { status: req.user ? 403 : 401 }))
const websiteOnly = (req: PayloadRequest) => (hasRole(req.user, 'admin', 'site') ? null : Response.json({ error: 'Not allowed.' }, { status: req.user ? 403 : 401 }))
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/

async function byToken(req: PayloadRequest, token: unknown): Promise<Quote | null> {
  if (typeof token !== 'string' || !TOKEN.test(token)) return null
  const r = await req.payload.find({ collection: 'proposals', where: { quoteToken: { equals: token } }, limit: 1, depth: 0, overrideAccess: true, req })
  return (r.docs[0] as unknown as Quote) ?? null
}
async function byId(req: PayloadRequest): Promise<Quote | null> {
  const id = (req.routeParams as { id?: string } | undefined)?.id
  if (!id || !/^\d+$/.test(id)) return null
  return (await req.payload.findByID({ collection: 'proposals', id: Number(id), depth: 0, overrideAccess: true, req, disableErrors: true })) as unknown as Quote | null
}

/**
 * Once at a time per quotation: a double click, or the client and the founder
 * accepting together, must not set up two clients. Postgres only; the local
 * test database has no second writer to race.
 */
async function oneAtATime<T>(req: PayloadRequest, id: number | string, fn: () => Promise<T>): Promise<T | 'busy'> {
  const pool = (req.payload.db as { pool?: { connect: () => Promise<any> } }).pool
  if (!pool) return fn()
  const connection = await pool.connect()
  let locked = false
  try {
    locked = (await connection.query('SELECT pg_try_advisory_lock(270928, $1) AS locked', [Number(id)])).rows[0]?.locked === true
    if (!locked) return 'busy'
    return await fn()
  } finally {
    if (locked) await connection.query('SELECT pg_advisory_unlock(270928, $1)', [Number(id)])
    connection.release()
  }
}

/** Accepting: the deal starts, and the client, a draft invoice and the journey are set up. */
export async function acceptQuote(req: PayloadRequest, q: Quote, how: { via: 'online' | 'by-hand'; name: string; from?: string }) {
  const result = await oneAtATime(req, q.id, async () => {
    const fresh = (await req.payload.findByID({ collection: 'proposals', id: q.id, depth: 0, overrideAccess: true, req })) as unknown as Quote
    if (fresh.acceptedAt) return { already: true as const, setup: null }
    const now = new Date().toISOString()
    await req.payload.update({
      collection: 'proposals',
      id: q.id,
      data: { acceptedAt: now, acceptedName: how.name.slice(0, 120), acceptedVia: how.via, acceptedFrom: how.from?.slice(0, 300) || null, startDate: fresh.startDate || now, dealStatus: 'accepted' } as never,
      overrideAccess: true,
      req,
    })
    let setup: Awaited<ReturnType<typeof provisionFromProposal>> | null = null
    try {
      setup = await provisionFromProposal(q.id, req.payload, req)
    } catch (err) {
      req.payload.logger.error({ err, proposal: q.id }, 'Setting up an accepted quotation failed')
      setup = { ok: false, log: [], error: err instanceof Error ? err.message : 'Set-up failed' }
    }
    return { already: false as const, setup }
  })
  if (result === 'busy') return { busy: true as const }
  if (result.already) return { already: true as const }
  const setup = result.setup
  const money = fmt(Math.round((Number(q.total) || 0) * 100), String(q.currency || 'GHS').toUpperCase()) + (q.recurring ? ' a month' : '')
  await notify(req, {
    to: await adminIds(req),
    kind: 'quote',
    title: `${q.clientName || 'A client'} accepted ${q.quoteNumber}`,
    body: [
      `${money}${how.via === 'online' ? `, accepted online by ${how.name}` : ', marked accepted'}.`,
      setup?.ok
        ? `${setup.clientId && !q.client ? 'Their client record is set up and onboarding starts. ' : ''}Their invoice ${setup.invoiceNumber ?? ''} is drafted: check it and send it.`.trim()
        : `Setting them up needs you: ${setup?.error ?? 'open the quotation'}.`,
    ].join('\n'),
    link: `/quotations/${q.id}`,
    key: `quote-accepted:${q.id}`,
    important: true,
    action: 'Open the quotation',
  })
  await audit(req, { action: 'quote.accepted', summary: `${q.quoteNumber} accepted ${how.via === 'online' ? `online by ${how.name}` : 'by hand'}`, subjectType: 'proposals', subjectId: q.id })
  return { accepted: true as const, setup }
}

async function declineQuote(req: PayloadRequest, q: Quote, reason: string, online: boolean) {
  await req.payload.update({ collection: 'proposals', id: q.id, data: { dealStatus: 'declined', declinedAt: new Date().toISOString(), declineReason: reason.slice(0, 1000) || null } as never, overrideAccess: true, req })
  await notify(req, {
    to: await adminIds(req),
    kind: 'quote',
    title: `${q.clientName || 'A client'} declined ${q.quoteNumber}`,
    body: reason ? `They said: “${reason.slice(0, 300)}”` : online ? 'They gave no reason.' : 'Marked declined.',
    link: `/quotations/${q.id}`,
    key: `quote-declined:${q.id}`,
    email: online,
    action: 'Open the quotation',
  })
  await audit(req, { action: 'quote.declined', summary: `${q.quoteNumber} declined${online ? ' online' : ''}`, subjectType: 'proposals', subjectId: q.id, reason: reason || null })
}

export type DraftInput = {
  client?: number | string
  lead?: number | string
  contact?: { clientName?: string; contactName?: string; clientEmail?: string; phone?: string; country?: string }
  currency: string
  service?: string
  lines?: SuggestedLine[]
  notes?: string
  catalogue?: CatalogueItem[]
}

/** Who the quotation is for: an existing client, a lead, or someone typed in. */
async function recipient(req: PayloadRequest, input: DraftInput) {
  const c = input.contact ?? {}
  if (input.client) {
    const client = (await req.payload.findByID({ collection: 'clients', id: Number(input.client), depth: 0, overrideAccess: true, req, disableErrors: true })) as Record<string, any> | null
    if (!client) throw new Error('That client is not there.')
    return { client: client.id, lead: client.sourceLead ?? undefined, clientName: client.clientName, contactName: client.contactName, clientEmail: client.clientEmail, phone: client.phone, country: client.country, service: client.service }
  }
  if (input.lead) {
    const lead = (await req.payload.findByID({ collection: 'leads', id: Number(input.lead), depth: 0, overrideAccess: true, req, disableErrors: true })) as Record<string, any> | null
    if (!lead) throw new Error('That lead is not there.')
    return { lead: lead.id, clientName: lead.businessName || lead.title || lead.name, contactName: lead.name, clientEmail: lead.email, phone: lead.whatsapp || lead.phone, country: lead.country }
  }
  return { clientName: c.clientName, contactName: c.contactName, clientEmail: c.clientEmail, phone: c.phone, country: c.country }
}

/** Make the draft. With notes and no lines, the lines come from the model. */
export async function draftQuote(req: PayloadRequest, input: DraftInput, generate?: Generate) {
  const who = await recipient(req, input)
  const currency = String(input.currency || '').toUpperCase()
  let ls: SuggestedLine[] = (input.lines ?? []).map((l) => ({ plan: l.plan, description: String(l.description ?? '').trim(), quantity: Number(l.quantity) || 1, rate: Number(l.rate) || 0 }))
  let extra: Record<string, unknown> = {}
  let note = ''
  const notes = String(input.notes ?? '').trim()
  if (!ls.length && notes) {
    const s = await suggestQuote(notes, currency, input.catalogue ?? [], generate)
    ls = s.lines
    extra = {
      ...(s.service ? { service: s.service } : {}),
      recurring: s.recurring,
      durationMonths: s.durationMonths ?? undefined,
      depositPercent: s.depositPercent,
      summary: s.summary || undefined,
      deliverables: s.deliverables.map((item) => ({ item })),
    }
    note = [
      s.why,
      ls.some((l) => l.estimate) ? 'Lines marked “estimate” are not on the price list: check their prices.' : '',
      s.questions.length ? `To confirm with the client: ${s.questions.join(' ')}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (!ls.length) ls = [{ description: 'Agreed work', quantity: 1, rate: 0 }]
  const plans = [...new Set(ls.map((l) => l.plan).filter((p) => p != null).map(String))]
  const doc = await req.payload.create({
    collection: 'proposals',
    data: {
      status: 'needs-review',
      dealStatus: 'draft',
      ...who,
      service: (extra.service as string) || input.service || who.service || undefined,
      currency,
      pricing: ls.every((l) => l.plan != null && !l.estimate) ? 'package' : 'custom',
      plans: plans.map(Number),
      lineItems: ls.map((l) => ({ description: l.description.slice(0, 200) || 'Agreed work', quantity: l.quantity, rate: l.rate, plan: l.plan != null ? Number(l.plan) : undefined })),
      total: total(ls),
      ...extra,
      quoteNumber: await nextNumber(req),
      quoteToken: newQuoteToken(),
      discussionNotes: notes || undefined,
      suggestionNote: note || undefined,
    } as never,
    overrideAccess: true,
    req,
  })
  await audit(req, { action: 'quote.drafted', summary: `${(doc as Quote).quoteNumber} drafted for ${who.clientName || 'a client'}${notes && !input.lines?.length ? ' from discussion notes' : ''}`, subjectType: 'proposals', subjectId: doc.id })
  return { doc: doc as unknown as Quote, note }
}

export const quoteDeskEndpoints: Endpoint[] = [
  {
    path: '/quote-draft',
    method: 'post',
    handler: async (req) => {
      const no = founderOnly(req)
      if (no) return no
      const b = (await body(req)) as DraftInput
      if (!/^[A-Z]{3}$/.test(String(b.currency ?? '').toUpperCase())) return Response.json({ error: 'Choose the currency.' }, { status: 400 })
      if (!b.client && !b.lead && !String(b.contact?.clientName ?? '').trim()) return Response.json({ error: 'Say who the quotation is for.' }, { status: 400 })
      if (!b.lines?.length && !String(b.notes ?? '').trim()) return Response.json({ error: 'Choose from the price list, or write what you discussed.' }, { status: 400 })
      try {
        const { doc, note } = await draftQuote(req, b)
        return Response.json({ ok: true, doc, note }, { status: 201 })
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (/not there/.test(msg)) return Response.json({ error: msg }, { status: 404 })
        req.payload.logger.error({ err }, 'A quotation could not be drafted')
        return Response.json({ error: 'The suggestion could not be made just now. Try again, or start from the price list.' }, { status: 502 })
      }
    },
  },
  {
    // Send it, or send it again. The first send numbers the days it is valid for.
    path: '/:id/quote-send',
    method: 'post',
    handler: async (req) => {
      const no = founderOnly(req)
      if (no) return no
      let q = await byId(req)
      if (!q) return Response.json({ error: 'That quotation is not there.' }, { status: 404 })
      const state = quoteState(q)
      if (state === 'accepted' || state === 'declined') return Response.json({ error: `This quotation was ${state}, so it is not sent again.` }, { status: 400 })
      const why = notSendableQuote(q)
      if (why) return Response.json({ error: why }, { status: 400 })
      const now = new Date()
      const first = !q.quoteSentAt
      const valid = q.validUntil && Date.parse(q.validUntil) >= now.getTime() - DAY ? q.validUntil : new Date(now.getTime() + VALID_DAYS * DAY).toISOString()
      q = (await req.payload.update({
        collection: 'proposals',
        id: q.id,
        data: { ...(first ? { quoteSentAt: now.toISOString() } : {}), validUntil: valid, dealStatus: 'sent', ...(q.quoteToken ? {} : { quoteToken: newQuoteToken() }) } as never,
        overrideAccess: true,
        req,
      })) as unknown as Quote
      let emailed = false
      try {
        const mail = quoteEmail(q, !first)
        await req.payload.sendEmail({ to: q.clientEmail, subject: mail.subject, html: mail.html, text: mail.text })
        emailed = true
      } catch (err) {
        req.payload.logger.error({ err, proposal: q.id }, 'The quotation email failed')
      }
      await audit(req, { action: first ? 'quote.sent' : 'quote.resent', summary: `${q.quoteNumber} ${first ? 'sent' : 'sent again'}${emailed ? ` to ${q.clientEmail}` : ', but the email failed'}`, subjectType: 'proposals', subjectId: q.id })
      return Response.json({ ok: true, first, emailed, to: q.clientEmail, link: quoteLink(String(q.quoteToken)) })
    },
  },
  {
    // The client said yes some other way (WhatsApp, a call): the same as accepting online.
    path: '/:id/quote-accept',
    method: 'post',
    handler: async (req) => {
      const no = founderOnly(req)
      if (no) return no
      const q = await byId(req)
      if (!q) return Response.json({ error: 'That quotation is not there.' }, { status: 404 })
      if (quoteState(q) === 'declined') return Response.json({ error: 'This quotation was declined. Make a new one.' }, { status: 400 })
      const why = notSendableQuote({ ...q, clientEmail: q.clientEmail || 'x@x.x' })
      if (why && !/email/.test(why)) return Response.json({ error: why }, { status: 400 })
      const b = await body(req)
      const r = await acceptQuote(req, q, { via: 'by-hand', name: String(b.name ?? '').trim() || 'Marked by the founder' })
      if ('busy' in r) return Response.json({ error: 'It is being accepted right now. Refresh in a moment.' }, { status: 409 })
      if ('already' in r) return Response.json({ ok: true, already: true })
      return Response.json({ ok: true, setup: r.setup })
    },
  },
  {
    path: '/:id/quote-decline',
    method: 'post',
    handler: async (req) => {
      const no = founderOnly(req)
      if (no) return no
      const q = await byId(req)
      if (!q) return Response.json({ error: 'That quotation is not there.' }, { status: 404 })
      if (q.acceptedAt) return Response.json({ error: 'This quotation was accepted; end the deal instead.' }, { status: 400 })
      const b = await body(req)
      await declineQuote(req, q, String(b.reason ?? '').trim(), false)
      return Response.json({ ok: true })
    },
  },

  /* The website, on the client's behalf, with the link's token. */
  {
    path: '/quote-link/open',
    method: 'post',
    handler: async (req) => {
      const no = websiteOnly(req)
      if (no) return no
      const b = await body(req)
      const q = await byToken(req, b.token)
      if (!q || !q.quoteSentAt) return Response.json({ error: 'This quotation link does not work. Check you opened the whole link from the email.' }, { status: 404 })
      if (b.record === true && quoteState(q) === 'open') {
        const firstView = !q.quoteViewedAt
        await req.payload.update({ collection: 'proposals', id: q.id, data: { quoteViewedAt: q.quoteViewedAt || new Date().toISOString(), quoteViewCount: (Number(q.quoteViewCount) || 0) + 1 } as never, overrideAccess: true, req })
        if (firstView) {
          await notify(req, { to: await adminIds(req), kind: 'quote', title: `${q.clientName || 'A client'} opened ${q.quoteNumber}`, link: `/quotations/${q.id}`, key: `quote-viewed:${q.id}`, email: false })
        }
      }
      return Response.json(publicQuote(q))
    },
  },
  {
    path: '/quote-link/accept',
    method: 'post',
    handler: async (req) => {
      const no = websiteOnly(req)
      if (no) return no
      const b = await body(req)
      const q = await byToken(req, b.token)
      if (!q || !q.quoteSentAt) return Response.json({ error: 'This quotation link does not work.' }, { status: 404 })
      const state = quoteState(q)
      if (state === 'accepted') return Response.json({ ok: true, already: true })
      if (state === 'expired') return Response.json({ error: 'This quotation has expired. Reply to the email and we will send a fresh one.' }, { status: 410 })
      if (state !== 'open') return Response.json({ error: 'This quotation can no longer be accepted.' }, { status: 409 })
      const name = String(b.name ?? '').trim()
      if (name.length < 2) return Response.json({ error: 'Type your full name to accept.' }, { status: 400 })
      if (b.agree !== true) return Response.json({ error: 'Tick the box to say you accept the quotation and its terms.' }, { status: 400 })
      const from = [typeof b.ip === 'string' ? b.ip.slice(0, 64) : '', typeof b.ua === 'string' ? b.ua.slice(0, 200) : ''].filter(Boolean).join(' · ')
      const r = await acceptQuote(req, q, { via: 'online', name, from })
      if ('busy' in r) return Response.json({ error: 'Your acceptance is being recorded. Refresh the page in a moment.' }, { status: 409 })
      return Response.json({ ok: true })
    },
  },
  {
    path: '/quote-link/decline',
    method: 'post',
    handler: async (req) => {
      const no = websiteOnly(req)
      if (no) return no
      const b = await body(req)
      const q = await byToken(req, b.token)
      if (!q || !q.quoteSentAt) return Response.json({ error: 'This quotation link does not work.' }, { status: 404 })
      if (quoteState(q) !== 'open') return Response.json({ error: 'This quotation can no longer be declined.' }, { status: 409 })
      await declineQuote(req, q, String(b.reason ?? '').trim(), true)
      return Response.json({ ok: true })
    },
  },
]
