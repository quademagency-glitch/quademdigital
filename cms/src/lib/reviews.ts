import type { PayloadRequest } from 'payload'
import { refId, termsOn, rateFor, userById } from './moneyContext'
import { adminIds, notify, teamIds } from './notify'
import { ghsToLocalMinor } from './money'
import { eachDay, isWeekend, offDays } from './offDays'
import { paidDeals } from './paidDeals'
import { rowDay } from './reportCounts'

/**
 * The monthly review (spec 5.4, Agreement §4): the figures for one person's
 * month, worked out from the pipeline, their reports and their money, and the
 * missed-month counter.
 */

/** "2026-10" → its first and last day, and the start of the next month. */
export const monthBounds = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1))
  const next = new Date(Date.UTC(y, m, 1))
  return { first: first.toISOString().slice(0, 10), last: new Date(next.getTime() - 86_400_000).toISOString().slice(0, 10), next: next.toISOString() }
}
export const monthOf = (d: string | Date) => new Date(d).toISOString().slice(0, 7)
export const addMonths = (month: string, n: number) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}
/** Month 1 is the calendar month the person started in. */
export const monthNumber = (startDate: string | null | undefined, month: string) => {
  if (!startDate) return 1
  const [sy, sm] = monthOf(startDate).split('-').map(Number)
  const [y, m] = month.split('-').map(Number)
  return (y - sy) * 12 + (m - sm) + 1
}

/**
 * The missed-month counter (Agreement §4, test 8). Months up to `grace` are
 * not counted. After that, each month with no counted deal adds one, and any
 * month with a counted deal resets it to nought. Handed-over deals count.
 * `counted[i]` is the counted deals in month i + 1.
 */
export function missedCounter(counted: number[], grace = 2): number {
  let n = 0
  counted.forEach((c, i) => {
    if (i + 1 <= grace) n = 0
    else n = c > 0 ? 0 : n + 1
  })
  return n
}

export type MissedLevel = 'none' | 'meeting' | 'end'
export const missedLevel = (counter: number, meetingAt = 2, endAt = 3): MissedLevel => (counter >= endAt ? 'end' : counter >= meetingAt ? 'meeting' : 'none')

/** Last Friday of the month that `date` is in? */
/** The answers on a review: what the person writes, and the training rows and trial readiness. */
export const REVIEW_ANSWERS = ['whatWorked', 'gotInTheWay', 'changesNextMonth', 'training', 'readyForTrial'] as const

type TrainingRow = { area?: string | null; progress?: string | null; note?: string | null }
const answerOf = (key: string, v: unknown) =>
  key === 'training'
    ? (Array.isArray(v) ? (v as TrainingRow[]) : []).map((r) => [String(r.area ?? '').trim(), r.progress || 'not-started', String(r.note ?? '').trim()])
    : String(v ?? '').trim()

/**
 * Did this save change an answer? Compares what was written, not how it is
 * stored: the portal sends the training rows without their row ids and empty
 * answers as null, and either would otherwise look like a change on every save,
 * clearing the other side's agreement so a review could never lock.
 */
export const answersChanged = (data: Record<string, unknown>, original: Record<string, unknown> | undefined) =>
  REVIEW_ANSWERS.some((k) => k in data && JSON.stringify(answerOf(k, data[k])) !== JSON.stringify(answerOf(k, original?.[k])))

export const isLastFriday = (date: Date) => date.getUTCDay() === 5 && new Date(date.getTime() + 7 * 86_400_000).getUTCMonth() !== date.getUTCMonth()

type Row = { type?: string | null; by?: unknown; recordedAt?: string | null }

/** Everything filled in automatically on one person's review for `month`. */
export async function reviewFigures(req: PayloadRequest, memberId: number, month: string) {
  const person = await userById(req, memberId)
  const { first, last, next } = monthBounds(month)
  const startIso = `${first}T00:00:00.000Z`
  const today = new Date().toISOString().slice(0, 10)
  const until = last < today ? last : today

  // Working days so far, less their days off.
  const off = await offDays(req, { id: memberId, country: person?.country }, first, until)
  const workingDays = eachDay(first, until).filter((d) => !isWeekend(d) && !off.has(d)).length

  const find = (collection: 'daily-reports' | 'leads' | 'client-payments', where: Record<string, unknown>) =>
    req.payload.find({ collection, where: where as never, limit: 2000, depth: 0, overrideAccess: true, req, pagination: false })

  const [reports, researched, touched, payments, allPayments] = await Promise.all([
    find('daily-reports', { and: [{ user: { equals: memberId } }, { date: { greater_than_equal: startIso } }, { date: { less_than: next } }] }),
    find('leads', { and: [{ owner: { equals: memberId } }, { countsOn: { greater_than_equal: startIso } }, { countsOn: { less_than: next } }] }),
    find('leads', { and: [{ 'activity.by': { equals: memberId } }, { or: [{ and: [{ 'activity.recordedAt': { greater_than_equal: startIso } }, { 'activity.recordedAt': { less_than: next } }] }, { and: [{ 'activity.countsOn': { greater_than_equal: startIso } }, { 'activity.countsOn': { less_than: next } }] }] }] }),
    find('client-payments', { and: [{ creditTo: { equals: memberId } }, { clearedAt: { greater_than_equal: startIso } }, { clearedAt: { less_than: next } }] }),
    // Every payment credited to them: a deal counts in the month its first payment cleared (lib/paidDeals.ts).
    find('client-payments', { creditTo: { equals: memberId } }),
  ])
  const paid = paidDeals(allPayments.docs as never)
  const paidThisMonth = paid.filter((d) => d.month === month)

  let firstMessages = 0
  let followUps = 0
  let replies = 0
  let proposalsSent = 0
  for (const lead of touched.docs) {
    for (const row of ((lead as { activity?: Row[] }).activity ?? []) as Row[]) {
      const when = rowDay(row as never)
      if (String(refId(row.by)) !== String(memberId) || !when) continue
      if (when < startIso || when >= next) continue
      if (row.type === 'first-message') firstMessages++
      else if (row.type === 'follow-up') followUps++
      else if (row.type === 'reply') replies++
      else if (row.type === 'proposal-sent') proposalsSent++
    }
  }

  const commissionGHSMinor = payments.docs.reduce((n, p) => n + Number((p as { commissionGHSMinor?: number }).commissionGHSMinor ?? 0), 0)
  const currency = String(person?.currency || 'GHS')
  const fx = await rateFor(req, currency)

  // The counter runs over every month from their start to this one.
  const terms = await termsOn(req, memberId, until)
  const grace = Number(terms?.missedMonths?.graceMonths ?? 2)
  const n = monthNumber(person?.startDate, month)
  const counted: number[] = []
  for (let i = 1; i <= n; i++) {
    const m = addMonths(month, i - n)
    counted.push(paid.filter((d) => d.month === m).length)
  }
  const counter = missedCounter(counted, grace)
  const level = missedLevel(counter, Number(terms?.missedMonths?.meetingAt ?? 2), Number(terms?.missedMonths?.endAt ?? 3))

  return {
    monthNumber: n,
    figures: {
      workingDays,
      daysOff: off.size,
      reportsSent: reports.docs.length,
      reportsOnTime: reports.docs.filter((r) => (r as { onTime?: boolean }).onTime).length,
      researched: researched.docs.length,
      firstMessages,
      followUps,
      replies,
      proposalsSent,
      countedSourced: paidThisMonth.filter((d) => !d.handed).length,
      countedHanded: paidThisMonth.filter((d) => d.handed).length,
      commissionGHSMinor,
      currency,
      fxRate: fx,
      commissionLocalMinor: fx ? ghsToLocalMinor(commissionGHSMinor, fx, currency) : null,
    },
    missed: {
      counter,
      level,
      note:
        n <= grace
          ? `Month ${n}: not counted yet (the first ${grace} months are not).`
          : level === 'end'
            ? 'Agreement ends at the end of this month (Agreement §4).'
            : level === 'meeting'
              ? 'Review meeting: agree changes in writing (Agreement §4).'
              : counter
                ? `${counter} month${counter === 1 ? '' : 's'} in a row with no counted deal.`
                : 'A counted deal resets the counter to nought.',
    },
  }
}

const ON_TEAM = ['active', 'on-leave', 'on-notice']

/**
 * The last Friday of the month, from 09:00 Accra: everyone on the team gets
 * this month's review, with their job role's training areas listed (spec 5.4).
 */
export async function ensureMonthlyReviews(req: PayloadRequest, now: Date) {
  if (!isLastFriday(now) || now.getUTCHours() < 9 || now.getUTCHours() >= 12) return
  const month = monthOf(now)
  for (const person of await teamIds(req, ON_TEAM)) {
    const existing = await req.payload.find({ collection: 'monthly-reviews', where: { and: [{ member: { equals: person.id } }, { month: { equals: month } }] }, limit: 1, depth: 0, overrideAccess: true, req })
    if (existing.docs.length) continue
    await req.payload
      .create({
        collection: 'monthly-reviews',
        data: { member: person.id, month } as never,
        overrideAccess: true,
        req,
      })
      .catch((err) => req.payload.logger.error({ err, person: person.id }, 'Could not make a monthly review'))
  }
}

/**
 * The first days of a month: the counter for the month just ended is final.
 * Its open review is worked out again, and a review meeting or the end of the
 * agreement is recorded as a warning and told to both (Agreement §4).
 */
export async function settleMissedMonths(req: PayloadRequest, now: Date) {
  if (now.getUTCDate() > 3 || now.getUTCHours() < 7 || now.getUTCHours() >= 12) return
  const month = addMonths(monthOf(now), -1)
  for (const person of await teamIds(req, ON_TEAM)) {
    const reviews = await req.payload.find({ collection: 'monthly-reviews', where: { and: [{ member: { equals: person.id } }, { month: { equals: month } }] }, limit: 1, depth: 0, overrideAccess: true, req })
    const review = reviews.docs[0] as { id: number; status?: string } | undefined
    if (!review) continue
    if (review.status === 'open') {
      await req.payload.update({ collection: 'monthly-reviews', id: review.id, data: {}, overrideAccess: true, req }).catch(() => undefined)
    }
    const { missed } = await reviewFigures(req, person.id, month)
    if (missed.level === 'none') continue
    const kind = missed.level === 'end' ? 'missed-end' : 'missed-meeting'
    const done = await req.payload.count({ collection: 'warnings', where: { and: [{ member: { equals: person.id } }, { kind: { equals: kind } }, { review: { equals: review.id } }] }, overrideAccess: true, req })
    if (done.totalDocs) continue
    const when = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
    await req.payload.create({
      collection: 'warnings',
      data: {
        member: person.id,
        kind,
        date: now.toISOString(),
        review: review.id,
        reason: missed.level === 'end' ? `${missed.counter} months in a row with no counted deal, to ${when}: the agreement ends at the end of this month` : `${missed.counter} months in a row with no counted deal, to ${when}: review meeting to agree changes in writing`,
        detail: 'Agreement §4. Handed-over deals count. Any month with a counted deal resets the counter to nought.',
      } as never,
      overrideAccess: true,
      req,
    })
    if (missed.level === 'end') {
      await notify(req, { to: await adminIds(req), kind: 'warning', title: `${person.name || 'A team member'}: the agreement ends at the end of this month`, body: `${missed.counter} months in a row with no counted deal (Agreement §4).`, link: `/people/${person.id}`, action: 'Open their page', key: `missed-end:${person.id}:${month}` })
    }
  }
}
