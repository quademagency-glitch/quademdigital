import type { Endpoint, PayloadRequest } from 'payload'
import { hasRole } from '../access/roles'
import { OWNER_OPTIONS, SERVICE_OPTIONS, STAGE_OPTIONS } from '../collections/JourneyTemplates'
import { audit } from './audit'

/*
  Editing a deal from the founder portal (POST /api/proposals/:id/edit).

  Only the deal's own facts change here: who it is for, what was sold, the
  money, the dates, what the client reads and the journey their onboarding
  starts from. Who is credited has its own form and its own rule
  (lib/deals.ts), and nothing here touches the quotation's history, the
  client record or the invoice: once those exist they are corrected on their
  own pages, and the portal says so.

  Two limits, because commission and payments read them: the currency stays
  once a payment is recorded against the deal, and after the client accepted,
  changing the total, the lines or the currency needs a reason, kept in the
  audit log.
*/

export const EDITABLE = [
  'clientName',
  'contactName',
  'clientEmail',
  'phone',
  'country',
  'service',
  'packageName',
  'currency',
  'total',
  'recurring',
  'depositPercent',
  'startDate',
  'durationMonths',
  'paymentTerms',
  'specialTerms',
  'summary',
  'deliverables',
  'lineItems',
  'journeySteps',
  'discussionNotes',
] as const

const CURRENCIES = ['GHS', 'USD', 'NGN', 'ZAR', 'KES', 'EUR', 'GBP']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const values = (o: { value: string }[]) => o.map((x) => x.value)
const text = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())
const orNull = (v: unknown) => text(v) || null

type Line = { description: string; quantity: number; rate: number; plan?: number | string | null }
type Step = { title: string; detail: string | null; owner: string; stage: string; dueOffsetDays: number; clientVisible: boolean }
export type DealDoc = Record<string, unknown> & { acceptedAt?: string | null; currency?: string | null; total?: number | null; lineItems?: Partial<Line>[] | null }

const linesKey = (l: Partial<Line>[] | null | undefined) =>
  JSON.stringify((l ?? []).map((x) => [text(x.description), Number(x.quantity ?? 1), Number(x.rate ?? 0)]))

/**
 * The changes to save, checked, or why not. Pure: `hasPayments` says whether
 * a client payment is recorded against the deal.
 */
export function dealEdit({ deal, data, reason, hasPayments }: { deal: DealDoc; data: unknown; reason?: unknown; hasPayments: boolean }):
  | { error: string }
  | { changes: Record<string, unknown>; money: boolean; changed: string[] } {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const has = (k: string) => Object.prototype.hasOwnProperty.call(d, k)
  const out: Record<string, unknown> = {}

  for (const k of ['clientName', 'contactName', 'phone', 'packageName', 'paymentTerms', 'specialTerms', 'summary', 'discussionNotes']) if (has(k)) out[k] = orNull(d[k])
  if (has('clientName') && !out.clientName) return { error: 'The deal needs the client’s name.' }
  if (has('clientEmail')) {
    const email = text(d.clientEmail)
    if (email && !EMAIL.test(email)) return { error: 'That email address does not look right.' }
    out.clientEmail = email || null
  }
  if (has('country')) {
    const c = text(d.country).toUpperCase()
    if (c && !/^[A-Z]{2}$/.test(c)) return { error: 'Use the two-letter country code, such as GH or NG.' }
    out.country = c || null
  }
  if (has('service')) {
    const s = text(d.service)
    if (s && !values(SERVICE_OPTIONS).includes(s)) return { error: 'Choose a service from the list.' }
    out.service = s || null
  }
  if (has('currency')) {
    const c = text(d.currency).toUpperCase()
    if (!CURRENCIES.includes(c)) return { error: `Choose the currency: ${CURRENCIES.join(', ')}.` }
    out.currency = c
  }
  if (has('recurring')) out.recurring = d.recurring === true
  if (has('depositPercent')) {
    const p = d.depositPercent === '' || d.depositPercent === null ? 0 : Number(d.depositPercent)
    if (!Number.isFinite(p) || p < 0 || p >= 100) return { error: 'The deposit is a percentage below 100, or 0 for none.' }
    out.depositPercent = p
  }
  if (has('durationMonths')) {
    const m = d.durationMonths === '' || d.durationMonths === null ? null : Number(d.durationMonths)
    if (m !== null && (!Number.isInteger(m) || m < 1)) return { error: 'The number of months is a whole number, 1 or more.' }
    out.durationMonths = m
  }
  if (has('startDate')) {
    const s = text(d.startDate)
    if (s && Number.isNaN(Date.parse(s))) return { error: 'That start date is not a date.' }
    out.startDate = s || null
  }
  if (has('deliverables')) {
    if (!Array.isArray(d.deliverables)) return { error: 'What they get is a list.' }
    out.deliverables = d.deliverables.map((x) => text(typeof x === 'object' && x ? (x as { item?: unknown }).item : x)).filter(Boolean).map((item) => ({ item }))
  }
  if (has('lineItems')) {
    if (!Array.isArray(d.lineItems)) return { error: 'The lines are a list.' }
    const lines: Line[] = d.lineItems.map((l) => {
      const x = (l ?? {}) as Partial<Line>
      const plan = x.plan === undefined || x.plan === null || x.plan === '' ? null : Number(x.plan)
      return { description: text(x.description), quantity: Number(x.quantity ?? 1), rate: Number(x.rate), ...(plan ? { plan } : {}) }
    })
    if (lines.some((l) => !l.description)) return { error: 'Every line needs a description.' }
    if (lines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1)) return { error: 'Quantities are whole numbers, 1 or more.' }
    if (lines.some((l) => !Number.isFinite(l.rate) || l.rate < 0)) return { error: 'Give every line a price, such as 1500, or 0 if it is included.' }
    out.lineItems = lines
  }
  if (has('total')) {
    const t = Number(d.total)
    if (!Number.isFinite(t) || t < 0) return { error: 'The total is an amount, such as 6000.' }
    out.total = Math.round(t * 100) / 100
  }
  // Lines, when there are any, are the total: provisioning refuses a deal whose lines do not add up.
  const lines = (out.lineItems ?? deal.lineItems ?? []) as Partial<Line>[]
  if (lines.length && (has('lineItems') || has('total'))) {
    const sum = Math.round(lines.reduce((n, l) => n + Number(l.quantity ?? 1) * Number(l.rate ?? 0), 0) * 100) / 100
    if (has('total') && Math.abs(Number(out.total) - sum) > 0.005) return { error: `The lines add up to ${sum}, not ${out.total}. Make the total the lines, or change a line.` }
    out.total = sum
  }
  if (has('journeySteps')) {
    if (!Array.isArray(d.journeySteps)) return { error: 'The journey is a list of steps.' }
    const steps: Step[] = []
    for (const raw of d.journeySteps) {
      const s = (raw ?? {}) as Record<string, unknown>
      const title = text(s.title)
      if (!title) return { error: 'Every journey step needs a name.' }
      const owner = text(s.owner) || 'quadem'
      const stage = text(s.stage) || 'onboarding'
      const due = s.dueOffsetDays === '' || s.dueOffsetDays === null || s.dueOffsetDays === undefined ? 0 : Number(s.dueOffsetDays)
      if (!values(OWNER_OPTIONS).includes(owner) || !values(STAGE_OPTIONS).includes(stage)) return { error: `“${title}”: choose who does it and its stage from the lists.` }
      if (!Number.isInteger(due) || due < 0) return { error: `“${title}”: the days from the start are a whole number, 0 or more.` }
      steps.push({ title, detail: orNull(s.detail), owner, stage, dueOffsetDays: due, clientVisible: s.clientVisible !== false })
    }
    out.journeySteps = steps
  }

  const before = { currency: text(deal.currency).toUpperCase(), total: Number(deal.total ?? 0), lines: linesKey(deal.lineItems) }
  const otherMoney = 'currency' in out && out.currency !== before.currency
  if (otherMoney && hasPayments && before.currency) return { error: `Money is recorded against this deal in ${before.currency}, so its currency stays. Make a new deal for work billed in another currency.` }
  const money = otherMoney || ('total' in out && Number(out.total) !== before.total) || ('lineItems' in out && linesKey(out.lineItems as Line[]) !== before.lines)
  if (money && deal.acceptedAt && !text(reason)) return { error: 'The client has accepted this deal, so changing its money needs a reason. It is kept with the deal.' }

  const view = (k: string, v: unknown) => (k === 'startDate' && v ? String(v).slice(0, 10) : (v ?? null))
  const changed = Object.keys(out).filter((k) => JSON.stringify(view(k, out[k])) !== JSON.stringify(view(k, normal(k, deal[k]))))
  return { changes: out, money, changed }
}

/** A stored value in the shape the checks produce, so unchanged fields are not listed as changed. */
function normal(k: string, v: unknown) {
  if (k === 'lineItems') return ((v ?? []) as Partial<Line>[]).map((l) => ({ description: text(l.description), quantity: Number(l.quantity ?? 1), rate: Number(l.rate ?? 0), ...(l.plan ? { plan: Number(typeof l.plan === 'object' ? (l.plan as { id: number }).id : l.plan) } : {}) }))
  if (k === 'deliverables') return ((v ?? []) as { item?: string }[]).map((x) => ({ item: text(x.item) }))
  if (k === 'journeySteps') return ((v ?? []) as Record<string, unknown>[]).map((s) => ({ title: text(s.title), detail: orNull(s.detail), owner: text(s.owner) || 'quadem', stage: text(s.stage) || 'onboarding', dueOffsetDays: Number(s.dueOffsetDays ?? 0), clientVisible: s.clientVisible !== false }))
  if (k === 'recurring') return v === true
  if (k === 'depositPercent') return Number(v) || 0
  if (k === 'currency' || k === 'country') return text(v).toUpperCase() || (k === 'currency' ? '' : null)
  if (k === 'startDate') return v ? String(v) : null
  if (typeof v === 'string') return v.trim() || null
  return v ?? null
}

const LABEL: Record<string, string> = {
  clientName: 'name',
  contactName: 'contact',
  clientEmail: 'email',
  phone: 'phone',
  country: 'country',
  service: 'service',
  packageName: 'package',
  currency: 'currency',
  total: 'total',
  recurring: 'monthly or one-off',
  depositPercent: 'deposit',
  startDate: 'start date',
  durationMonths: 'months',
  paymentTerms: 'payment terms',
  specialTerms: 'also agreed',
  summary: 'summary',
  deliverables: 'what they get',
  lineItems: 'lines',
  journeySteps: 'journey',
  discussionNotes: 'notes',
}

// What a save must never send back: the stored file's details and Payload's own.
const NOT_SENT = ['id', 'createdAt', 'updatedAt', 'url', 'thumbnailURL', 'filename', 'mimeType', 'filesize', 'width', 'height', 'focalX', 'focalY', 'sizes', 'prefix']

export const dealEditEndpoint: Endpoint = {
  path: '/:id/edit',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!hasRole(req.user, 'admin')) return Response.json({ error: 'Only the founder can do this.' }, { status: req.user ? 403 : 401 })
    const id = (req.routeParams as { id?: string } | undefined)?.id
    if (!id || !/^\d+$/.test(id)) return Response.json({ error: 'That deal is not there.' }, { status: 404 })
    const deal = (await req.payload.findByID({ collection: 'proposals', id: Number(id), depth: 0, overrideAccess: true, req, disableErrors: true })) as DealDoc | null
    if (!deal) return Response.json({ error: 'That deal is not there.' }, { status: 404 })
    let body: Record<string, unknown> = {}
    try {
      body = ((await req.json?.()) ?? {}) as Record<string, unknown>
    } catch {
      /* An empty body changes nothing. */
    }
    const paid = await req.payload.count({ collection: 'client-payments', where: { deal: { equals: deal.id } }, overrideAccess: true, req })
    const r = dealEdit({ deal, data: body.data, reason: body.reason, hasPayments: paid.totalDocs > 0 })
    if ('error' in r) return Response.json({ error: r.error }, { status: 400 })
    if (!r.changed.length) return Response.json({ ok: true, changed: [] })

    // The whole record goes back, so a field it is not given is never reset to its default.
    const whole = Object.fromEntries(Object.entries(deal).filter(([k]) => !NOT_SENT.includes(k)))
    const doc = await req.payload.update({ collection: 'proposals', id: deal.id as number, data: { ...whole, ...r.changes } as never, depth: 0, overrideAccess: true, req })
    const why = text(body.reason)
    await audit(req, {
      action: 'deal.changed',
      summary: `Deal for ${text(doc.clientName) || `deal ${deal.id}`}: changed the ${r.changed.map((k) => LABEL[k] ?? k).join(', ')}${r.money && deal.acceptedAt ? ` (total ${deal.total ?? 0} ${text(deal.currency)} to ${doc.total ?? 0} ${text(doc.currency)})` : ''}${why ? `. Why: ${why.slice(0, 500)}` : ''}`,
      subjectType: 'proposals',
      subjectId: deal.id as number,
    })
    return Response.json({ ok: true, changed: r.changed })
  },
}
