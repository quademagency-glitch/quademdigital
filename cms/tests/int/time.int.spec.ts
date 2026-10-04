import { describe, expect, it } from 'vitest'
import { eachDay, isWeekend, lighter } from '../../src/lib/offDays'

// The pure parts of days off (spec 5.11, 14.6, test 32). The rest reads the database.
describe('days off', () => {
  it('lists every day in a range, both ends included', () => {
    expect(eachDay('2026-10-08', '2026-10-09')).toEqual(['2026-10-08', '2026-10-09'])
    expect(eachDay('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(eachDay('2026-10-09', '2026-10-08')).toEqual([])
  })
  it('knows a weekend', () => {
    expect(isWeekend('2026-10-10')).toBe(true) // Saturday
    expect(isWeekend('2026-10-11')).toBe(true) // Sunday
    expect(isWeekend('2026-10-08')).toBe(false) // Thursday
  })
  it('test 32: Thursday and Friday off are two working days', () => {
    expect(eachDay('2026-10-08', '2026-10-09').filter((d) => !isWeekend(d))).toHaveLength(2)
  })
  it('the lighter standard is half of each target, rounded up', () => {
    expect(lighter(10)).toBe(5)
    expect(lighter(3)).toBe(2)
    expect(lighter(null)).toBe(null)
  })
})
