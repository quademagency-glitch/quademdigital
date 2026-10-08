import type { PayloadRequest } from 'payload'
import { addWorkingDays } from './workingDays'

/**
 * The counts on a daily report (spec 5.1), worked out from the pipeline so
 * nobody types them.
 *
 * - Researched: leads the person found (`owner`) that count on that day
 *   (`countsOn`: the day they were logged, or a day chosen on the calendar,
 *   lib/workDay.ts). A lead handed to them does not count here.
 * - First messages, follow-ups and replies: history rows they wrote, on the
 *   day the row was written (`recordedAt`), or, for a message sent on an
 *   earlier day within reach and recorded later, on the day it was sent
 *   (`countsOn`). Anything later than its day is marked on the report.
 * - Follow-ups due: the ones done that day plus the ones still waiting with a
 *   date on or before it. The standard is all of them.
 *
 * Days are Accra days, which are UTC days.
 */

export type ReportCounts = {
  researchedCount: number
  firstMessagesCount: number
  followUpsDoneCount: number
  followUpsDueCount: number
  repliesCount: number
  followUpsDueTomorrow: { id: number | string; title: string }[]
}

export const dayBounds = (date: string | Date) => {
  const start = new Date(date)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(start.getTime() + 86_400_000 - 1)
  return { start, end }
}

type Row = { type?: string | null; by?: unknown; recordedAt?: string | null; countsOn?: string | null }

/** The day a history row counts on. */
export const rowDay = (row: Row) => row.countsOn ?? row.recordedAt ?? null
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)

export async function countReport(req: PayloadRequest, userId: number | string, date: string | Date): Promise<ReportCounts> {
  const { start, end } = dayBounds(date)
  const s = start.toISOString()
  const e = end.toISOString()
  const find = (where: Record<string, unknown>) =>
    req.payload.find({ collection: 'leads', where: where as never, limit: 1000, depth: 0, overrideAccess: true, req, pagination: false })

  const [researched, touched, waiting, tomorrow] = await Promise.all([
    find({ and: [{ owner: { equals: userId } }, { countsOn: { greater_than_equal: s } }, { countsOn: { less_than_equal: e } }] }),
    find({ or: [{ and: [{ 'activity.recordedAt': { greater_than_equal: s } }, { 'activity.recordedAt': { less_than_equal: e } }] }, { and: [{ 'activity.countsOn': { greater_than_equal: s } }, { 'activity.countsOn': { less_than_equal: e } }] }] }),
    find({ and: [{ assignedTo: { equals: userId } }, { nextFollowUp: { less_than_equal: e } }, { status: { in: ['contacted'] } }] }),
    (() => {
      const next = dayBounds(addWorkingDays(start, 1))
      return find({
        and: [
          { assignedTo: { equals: userId } },
          { nextFollowUp: { greater_than_equal: next.start.toISOString() } },
          { nextFollowUp: { less_than_equal: next.end.toISOString() } },
        ],
      })
    })(),
  ])

  let first = 0
  let follow = 0
  let replies = 0
  for (const lead of touched.docs) {
    for (const row of ((lead as { activity?: Row[] }).activity ?? []) as Row[]) {
      const when = rowDay(row)
      if (String(idOf(row.by)) !== String(userId) || !when) continue
      if (when < s || when > e) continue
      if (row.type === 'first-message') first += 1
      else if (row.type === 'follow-up') follow += 1
      else if (row.type === 'reply') replies += 1
    }
  }

  return {
    researchedCount: researched.docs.length,
    firstMessagesCount: first,
    followUpsDoneCount: follow,
    followUpsDueCount: follow + waiting.docs.length,
    repliesCount: replies,
    followUpsDueTomorrow: tomorrow.docs.map((l) => ({ id: l.id, title: String((l as { title?: string }).title ?? `Lead ${l.id}`) })),
  }
}

/** The report is due before the deadline Ernest sets, 18:00 Accra unless he changes it (Agreement §2, spec 14.9). */
export const deadlineOf = (date: string | Date, hhmm = '18:00') => {
  const { start } = dayBounds(date)
  return new Date(start.getTime() + (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))) * 60_000)
}
