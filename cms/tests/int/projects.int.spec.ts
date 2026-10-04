import { describe, expect, it } from 'vitest'
import { checklistDone, nextDue } from '../../src/lib/projects'

describe('repeating tasks (spec 14.5)', () => {
  it('a task that does not repeat has no next copy', () => {
    expect(nextDue('none', '2026-10-14', '2026-10-14')).toBeNull()
    expect(nextDue(null, '2026-10-14', '2026-10-14')).toBeNull()
  })

  it('every working day skips the weekend', () => {
    expect(nextDue('daily', '2026-10-14', '2026-10-14')).toBe('2026-10-15') // Wednesday to Thursday
    expect(nextDue('daily', '2026-10-16', '2026-10-16')).toBe('2026-10-19') // Friday to Monday
  })

  it('every week is seven days on', () => {
    expect(nextDue('weekly', '2026-10-14', '2026-10-14')).toBe('2026-10-21')
  })

  it('every month keeps the day, or the last day of a shorter month', () => {
    expect(nextDue('monthly', '2026-10-14', '2026-10-14')).toBe('2026-11-14')
    expect(nextDue('monthly', '2026-01-31', '2026-01-31')).toBe('2026-02-28')
    expect(nextDue('monthly', '2026-12-15', '2026-12-15')).toBe('2027-01-15')
  })

  it('done late: the next copy is the first date still to come, not one already gone', () => {
    expect(nextDue('weekly', '2026-10-01', '2026-10-14')).toBe('2026-10-15')
    expect(nextDue('daily', '2026-10-09', '2026-10-14')).toBe('2026-10-15')
  })

  it('no due date: counted from today', () => {
    expect(nextDue('weekly', null, '2026-10-14')).toBe('2026-10-21')
  })
})

describe('a checklist inside a task', () => {
  it('counts what is ticked', () => {
    expect(checklistDone([{ done: true }, { done: false }, {}])).toEqual({ done: 1, total: 3 })
    expect(checklistDone(null)).toEqual({ done: 0, total: 0 })
  })
})
