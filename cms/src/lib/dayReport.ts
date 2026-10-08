import type { PayloadRequest } from 'payload'

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)

/**
 * A day's report again, so its counts take in work put under that day after
 * it was sent: an item, a lead or a message added from the day's page
 * (lib/workDay.ts). Nothing happens when the day has no report.
 */
export async function refreshDayReport(req: PayloadRequest, user: unknown, date: string) {
  const r = await req.payload.find({ collection: 'daily-reports', where: { and: [{ user: { equals: idOf(user) } }, { date: { equals: date } }] }, limit: 1, depth: 0, overrideAccess: true, req })
  const report = r.docs[0]
  if (report) await req.payload.update({ collection: 'daily-reports', id: report.id, data: { typed: report.typed } as never, overrideAccess: true, req, context: { refreshItems: true } })
}
