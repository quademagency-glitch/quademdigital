import { describe, expect, it } from 'vitest'
import { dayProblem, messageDay } from '../../src/lib/workDay'

// Thursday 8 October 2026.
const today = '2026-10-08'

describe('the day work counts for', () => {
  it('takes today, a missed working day up to 7 days back, and a working day up to 14 ahead', () => {
    expect(dayProblem(today, today)).toBeNull()
    expect(dayProblem('2026-10-01', today)).toBeNull()
    expect(dayProblem('2026-10-22', today)).toBeNull()
    expect(dayProblem('2026-09-30', today)).toMatch(/more than 7 days back/)
    expect(dayProblem('2026-10-23', today)).toMatch(/more than 14 days ahead/)
  })
  it('refuses a weekend other than today, a day before they started, and nonsense', () => {
    expect(dayProblem('2026-10-10', today)).toMatch(/working day/)
    expect(dayProblem('2026-10-10', '2026-10-10')).toBeNull()
    expect(dayProblem('2026-10-02', today, { startDate: '2026-10-05T00:00:00.000Z' })).toMatch(/before you started/)
    expect(dayProblem('8 Oct', today)).toBe('Choose a day.')
  })
  it('never lets a report be sent ahead', () => {
    expect(dayProblem('2026-10-09', today, { ahead: 0 })).toBe('That day has not come yet.')
    expect(dayProblem('2026-10-06', today, { ahead: 0 })).toBeNull()
  })
  it('counts a message on the earlier day it was sent, within 7 days; otherwise on the day it is recorded', () => {
    expect(messageDay('2026-10-06T15:00:00.000Z', '2026-10-08T09:00:00.000Z')).toBe('2026-10-06T00:00:00.000Z')
    expect(messageDay('2026-10-08T08:00:00.000Z', '2026-10-08T09:00:00.000Z')).toBeNull()
    expect(messageDay('2026-09-29T08:00:00.000Z', '2026-10-08T09:00:00.000Z')).toBeNull()
  })
})
