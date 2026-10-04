import { describe, expect, it } from 'vitest'
import { addMonths, answersChanged, isLastFriday, missedCounter, missedLevel, monthNumber } from '../../src/lib/reviews'

// The pure rules of the monthly review (spec 5.4, Agreement §4).
describe('missed months (test 8)', () => {
  it('months 1 and 2 with no deals leave the counter at nought', () => {
    expect(missedCounter([0, 0])).toBe(0)
  })
  it('month 3 with no deal makes it 1', () => {
    expect(missedCounter([0, 0, 0])).toBe(1)
  })
  it('month 4 with no deal makes it 2, with a meeting', () => {
    expect(missedCounter([0, 0, 0, 0])).toBe(2)
    expect(missedLevel(2)).toBe('meeting')
  })
  it('month 5 with one counted deal resets it', () => {
    expect(missedCounter([0, 0, 0, 0, 1])).toBe(0)
  })
  it('at 3 the agreement ends', () => {
    expect(missedCounter([0, 0, 0, 0, 0])).toBe(3)
    expect(missedLevel(3)).toBe('end')
  })
  it('a deal in a grace month does not carry over', () => {
    expect(missedCounter([1, 0, 0])).toBe(1)
  })
})

describe('months', () => {
  it('counts month 1 as the month they started', () => {
    expect(monthNumber('2026-10-05T00:00:00.000Z', '2026-10')).toBe(1)
    expect(monthNumber('2026-10-05T00:00:00.000Z', '2027-01')).toBe(4)
  })
  it('moves across a year', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })
  it('finds the last Friday of a month', () => {
    expect(isLastFriday(new Date('2026-10-30T09:00:00Z'))).toBe(true)
    expect(isLastFriday(new Date('2026-10-23T09:00:00Z'))).toBe(false)
    expect(isLastFriday(new Date('2026-10-29T09:00:00Z'))).toBe(false)
  })
})

describe('a review answer changed after agreeing (spec 5.4)', () => {
  const stored = {
    whatWorked: 'Clinics replied',
    gotInTheWay: null,
    changesNextMonth: 'More follow-ups',
    training: [
      { id: '6701a', area: 'Finding businesses', progress: 'done', note: null },
      { id: '6701b', area: 'First messages', progress: 'started', note: 'Needs work' },
    ],
    readyForTrial: null,
  }

  it('the same answers sent again, without row ids and with empty as null or blank, are not a change', () => {
    expect(
      answersChanged(
        {
          whatWorked: 'Clinics replied',
          gotInTheWay: '',
          changesNextMonth: 'More follow-ups',
          training: [
            { area: 'Finding businesses', progress: 'done', note: null },
            { area: 'First messages', progress: 'started', note: 'Needs work' },
          ],
        },
        stored,
      ),
    ).toBe(false)
  })

  it('a changed word, progress or note is a change', () => {
    expect(answersChanged({ whatWorked: 'Clinics and gyms replied' }, stored)).toBe(true)
    expect(answersChanged({ training: [{ area: 'Finding businesses', progress: 'done' }, { area: 'First messages', progress: 'done', note: 'Needs work' }] }, stored)).toBe(true)
    expect(answersChanged({ training: [{ area: 'Finding businesses', progress: 'done' }, { area: 'First messages', progress: 'started', note: 'Better' }] }, stored)).toBe(true)
  })

  it('pressing Agreed alone changes no answer', () => {
    expect(answersChanged({ memberAgreedAt: '2026-10-30T10:00:00.000Z' }, stored)).toBe(false)
  })
})
