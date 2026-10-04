import { describe, expect, it } from 'vitest'
import { allowanceEligible, applyRate, commission, commissionState, dueDate, ghsToLocalMinor, toGHSMinor } from '../../src/lib/money'

/*
  The worked examples from the spec (section 12). Each one is a test a phase
  must pass before it is signed off, so they are written here exactly as the
  spec states them.
*/

const trainee = { share: '1/3', retainerFromMonth: 4, retainerRate: '10%', afterSalaryRate: '5%' }
const base = { credited: true, recurring: false, retainerMonth: 1, startedAfterSalary: false, terms: trainee }

describe('commission (spec 5.2)', () => {
  it('test 3: a one-off deal of GH₵5,500 with GH₵1,500 of costs earns GH₵1,333.33', () => {
    const r = commission({ ...base, amountGHSMinor: 550000, costsGHSMinor: 30000 + 120000 })
    expect(r.netGHSMinor).toBe(400000)
    expect(r.rateText).toBe('1/3')
    expect(r.commissionGHSMinor).toBe(133333)
  })

  it('test 3 and 25: at ₦114.96 to GH₵1 that is ₦153,280; a Ghanaian sees GH₵1,333.33', () => {
    expect(ghsToLocalMinor(133333, 114.96, 'NGN')).toBe(15328000)
    expect(ghsToLocalMinor(133333, 1, 'GHS')).toBe(133333)
  })

  it('test 3: due seven days after the money cleared', () => {
    expect(dueDate('2026-10-12T00:00:00.000Z')).toBe('2026-10-19T00:00:00.000Z')
  })

  it('test 4: retainer month 4, GH₵1,800, no costs: 10%, GH₵180.00', () => {
    const r = commission({ ...base, recurring: true, retainerMonth: 4, amountGHSMinor: 180000, costsGHSMinor: 0 })
    expect(r.rateText).toBe('10%')
    expect(r.commissionGHSMinor).toBe(18000)
  })

  it('retainer months 1 to 3 still earn the share', () => {
    const r = commission({ ...base, recurring: true, retainerMonth: 3, amountGHSMinor: 180000, costsGHSMinor: 0 })
    expect(r.rateText).toBe('1/3')
    expect(r.commissionGHSMinor).toBe(60000)
  })

  it('test 5: after the salary, GH₵5,500 paid and GH₵100 of fees: 5%, GH₵270.00', () => {
    const r = commission({ ...base, startedAfterSalary: true, amountGHSMinor: 550000, costsGHSMinor: 10000 })
    expect(r.rateText).toBe('5%')
    expect(r.commissionGHSMinor).toBe(27000)
  })

  it('test 6: a GH₵1,000 refund on a one-third deal is −GH₵333.33', () => {
    const r = commission({ ...base, amountGHSMinor: -100000, costsGHSMinor: 0 })
    expect(r.commissionGHSMinor).toBe(-33333)
  })

  it('test 19: a handed-over deal earns the same as a sourced one', () => {
    const r = commission({ ...base, amountGHSMinor: 550000, costsGHSMinor: 150000 })
    expect(r.commissionGHSMinor).toBe(133333)
  })

  it('nobody credited: nothing', () => {
    expect(commission({ ...base, credited: false, amountGHSMinor: 550000, costsGHSMinor: 0 }).commissionGHSMinor).toBe(0)
  })

  it('no rate in their terms: nothing, and it says why', () => {
    const r = commission({ ...base, terms: {}, amountGHSMinor: 550000, costsGHSMinor: 0 })
    expect(r.commissionGHSMinor).toBe(0)
    expect(r.reason).toMatch(/no rate/)
  })
})

describe('after an agreement ends (Agreement §11)', () => {
  const exit = { endedAt: '2027-01-31T00:00:00.000Z', clearedAt: '2027-02-10T00:00:00.000Z', leadBeforeEnd: true, acceptedAt: '2027-02-05T00:00:00.000Z', firstPaymentAt: '2027-02-10T00:00:00.000Z' }
  it('retainer months 1 to 3 still earn one third', () => {
    expect(commission({ ...base, recurring: true, retainerMonth: 2, amountGHSMinor: 300000, costsGHSMinor: 0, exit }).commissionGHSMinor).toBe(100000)
  })
  it('retainer month 4 onwards earns nothing', () => {
    expect(commission({ ...base, recurring: true, retainerMonth: 4, amountGHSMinor: 300000, costsGHSMinor: 0, exit }).commissionGHSMinor).toBe(0)
  })
  it('deals started after the salary earn nothing', () => {
    expect(commission({ ...base, startedAfterSalary: true, amountGHSMinor: 300000, costsGHSMinor: 0, exit }).commissionGHSMinor).toBe(0)
  })
  it('a lead from before the end, accepted and paid within 60 days, still earns', () => {
    expect(commission({ ...base, amountGHSMinor: 300000, costsGHSMinor: 0, exit }).commissionGHSMinor).toBe(100000)
  })
  it('accepted more than 60 days after the end earns nothing', () => {
    expect(commission({ ...base, amountGHSMinor: 300000, costsGHSMinor: 0, exit: { ...exit, acceptedAt: '2027-04-15T00:00:00.000Z', firstPaymentAt: '2027-04-16T00:00:00.000Z', clearedAt: '2027-04-16T00:00:00.000Z' } }).commissionGHSMinor).toBe(0)
  })
  it('payments before the end are unaffected', () => {
    expect(commission({ ...base, recurring: true, retainerMonth: 5, amountGHSMinor: 300000, costsGHSMinor: 0, exit: { ...exit, clearedAt: '2027-01-20T00:00:00.000Z' } }).rateText).toBe('10%')
  })
})

describe('data allowance (test 7)', () => {
  it('the first payment is eligible with 0 reports', () => {
    expect(allowanceEligible({ isFirst: true, reportsSince: 0, reportsNeeded: 18 })).toBe(true)
  })
  it('the second is eligible with 20 reports and not with 10', () => {
    expect(allowanceEligible({ isFirst: false, reportsSince: 20, reportsNeeded: 18 })).toBe(true)
    expect(allowanceEligible({ isFirst: false, reportsSince: 10, reportsNeeded: 18 })).toBe(false)
  })
  it('after a salary starts it still applies, eligible with 18', () => {
    expect(allowanceEligible({ isFirst: false, reportsSince: 18, reportsNeeded: 18 })).toBe(true)
  })
})

describe('conversions and state', () => {
  it('a dollar payment into cedis', () => {
    expect(toGHSMinor(10000, 0.0833)).toBe(120048)
  })
  it('exact fractions, not floating point', () => {
    expect(applyRate(1, { num: 1, den: 3 })).toBe(0)
    expect(applyRate(2, { num: 1, den: 3 })).toBe(1)
  })
  it('due, overdue and paid', () => {
    const now = new Date('2026-10-20T00:00:00.000Z')
    expect(commissionState({ commissionGHSMinor: 0 }, now)).toBe('none')
    expect(commissionState({ commissionGHSMinor: 5, commissionDueAt: '2026-10-25T00:00:00.000Z' }, now)).toBe('due')
    expect(commissionState({ commissionGHSMinor: 5, commissionDueAt: '2026-10-19T00:00:00.000Z' }, now)).toBe('overdue')
    expect(commissionState({ commissionGHSMinor: 5, commissionDueAt: '2026-10-19T00:00:00.000Z', payout: 3 }, now)).toBe('paid')
  })
})
