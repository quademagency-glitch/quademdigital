import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES, lagosTime, nextGap, plusMinutes, rulesFrom } from '../../src/lib/workRules'

describe('the working rules Ernest sets (spec 14.9)', () => {
  it('nothing set: the agreement as written, 18:00 and 2, 5, then 10 working days, every reminder on', () => {
    expect(rulesFrom(null)).toEqual(DEFAULT_RULES)
    expect(rulesFrom({ workRules: {} })).toEqual(DEFAULT_RULES)
  })

  it('what Ernest sets is used', () => {
    const r = rulesFrom({ workRules: { reportDeadline: '17:30', firstFollowUpDays: 3, secondFollowUpDays: 6, thirdFollowUpDays: 12, reminders: { reportDue: false } } })
    expect(r.reportDeadline).toBe('17:30')
    expect(r.followUpDays).toEqual([3, 6, 12])
    expect(r.reminders).toEqual({ followUps: true, tasksDue: true, reportDue: false, reportMissing: true })
  })

  it('a value that makes no sense falls back, rather than breaking the day', () => {
    const r = rulesFrom({ workRules: { reportDeadline: '25:00', firstFollowUpDays: 0, secondFollowUpDays: 'soon', thirdFollowUpDays: 99 } })
    expect(r.reportDeadline).toBe('18:00')
    expect(r.followUpDays).toEqual([2, 5, 10])
  })

  it('the follow-up after each step, then the end of the chase', () => {
    expect(nextGap(DEFAULT_RULES, 0)).toBe(2)
    expect(nextGap(DEFAULT_RULES, 1)).toBe(5)
    expect(nextGap(DEFAULT_RULES, 2)).toBe(10)
    expect(nextGap(DEFAULT_RULES, 3)).toBeNull()
  })

  it('times: an hour before, Lagos an hour ahead, never past midnight', () => {
    expect(plusMinutes('18:00', -60)).toBe('17:00')
    expect(plusMinutes('18:00', 5)).toBe('18:05')
    expect(lagosTime('18:00')).toBe('19:00')
    expect(plusMinutes('23:30', 60)).toBe('23:59')
  })
})
