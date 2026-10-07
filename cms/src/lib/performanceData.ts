import type { Endpoint, PayloadRequest } from 'payload'
import { hasRole } from '../access/roles'
import { PERIOD_KEYS, buildPerformance, periodOf, type Performance, type PerformanceInput, type PeriodKey } from './performance'

/**
 * Reads what the dashboard needs (lib/performance) and works it out. Only the
 * fields the figures use are read; the period and the one before it bound the
 * dated records, and the leads are read whole because the open pipeline is
 * counted from all of them.
 */
export async function loadPerformance(req: PayloadRequest, key: PeriodKey, now = new Date()): Promise<Performance> {
  const all = <T>(collection: string, select: Record<string, unknown>, where: Record<string, unknown> = {}) =>
    req.payload
      .find({ collection: collection as never, where: where as never, select: select as never, depth: 0, limit: 0, pagination: false, overrideAccess: true, req })
      .then((r) => r.docs as unknown as T[])

  // "So far" starts at the first record: the earliest lead, payment or deal.
  let first: Date | null = null
  if (key === 'all') {
    const earliest = await Promise.all(
      [
        ['leads', 'loggedAt'],
        ['client-payments', 'clearedAt'],
        ['proposals', 'createdAt'],
      ].map(([c, f]) => req.payload.find({ collection: c as never, sort: f, limit: 1, depth: 0, select: { [f]: true } as never, overrideAccess: true, req }).then((r) => (r.docs[0] as Record<string, string> | undefined)?.[f])),
    )
    const dates = earliest.filter(Boolean).map((d) => new Date(String(d)))
    first = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null
  }
  const p = periodOf(key, now, first)
  const since = p.prevFrom ?? p.from
  const after = (field: string) => ({ [field]: { greater_than_equal: since } })

  const [leads, priceRequests, deals, payments, invoices, subscribers, events, pitches, people, reports, payouts] = await Promise.all([
    all<PerformanceInput['leads'][number]>('leads', { loggedAt: true, createdAt: true, source: true, status: true, owner: true, activity: { type: true, at: true, by: true } }),
    all<PerformanceInput['priceRequests'][number]>('quote-requests', { createdAt: true }, after('createdAt')),
    all<PerformanceInput['deals'][number]>('proposals', { lead: true, quoteSentAt: true, acceptedAt: true, declinedAt: true, service: true, currency: true, total: true, recurring: true, dealStatus: true, endedAt: true, creditTo: true }),
    all<PerformanceInput['payments'][number]>('client-payments', { clearedAt: true, currency: true, amountMinor: true, commissionGHSMinor: true }, after('clearedAt')),
    all<PerformanceInput['invoices'][number]>('invoices', { issuedAt: true, currency: true, amountMinor: true, amountPaidMinor: true, status: true, dueDate: true }),
    all<PerformanceInput['subscribers'][number]>('subscribers', { confirmedAt: true, unsubscribedAt: true, status: true }),
    all<PerformanceInput['events'][number]>('campaignEvents', { event: true, occurredAt: true, campaign: true, email: true }, after('occurredAt')),
    all<PerformanceInput['pitches'][number]>('pitches', { createdAt: true, firstViewedAt: true }),
    all<PerformanceInput['people'][number]>('users', { name: true, email: true, status: true }, { role: { equals: 'team' } }),
    all<PerformanceInput['reports'][number]>('daily-reports', { user: true, date: true, onTime: true }, after('date')),
    all<PerformanceInput['payouts'][number]>('payouts', { paidAt: true, amountGHSMinor: true }, after('paidAt')),
  ])
  return buildPerformance({ leads, priceRequests, deals, payments, invoices, subscribers, events, pitches, people, reports, payouts }, p, now)
}

/** A minute is fresh enough for a dashboard, and a busy morning of reloads reads the records once. */
const cache = new Map<string, { at: number; data: Performance }>()

/** GET /api/dashboard?period=month: the founder's dashboard. Admin only. */
export const dashboardEndpoint: Endpoint = {
  path: '/dashboard',
  method: 'get',
  handler: async (req) => {
    if (!hasRole(req.user, 'admin')) return Response.json({ error: 'Only Ernest sees the dashboard.' }, { status: req.user ? 403 : 401 })
    const asked = String(req.searchParams?.get('period') ?? 'month')
    const key = (PERIOD_KEYS as string[]).includes(asked) ? (asked as PeriodKey) : 'month'
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < 60_000) return Response.json(hit.data, { headers: { 'Cache-Control': 'no-store' } })
    const data = await loadPerformance(req, key)
    cache.set(key, { at: Date.now(), data })
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } })
  },
}
