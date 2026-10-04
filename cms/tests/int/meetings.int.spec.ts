import { describe, expect, it } from 'vitest'
import { nextDate } from '../../src/collections/Meetings'

describe('repeating meetings', () => {
  it('moves a week, two weeks or a month on', () => {
    expect(nextDate('2026-10-08T14:00:00.000Z', 'weekly')).toBe('2026-10-15T14:00:00.000Z')
    expect(nextDate('2026-10-08T14:00:00.000Z', 'fortnightly')).toBe('2026-10-22T14:00:00.000Z')
    expect(nextDate('2026-10-08T14:00:00.000Z', 'monthly')).toBe('2026-11-08T14:00:00.000Z')
  })
  it('a one-off has no next date', () => {
    expect(nextDate('2026-10-08T14:00:00.000Z', 'none')).toBe(null)
  })
})
