import type { PayloadRequest } from 'payload'

/**
 * The company's working rules, set by Ernest in the portal (spec 14.9) and
 * kept in ops-settings: when the daily report is due, how far apart the
 * follow-ups are, and which reminders go out. Each falls back to the
 * agreement's original value, so nothing changes until he changes it.
 */

export type WorkRules = {
  /** "18:00", Accra time. */
  reportDeadline: string
  /** Working days to each follow-up: after the first message, then after each follow-up. After the last, No response. */
  followUpDays: number[]
  reminders: { followUps: boolean; tasksDue: boolean; reportDue: boolean; reportMissing: boolean }
}

export const DEFAULT_RULES: WorkRules = {
  reportDeadline: '18:00',
  followUpDays: [2, 5, 10],
  reminders: { followUps: true, tasksDue: true, reportDue: true, reportMissing: true },
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/

/** What ops-settings holds, made safe: a bad or missing value falls back to the default. */
export function rulesFrom(s: Record<string, any> | null | undefined): WorkRules {
  const w = (s?.workRules ?? {}) as Record<string, any>
  const deadline = HHMM.test(String(w.reportDeadline ?? '')) ? String(w.reportDeadline) : DEFAULT_RULES.reportDeadline
  const days = [w.firstFollowUpDays, w.secondFollowUpDays, w.thirdFollowUpDays].map((d, i) => {
    const n = Math.round(Number(d))
    return Number.isFinite(n) && n >= 1 && n <= 30 ? n : DEFAULT_RULES.followUpDays[i]
  })
  const r = (w.reminders ?? {}) as Record<string, unknown>
  const on = (k: keyof WorkRules['reminders']) => (r[k] === false ? false : true)
  return { reportDeadline: deadline, followUpDays: days, reminders: { followUps: on('followUps'), tasksDue: on('tasksDue'), reportDue: on('reportDue'), reportMissing: on('reportMissing') } }
}

/** Read once per request. */
export async function workRules(req: PayloadRequest): Promise<WorkRules> {
  const ctx = req.context as Record<string, unknown>
  if (ctx.__workRules) return ctx.__workRules as WorkRules
  const s = (await req.payload.findGlobal({ slug: 'ops-settings', depth: 0, overrideAccess: true, req }).catch(() => null)) as Record<string, any> | null
  const rules = rulesFrom(s)
  ctx.__workRules = rules
  return rules
}

/** Minutes after midnight, from "18:00". */
export const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
/** "18:00" plus some minutes, as "HH:MM", never past midnight. */
export const plusMinutes = (hhmm: string, add: number) => {
  const m = Math.max(0, Math.min(23 * 60 + 59, minutesOf(hhmm) + add))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
/** Lagos is an hour ahead of Accra all year. */
export const lagosTime = (hhmm: string) => plusMinutes(hhmm, 60)

/** Working days to the next follow-up, after `followUpsSoFar` follow-ups; null when the chase is over. */
export const nextGap = (rules: Pick<WorkRules, 'followUpDays'>, followUpsSoFar: number) =>
  followUpsSoFar < rules.followUpDays.length ? rules.followUpDays[followUpsSoFar] : null
