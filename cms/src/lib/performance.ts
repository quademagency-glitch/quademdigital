import { isInbound } from './enquiries'

/*
  The founder's dashboard (the portal's home): sales, marketing, team and money
  for a period, against the period before it, with a trend. Pure: the loader
  (performanceData.ts) reads the records and this works out the figures, so it
  is tested without a database.

  Money is never added across currencies: every money figure is a list, one
  entry per currency. The only cross-currency sums are commission and team
  cost, which the records already hold in GH₵.
*/

export type PeriodKey = 'month' | 'last-month' | '3m' | 'year' | '12m' | 'all'
export const PERIOD_KEYS: PeriodKey[] = ['month', 'last-month', '3m', 'year', '12m', 'all']

export type Bucket = { label: string; from: string; to: string }
export type Period = { key: PeriodKey; from: string; to: string; prevFrom: string | null; prevTo: string | null; unit: 'week' | 'month'; buckets: Bucket[] }

export type Figure = { now: number; prev: number | null; series: number[] }
export type MoneyFigure = { currency: string; now: number; prev: number | null; series: number[] }[]
export type Ratio = { now: number | null; prev: number | null }

const DAY = 86_400_000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthStart = (y: number, m: number) => new Date(Date.UTC(y, m, 1))

/** The period's dates, the one before it to compare with, and its trend buckets (weeks up to five, months beyond). */
export function periodOf(key: PeriodKey, now: Date, first?: Date | null): Period {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  let from: Date
  let to = now
  let prevFrom: Date | null
  let prevTo: Date | null
  switch (key) {
    case 'month': // so far this month, against the same days last month
      from = monthStart(y, m)
      prevFrom = monthStart(y, m - 1)
      prevTo = new Date(Math.min(prevFrom.getTime() + (to.getTime() - from.getTime()), from.getTime()))
      break
    case 'last-month':
      from = monthStart(y, m - 1)
      to = monthStart(y, m)
      prevFrom = monthStart(y, m - 2)
      prevTo = from
      break
    case 'year': // so far this year, against the same days last year
      from = monthStart(y, 0)
      prevFrom = monthStart(y - 1, 0)
      prevTo = new Date(prevFrom.getTime() + (to.getTime() - from.getTime()))
      break
    case '3m':
    case '12m': {
      from = monthStart(y, m - (key === '3m' ? 2 : 11))
      prevTo = from
      prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()))
      break
    }
    case 'all': {
      // So far: from the first record, month by month, at most two years shown.
      const start = first ?? monthStart(y, m)
      from = new Date(Math.max(monthStart(start.getUTCFullYear(), start.getUTCMonth()).getTime(), monthStart(y, m - 23).getTime()))
      prevFrom = null
      prevTo = null
      break
    }
  }
  const unit: Period['unit'] = to.getTime() - from.getTime() <= 35 * DAY ? 'week' : 'month'
  const buckets: Bucket[] = []
  if (unit === 'week') {
    for (let t = from.getTime(); t < to.getTime(); t += 7 * DAY) {
      const d = new Date(t)
      buckets.push({ label: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`, from: d.toISOString(), to: new Date(Math.min(t + 7 * DAY, to.getTime())).toISOString() })
    }
  } else {
    const years = new Set<number>()
    for (let d = from; d < to; d = monthStart(d.getUTCFullYear(), d.getUTCMonth() + 1)) years.add(d.getUTCFullYear())
    for (let d = from; d < to; d = monthStart(d.getUTCFullYear(), d.getUTCMonth() + 1)) {
      const end = monthStart(d.getUTCFullYear(), d.getUTCMonth() + 1)
      buckets.push({ label: years.size > 1 ? `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}` : MONTHS[d.getUTCMonth()], from: d.toISOString(), to: (end < to ? end : to).toISOString() })
    }
  }
  return { key, from: from.toISOString(), to: to.toISOString(), prevFrom: prevFrom?.toISOString() ?? null, prevTo: prevTo?.toISOString() ?? null, unit, buckets }
}

const within = (iso: unknown, from: string | null, to: string | null) => {
  if (!iso || !from || !to) return false
  const t = String(iso)
  return t >= from && t < to
}

/** A count over the period, the period before, and each bucket. */
function count(dates: unknown[], p: Period): Figure {
  const at = dates.filter(Boolean).map(String)
  return {
    now: at.filter((d) => within(d, p.from, p.to)).length,
    prev: p.prevFrom ? at.filter((d) => within(d, p.prevFrom, p.prevTo)).length : null,
    series: p.buckets.map((b) => at.filter((d) => within(d, b.from, b.to)).length),
  }
}

/** An amount in minor units, kept per currency, over the period, the period before, and each bucket. */
function money(items: { at: unknown; currency?: string | null; minor: number }[], p: Period): MoneyFigure {
  const by = new Map<string, typeof items>()
  for (const i of items) {
    if (!i.at || !i.minor) continue
    const c = (i.currency || 'GHS').toUpperCase()
    by.set(c, [...(by.get(c) ?? []), i])
  }
  const sum = (list: typeof items, f: string | null, t: string | null) => list.filter((i) => within(i.at, f, t)).reduce((n, i) => n + i.minor, 0)
  return [...by]
    .map(([currency, list]) => ({
      currency,
      now: sum(list, p.from, p.to),
      prev: p.prevFrom ? sum(list, p.prevFrom, p.prevTo) : null,
      series: p.buckets.map((b) => sum(list, b.from, b.to)),
    }))
    .filter((m) => m.now || m.prev || m.series.some(Boolean))
    .sort((a, b) => (a.currency === 'GHS' ? -1 : b.currency === 'GHS' ? 1 : b.now - a.now))
}

const sumIn = (items: { at: unknown; minor: number }[], f: string | null, t: string | null) => items.filter((i) => within(i.at, f, t)).reduce((n, i) => n + (i.minor || 0), 0)

const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

const idOf = (v: unknown) => (v && typeof v === 'object' ? String((v as { id: unknown }).id) : v == null ? null : String(v))

/** Where a lead sits on the journey, as the portal draws it. */
const STAGE: Record<string, 'Found' | 'Messaged' | 'Talking' | 'Quote'> = {
  new: 'Found',
  contacted: 'Messaged',
  'no-response': 'Messaged',
  replied: 'Talking',
  'in-conversation': 'Talking',
  qualified: 'Talking',
  'proposal-requested': 'Quote',
  'proposal-sent': 'Quote',
}

export type PerformanceInput = {
  leads: { id: unknown; loggedAt?: string | null; createdAt?: string | null; source?: string | null; status?: string | null; owner?: unknown; activity?: { type?: string | null; at?: string | null; by?: unknown }[] | null }[]
  priceRequests: { createdAt?: string | null }[]
  deals: { lead?: unknown; quoteSentAt?: string | null; acceptedAt?: string | null; declinedAt?: string | null; service?: string | null; currency?: string | null; total?: number | null; recurring?: boolean | null; dealStatus?: string | null; endedAt?: string | null; creditTo?: unknown }[]
  payments: { clearedAt?: string | null; currency?: string | null; amountMinor?: number | null; commissionGHSMinor?: number | null }[]
  invoices: { issuedAt?: string | null; currency?: string | null; amountMinor?: number | null; amountPaidMinor?: number | null; status?: string | null; dueDate?: string | null }[]
  subscribers: { confirmedAt?: string | null; unsubscribedAt?: string | null; status?: string | null }[]
  events: { event?: string | null; occurredAt?: string | null; campaign?: unknown; email?: string | null }[]
  pitches: { createdAt?: string | null; firstViewedAt?: string | null }[]
  people: { id: unknown; name?: string | null; email?: string | null; status?: string | null }[]
  reports: { user?: unknown; date?: string | null; onTime?: boolean | null }[]
  payouts: { paidAt?: string | null; amountGHSMinor?: number | null }[]
}

export function buildPerformance(input: PerformanceInput, p: Period, now = new Date()) {
  const { leads, deals, payments, invoices } = input
  const logged = (l: PerformanceInput['leads'][number]) => l.loggedAt || l.createdAt
  const rows = leads.flatMap((l) => (l.activity ?? []).map((r) => ({ ...r, lead: l })))
  const won = deals.filter((d) => d.acceptedAt)
  const leadById = new Map(leads.map((l) => [String(l.id), l]))

  // Sales: from the first contact to a deal won.
  const sent = count(deals.map((d) => d.quoteSentAt), p)
  const wonCount = count(won.map((d) => d.acceptedAt), p)
  const rate = (w: number, s: number) => (s ? Math.round((w / s) * 100) : null)
  const daysToWin = (f: string | null, t: string | null) =>
    median(
      won
        .filter((d) => within(d.acceptedAt, f, t))
        .map((d) => {
          const lead = leadById.get(idOf(d.lead) ?? '')
          const start = lead ? logged(lead) : null
          return start ? Math.max(0, Math.round((Date.parse(String(d.acceptedAt)) - Date.parse(String(start))) / DAY)) : null
        })
        .filter((n): n is number => n !== null),
    )
  const inPeriod = leads.filter((l) => within(logged(l), p.from, p.to))
  const sources = new Map<string, { leads: number; won: number }>()
  for (const l of inPeriod) {
    const k = l.source || 'other'
    const s = sources.get(k) ?? { leads: 0, won: 0 }
    s.leads += 1
    if (l.status === 'won') s.won += 1
    sources.set(k, s)
  }
  const services = new Map<string, { deals: number; value: Map<string, number> }>()
  for (const d of won.filter((d) => within(d.acceptedAt, p.from, p.to))) {
    const k = d.service || 'other'
    const s = services.get(k) ?? { deals: 0, value: new Map() }
    s.deals += 1
    const c = (d.currency || 'GHS').toUpperCase()
    s.value.set(c, (s.value.get(c) ?? 0) + Math.round((d.total ?? 0) * 100))
    services.set(k, s)
  }
  const pipeline = { Found: 0, Messaged: 0, Talking: 0, Quote: 0 }
  for (const l of leads) {
    const stage = STAGE[l.status ?? 'new']
    if (stage) pipeline[stage] += 1
  }

  const sales = {
    enquiries: count(leads.filter((l) => isInbound(l.source)).map(logged), p),
    leadsFound: count(leads.filter((l) => !isInbound(l.source)).map(logged), p),
    firstMessages: count(rows.filter((r) => r.type === 'first-message').map((r) => r.at), p),
    replies: count(rows.filter((r) => r.type === 'reply').map((r) => r.at), p),
    priceRequests: count(input.priceRequests.map((q) => q.createdAt), p),
    quotesSent: sent,
    dealsWon: wonCount,
    wonValue: money(won.map((d) => ({ at: d.acceptedAt, currency: d.currency, minor: Math.round((d.total ?? 0) * 100) })), p),
    winRate: { now: rate(wonCount.now, sent.now), prev: wonCount.prev === null || sent.prev === null ? null : rate(wonCount.prev, sent.prev) } as Ratio,
    daysToWin: { now: daysToWin(p.from, p.to), prev: daysToWin(p.prevFrom, p.prevTo) } as Ratio,
    bySource: [...sources].map(([source, s]) => ({ source, inbound: isInbound(source), ...s })).sort((a, b) => b.leads - a.leads),
    byService: [...services].map(([service, s]) => ({ service, deals: s.deals, value: [...s.value].map(([currency, minor]) => ({ currency, minor })) })).sort((a, b) => b.deals - a.deals),
    pipeline,
  }

  // Marketing: who is listening, and what they open.
  const once = (event: string) => {
    const seen = new Set<string>()
    return input.events
      .filter((e) => e.event === event)
      .filter((e) => {
        const k = `${idOf(e.campaign)}|${String(e.email ?? '').toLowerCase()}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .map((e) => e.occurredAt)
  }
  const enquirySources = new Map<string, number>()
  for (const l of inPeriod.filter((l) => isInbound(l.source))) enquirySources.set(l.source!, (enquirySources.get(l.source!) ?? 0) + 1)
  const marketing = {
    subscribers: count(input.subscribers.map((s) => s.confirmedAt), p),
    unsubscribed: count(input.subscribers.map((s) => s.unsubscribedAt), p),
    listening: input.subscribers.filter((s) => s.status === 'subscribed').length,
    delivered: count(once('delivered'), p),
    opened: count(once('opened'), p),
    clicked: count(once('clicked'), p),
    pitchesMade: count(input.pitches.map((x) => x.createdAt), p),
    pitchesOpened: count(input.pitches.map((x) => x.firstViewedAt), p),
    enquiriesBySource: [...enquirySources].map(([source, n]) => ({ source, count: n })).sort((a, b) => b.count - a.count),
  }

  // Team: each person's work in the period, and what the team cost and earned.
  const reports = input.reports.filter((r) => within(r.date, p.from, p.to))
  const prevReports = p.prevFrom ? input.reports.filter((r) => within(r.date, p.prevFrom, p.prevTo)) : []
  const onTime = (list: typeof reports) => (list.length ? Math.round((list.filter((r) => r.onTime).length / list.length) * 100) : null)
  const active = input.people.filter((x) => ['active', 'on-leave', 'on-notice'].includes(x.status ?? ''))
  const team = {
    active: active.length,
    reportsOnTime: { now: onTime(reports), prev: p.prevFrom ? onTime(prevReports) : null } as Ratio,
    people: active
      .map((x) => {
        const id = String(x.id)
        const mine = (r: { by?: unknown }) => idOf(r.by) === id
        return {
          id,
          name: x.name || x.email || 'Someone',
          found: inPeriod.filter((l) => idOf(l.owner) === id).length,
          messaged: rows.filter((r) => r.type === 'first-message' && mine(r) && within(r.at, p.from, p.to)).length,
          replies: rows.filter((r) => r.type === 'reply' && idOf(r.lead.owner) === id && within(r.at, p.from, p.to)).length,
          won: won.filter((d) => idOf(d.creditTo) === id && within(d.acceptedAt, p.from, p.to)).length,
          reports: reports.filter((r) => idOf(r.user) === id).length,
        }
      })
      .sort((a, b) => b.won - a.won || b.messaged - a.messaged),
    commissionGHS: { now: sumIn(payments.map((x) => ({ at: x.clearedAt, minor: x.commissionGHSMinor ?? 0 })), p.from, p.to), prev: p.prevFrom ? sumIn(payments.map((x) => ({ at: x.clearedAt, minor: x.commissionGHSMinor ?? 0 })), p.prevFrom, p.prevTo) : null },
    costGHS: { now: sumIn(input.payouts.map((x) => ({ at: x.paidAt, minor: x.amountGHSMinor ?? 0 })), p.from, p.to), prev: p.prevFrom ? sumIn(input.payouts.map((x) => ({ at: x.paidAt, minor: x.amountGHSMinor ?? 0 })), p.prevFrom, p.prevTo) : null },
  }

  // Money: what came in, what was invoiced, what is still owed now.
  const today = now.toISOString()
  const owed = new Map<string, { owed: number; overdue: number; invoices: number }>()
  for (const inv of invoices) {
    if (!inv.issuedAt || inv.status === 'paid') continue
    const left = Math.max(0, (inv.amountMinor ?? 0) - (inv.amountPaidMinor ?? 0))
    if (!left) continue
    const c = (inv.currency || 'GHS').toUpperCase()
    const o = owed.get(c) ?? { owed: 0, overdue: 0, invoices: 0 }
    o.owed += left
    o.invoices += 1
    if (inv.status === 'overdue' || (inv.dueDate && Date.parse(inv.dueDate) < Date.parse(today) - DAY)) o.overdue += left
    owed.set(c, o)
  }
  const retainers = deals.filter((d) => d.recurring && d.acceptedAt && ['accepted', 'active'].includes(d.dealStatus ?? '') && (!d.endedAt || d.endedAt > today))
  const monthly = new Map<string, number>()
  for (const d of retainers) {
    const c = (d.currency || 'GHS').toUpperCase()
    monthly.set(c, (monthly.get(c) ?? 0) + Math.round((d.total ?? 0) * 100))
  }
  const moneyFigures = {
    collected: money(payments.filter((x) => (x.amountMinor ?? 0) > 0).map((x) => ({ at: x.clearedAt, currency: x.currency, minor: x.amountMinor ?? 0 })), p),
    refunded: money(payments.filter((x) => (x.amountMinor ?? 0) < 0).map((x) => ({ at: x.clearedAt, currency: x.currency, minor: -(x.amountMinor ?? 0) })), p),
    invoiced: money(invoices.filter((x) => x.issuedAt).map((x) => ({ at: x.issuedAt, currency: x.currency, minor: x.amountMinor ?? 0 })), p),
    owed: [...owed].map(([currency, o]) => ({ currency, ...o })),
    retainers: { count: retainers.length, monthly: [...monthly].map(([currency, minor]) => ({ currency, minor })) },
  }

  return { period: p, sales, marketing, team, money: moneyFigures }
}

export type Performance = ReturnType<typeof buildPerformance>
