import { parseRate } from '../fields/terms'

/**
 * The money rules, as plain functions with no database, so they can be tested
 * against the worked examples in the spec (section 12, tests 3 to 7, 19, 25)
 * and every caller gets the same answer.
 *
 * All amounts are integers in minor units (pesewas, kobo, cents). Rates are
 * exact fractions, so one third of GH₵4,000 is 133,333 pesewas and not a
 * floating point approximation of it.
 */

export type Fraction = { num: number; den: number }
export const ZERO: Fraction = { num: 0, den: 1 }

/** The commission terms of the person credited, as written on their terms. */
export type CommissionTerms = {
  share?: string | null
  retainerFromMonth?: number | null
  retainerRate?: string | null
  afterSalaryRate?: string | null
}

export type CommissionInput = {
  /** What the client paid, converted to GH₵. Negative for a refund. */
  amountGHSMinor: number
  /** The allowed costs on this payment, in GH₵. */
  costsGHSMinor: number
  /** Someone is credited with the deal. Ernest's own and inbound deals earn nothing. */
  credited: boolean
  /** The deal is a retainer. */
  recurring: boolean
  /** Which month of the retainer this payment covers: 1 for the first. */
  retainerMonth: number
  /** The deal was accepted on or after the credited person's salary started. */
  startedAfterSalary: boolean
  terms: CommissionTerms | null | undefined
  /**
   * When the credited person's agreement has ended (Agreement §11). Leave out
   * while they are on the team.
   */
  exit?: {
    endedAt: string
    /** The day this payment cleared. */
    clearedAt: string
    /** The lead was logged by them, or handed to them, before the end date. */
    leadBeforeEnd: boolean
    /** When the deal was accepted, and when its first payment cleared. */
    acceptedAt?: string | null
    firstPaymentAt?: string | null
  } | null
}

export type CommissionResult = {
  rate: Fraction
  rateText: string
  reason: string
  netGHSMinor: number
  commissionGHSMinor: number
}

const days = (from: string, to: string) => (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000

/** Round half away from zero, so a refund mirrors the payment it undoes. */
export const roundMinor = (x: number) => Math.sign(x) * Math.round(Math.abs(x))

export const applyRate = (minor: number, rate: Fraction) => (rate.num === 0 ? 0 : roundMinor((minor * rate.num) / rate.den))

/**
 * Which rate applies, and why (spec 5.2, with the rates from the person's own
 * terms, 14.3). In order: no one credited earns nothing; after the salary
 * starts, the after-salary rate; a retainer from its later month, the retainer
 * rate; otherwise the share. After an agreement ends, §11 narrows it further.
 */
export function pickRate(input: Omit<CommissionInput, 'amountGHSMinor' | 'costsGHSMinor'>): { rate: Fraction; rateText: string; reason: string } {
  const t = input.terms ?? {}
  const fromMonth = t.retainerFromMonth ?? 4
  const as = (text: string | null | undefined, reason: string) => {
    const r = parseRate(text)
    return r ? { rate: r, rateText: String(text).trim(), reason } : { rate: ZERO, rateText: '0', reason: `${reason}, but no rate is set in their terms` }
  }
  const none = (reason: string) => ({ rate: ZERO, rateText: '0', reason })

  if (!input.credited) return none('Nobody is credited with this deal')

  if (input.exit) {
    const { endedAt, clearedAt } = input.exit
    if (clearedAt > endedAt) {
      if (input.startedAfterSalary) return none('Deals started after the salary earn nothing once the agreement has ended')
      if (input.recurring) {
        return input.retainerMonth < fromMonth
          ? as(t.share, `Retainer month ${input.retainerMonth}, still earned after the agreement ended`)
          : none(`Retainer month ${input.retainerMonth} after the agreement ended earns nothing`)
      }
      const within = (d?: string | null) => Boolean(d) && days(endedAt, d!) <= 60
      if (!(input.exit.leadBeforeEnd && within(input.exit.acceptedAt) && within(input.exit.firstPaymentAt))) {
        return none('Accepted or first paid more than 60 days after the agreement ended')
      }
    }
  }

  if (input.startedAfterSalary) return as(t.afterSalaryRate, 'The deal started after their salary')
  if (input.recurring && input.retainerMonth >= fromMonth) return as(t.retainerRate, `Retainer month ${input.retainerMonth}`)
  return as(t.share, input.recurring ? `Retainer month ${input.retainerMonth}` : 'A new deal')
}

export function commission(input: CommissionInput): CommissionResult {
  const picked = pickRate(input)
  const netGHSMinor = input.amountGHSMinor - Math.max(0, input.costsGHSMinor)
  return { ...picked, netGHSMinor, commissionGHSMinor: applyRate(netGHSMinor, picked.rate) }
}

/**
 * GH₵ into someone's own currency at `perGHS` units for one cedi. Cedis stay
 * exact to the pesewa; any other currency is rounded to whole units, the way it
 * is paid: ₦153,279.62 is ₦153,280.
 */
export const ghsToLocalMinor = (ghsMinor: number, perGHS: number, currency = 'NGN') =>
  currency === 'GHS' ? ghsMinor : roundMinor((ghsMinor * perGHS) / 100) * 100

/** An amount in another currency into GH₵, at `perGHS` units of it for one cedi. */
export const toGHSMinor = (minor: number, perGHS: number) => (perGHS > 0 ? roundMinor(minor / perGHS) : 0)

/**
 * Is a data allowance payment due (Agreement §5)? The first one always is.
 * After that, only with enough daily reports since the previous allowance.
 */
export function allowanceEligible(input: { isFirst: boolean; reportsSince: number; reportsNeeded: number }) {
  return input.isFirst || input.reportsSince >= input.reportsNeeded
}

/** Seven days after the money cleared (Agreement §6). */
export const dueDate = (clearedAt: string, daysToPay = 7) => new Date(new Date(clearedAt).getTime() + daysToPay * 86_400_000).toISOString()

export type CommissionState = 'none' | 'due' | 'overdue' | 'paid'
export const commissionState = (p: { commissionGHSMinor?: number | null; payout?: unknown; commissionDueAt?: string | null }, now = new Date()): CommissionState => {
  if (!p.commissionGHSMinor) return 'none'
  if (p.payout) return 'paid'
  return p.commissionDueAt && new Date(p.commissionDueAt) < now ? 'overdue' : 'due'
}
