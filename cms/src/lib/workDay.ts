/*
  The day work counts for (approved by Ernest on 8 October 2026). Opening a
  day on the calendar, a team member can put leads and work under it: a
  missed day filled in, or a day to come prepared ahead. The time anything
  is saved is still stamped and decides who found a business first; this is
  only which day's report it counts toward.

  A team member may use a working day from BACK_DAYS back to AHEAD_DAYS
  ahead, never before they started; Ernest may use any day. A report can be
  sent for today or a missed day, never ahead. Days are Accra days, which
  are UTC days. Pure, so the rules are tested.
*/

export const BACK_DAYS = 7
export const AHEAD_DAYS = 14
const DAY = 86_400_000

/** "2026-10-08" for any time on that day. */
export const dayOf = (d: string | Date) => new Date(d).toISOString().slice(0, 10)
export const startOfDay = (d: string | Date) => `${dayOf(d)}T00:00:00.000Z`

/** Why a team member cannot put work under `day`, or null. `ahead: 0` is for a report. */
export function dayProblem(day: string, today: string, opts: { back?: number; ahead?: number; startDate?: string | null } = {}): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) return 'Choose a day.'
  const back = opts.back ?? BACK_DAYS
  const ahead = opts.ahead ?? AHEAD_DAYS
  const t = Date.parse(`${day}T00:00:00Z`)
  const n = Date.parse(`${today}T00:00:00Z`)
  if (t > n) {
    if (!ahead) return 'That day has not come yet.'
    if (t > n + ahead * DAY) return `That is more than ${ahead} days ahead.`
  }
  if (t < n - back * DAY) return `That is more than ${back} days back. Ask Ernest for anything older.`
  if (day !== today && [0, 6].includes(new Date(t).getUTCDay())) return 'Choose a working day, Monday to Friday.'
  if (opts.startDate && day < dayOf(opts.startDate)) return 'That is before you started.'
  return null
}

/** The day a message counts for: the day it was sent when that was an earlier day within reach, otherwise the day it is recorded. */
export function messageDay(at: string | Date, recordedAt: string | Date, back = BACK_DAYS): string | null {
  const sent = dayOf(at)
  const recorded = dayOf(recordedAt)
  if (sent >= recorded) return null
  return Date.parse(`${sent}T00:00:00Z`) >= Date.parse(`${recorded}T00:00:00Z`) - back * DAY ? startOfDay(sent) : null
}
