import type { PayloadRequest } from 'payload'

/**
 * Days a person is not expected to work (spec 5.11 and 14.6): their approved
 * time off, exam days and sick days, and the public holidays of their own
 * country. On such a day no daily report is expected, a missing one is not
 * counted, and each one lowers the reports needed for the next data allowance.
 *
 * All dates are yyyy-mm-dd in Accra, which is UTC all year.
 */

export type OffKind = 'time-off' | 'exam' | 'sick' | 'holiday'
export type OffDay = { date: string; kind: OffKind; name?: string }

export const ymd = (d: Date | string) => new Date(d).toISOString().slice(0, 10)
export const isWeekend = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 || day === 6
}

/** Every date from `from` to `to`, both included. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  const d = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (d <= end && out.length < 800) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

/** Public holidays for a country, as date → name. */
export async function holidaysFor(req: PayloadRequest, country: string | null | undefined): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!country) return out
  const s = (await req.payload.findGlobal({ slug: 'ops-settings', depth: 0, overrideAccess: true, req }).catch(() => null)) as {
    publicHolidays?: { country?: string; date?: string; name?: string }[]
  } | null
  for (const h of s?.publicHolidays ?? []) {
    if (h.date && String(h.country).toUpperCase() === String(country).toUpperCase()) out.set(ymd(h.date), h.name || 'Public holiday')
  }
  return out
}

/** Approved time off overlapping [from, to]. */
async function approvedTimeOff(req: PayloadRequest, userId: number, from: string, to: string) {
  const res = await req.payload.find({
    collection: 'time-off',
    where: { and: [{ member: { equals: userId } }, { status: { equals: 'approved' } }, { from: { less_than_equal: `${to}T23:59:59.999Z` } }, { to: { greater_than_equal: `${from}T00:00:00.000Z` } }] },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return res.docs as { from: string; to: string; kind: OffKind }[]
}

/**
 * The working days (Monday to Friday) in [from, to] that this person is off,
 * by date. A holiday that falls inside time off counts once, as the holiday.
 */
export async function offDays(req: PayloadRequest, user: { id: number; country?: string | null }, from: string, to: string): Promise<Map<string, OffDay>> {
  const out = new Map<string, OffDay>()
  if (from > to) return out
  const [holidays, timeOff] = await Promise.all([holidaysFor(req, user.country), approvedTimeOff(req, user.id, from, to)])
  for (const t of timeOff) {
    for (const date of eachDay(ymd(t.from) < from ? from : ymd(t.from), ymd(t.to) > to ? to : ymd(t.to))) {
      if (!isWeekend(date)) out.set(date, { date, kind: t.kind })
    }
  }
  for (const [date, name] of holidays) {
    if (date >= from && date <= to && !isWeekend(date)) out.set(date, { date, kind: 'holiday', name })
  }
  return out
}

/** Is this person off today (or on `date`)? */
export async function offOn(req: PayloadRequest, user: { id: number; country?: string | null }, date = ymd(new Date())) {
  return (await offDays(req, user, date, date)).get(date) ?? null
}

/**
 * Is `date` in a week with approved exam days? Then the reports that week use
 * the lighter standard (spec 5.11, Agreement §4). Weeks run Monday to Sunday.
 */
export async function inExamWeek(req: PayloadRequest, userId: number, date: string) {
  const d = new Date(`${date}T00:00:00Z`)
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  const res = await req.payload.count({
    collection: 'time-off',
    where: {
      and: [
        { member: { equals: userId } },
        { status: { equals: 'approved' } },
        { kind: { equals: 'exam' } },
        { from: { less_than_equal: `${ymd(sunday)}T23:59:59.999Z` } },
        { to: { greater_than_equal: `${ymd(monday)}T00:00:00.000Z` } },
      ],
    },
    overrideAccess: true,
    req,
  })
  return res.totalDocs > 0
}

/** The lighter standard in an exam week: half of each target, rounded up. */
export const lighter = (target: number | null) => (target == null ? null : Math.ceil(target / 2))

/**
 * Reports needed for a data allowance (decided 3 October 2026): the figure in
 * the person's terms, less one for each working day off since the last
 * allowance, approved time off and public holidays alike. The first allowance
 * needs none.
 */
export async function reportsNeeded(req: PayloadRequest, user: { id: number; country?: string | null }, base: number, since: string | null | undefined, until: string) {
  if (!since) return { needed: base, off: 0 }
  const off = await offDays(req, user, ymd(since), ymd(until))
  return { needed: Math.max(0, base - off.size), off: off.size }
}
