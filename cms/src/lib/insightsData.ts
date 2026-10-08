import type { PayloadRequest } from 'payload'
import { buildInsights, lastMonths, type InsightInput, type Insights } from './insights'

/**
 * Loads what the insights need (lib/insights) for the last `count` months and
 * works them out. Only the fields the figures use are read, so a year of leads
 * stays small. Ernest only: the endpoint on daily-reports checks that.
 */
export async function loadInsights(req: PayloadRequest, count: number, now = new Date()): Promise<Insights> {
  const months = lastMonths(count, now)
  const from = `${months[0]}-01T00:00:00.000Z`
  const all = <T>(collection: string, where: Record<string, unknown>, select: Record<string, unknown>) =>
    req.payload
      .find({ collection: collection as never, where: where as never, select: select as never, depth: 0, limit: 0, pagination: false, overrideAccess: true, req })
      .then((r) => r.docs as unknown as T[])

  const [people, leads, quotes, deals, payments, reports] = await Promise.all([
    all<InsightInput['people'][number]>('users', { role: { equals: 'team' } }, { name: true, email: true, status: true }),
    all<InsightInput['leads'][number]>(
      'leads',
      { or: [{ loggedAt: { greater_than_equal: from } }, { countsOn: { greater_than_equal: from } }, { 'activity.recordedAt': { greater_than_equal: from } }] },
      { owner: true, loggedAt: true, countsOn: true, status: true, activity: { type: true, by: true, at: true, recordedAt: true, direction: true } },
    ),
    all<InsightInput['quotes'][number]>('quote-requests', { createdAt: { greater_than_equal: from } }, { lead: true, requestedBy: true, createdAt: true }),
    all<InsightInput['deals'][number]>('proposals', { acceptedAt: { greater_than_equal: from } }, { lead: true, creditTo: true, acceptedAt: true, dealStatus: true }),
    all<InsightInput['payments'][number]>('client-payments', { clearedAt: { greater_than_equal: from } }, { creditTo: true, creditType: true, clearedAt: true, amountGHSMinor: true }),
    all<InsightInput['reports'][number]>('daily-reports', { date: { greater_than_equal: from } }, { user: true, date: true, onTime: true }),
  ])

  // A lead logged before the window can still be quoted or won inside it; the
  // conversion figures only follow leads logged inside it, so this is enough.
  return buildInsights({ people, leads, quotes, deals, payments, reports }, months)
}
