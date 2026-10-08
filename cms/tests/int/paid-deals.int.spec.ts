import { describe, expect, it } from 'vitest'
import { paidDeals } from '../../src/lib/paidDeals'

// Agreement §4: a deal counts when the client has signed and Quadem has received the first payment.
describe('when a deal counts', () => {
  it('counts a deal once, in the month its first payment cleared', () => {
    const paid = paidDeals([
      { deal: 7, clearedAt: '2026-11-03T00:00:00.000Z', amountMinor: 250_000 },
      { deal: 7, clearedAt: '2026-10-28T00:00:00.000Z', amountMinor: 250_000 },
      { deal: 9, clearedAt: '2026-11-10T00:00:00.000Z', amountMinor: 100_000, creditType: 'handed' },
    ])
    expect(paid).toEqual([
      { deal: '7', month: '2026-10', handed: false },
      { deal: '9', month: '2026-11', handed: true },
    ])
  })

  it('leaves out refunds and payments with no deal, and reads a deal given as a record', () => {
    expect(
      paidDeals([
        { deal: 7, clearedAt: '2026-10-01T00:00:00.000Z', amountMinor: -50_000 },
        { deal: null, clearedAt: '2026-10-01T00:00:00.000Z', amountMinor: 50_000 },
        { deal: { id: 8 }, clearedAt: '2026-12-01T00:00:00.000Z', amountMinor: 1 },
      ]),
    ).toEqual([{ deal: '8', month: '2026-12', handed: false }])
  })

  it('does not count an accepted deal with no payment', () => {
    expect(paidDeals([])).toEqual([])
  })
})
