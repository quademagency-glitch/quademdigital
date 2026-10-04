import { describe, expect, it } from 'vitest'
import { earnUntil, exitChecklist, leavingChange } from '../../src/lib/leaving'

const today = '2026-10-15'

describe('ending an agreement (spec 14.1)', () => {
  it('an end date in the future puts someone on notice and opens the checklist', () => {
    expect(leavingChange({ before: 'active', asked: 'on-notice', endedAt: '2026-10-31', today })).toEqual({
      status: 'on-notice',
      endedAt: '2026-10-31',
      openChecklist: true,
    })
  })

  it('on notice needs a date', () => {
    expect(leavingChange({ before: 'active', asked: 'on-notice', endedAt: null, today }).error).toBeTruthy()
  })

  it('an end date today or earlier ends it at once, dated that day', () => {
    expect(leavingChange({ before: 'active', asked: 'on-notice', endedAt: today, today })).toMatchObject({ status: 'ended', endedAt: today, statusSince: today })
    expect(leavingChange({ before: 'on-leave', asked: 'ended', endedAt: '2026-10-01', today })).toMatchObject({ status: 'ended', endedAt: '2026-10-01' })
  })

  it('Ended with a date still to come is notice until that day', () => {
    expect(leavingChange({ before: 'active', asked: 'ended', endedAt: '2026-11-30', today })).toMatchObject({ status: 'on-notice', endedAt: '2026-11-30' })
  })

  it('Ended with no date ends today', () => {
    expect(leavingChange({ before: 'active', asked: 'ended', today })).toMatchObject({ status: 'ended', endedAt: today })
  })

  it('the scheduled job ends notice on its date', () => {
    expect(leavingChange({ before: 'on-notice', asked: 'ended', originalEndedAt: '2026-10-15T00:00:00.000Z', today })).toMatchObject({ status: 'ended', endedAt: today })
  })

  it('a new end date alone, from the admin screen, starts notice', () => {
    expect(leavingChange({ before: 'active', asked: 'active', endedAt: '2026-12-31', originalEndedAt: null, today })).toMatchObject({ status: 'on-notice', endedAt: '2026-12-31' })
  })

  it('moving the end date keeps them on notice, or ends it if the new date has come', () => {
    expect(leavingChange({ before: 'on-notice', endedAt: '2026-11-15', originalEndedAt: '2026-10-31', today })).toMatchObject({ status: 'on-notice', endedAt: '2026-11-15' })
    expect(leavingChange({ before: 'on-notice', endedAt: '2026-10-10', originalEndedAt: '2026-10-31', today })).toMatchObject({ status: 'ended', endedAt: '2026-10-10' })
  })

  it('calling notice off clears the date and the checklist', () => {
    expect(leavingChange({ before: 'on-notice', asked: 'active', originalEndedAt: '2026-10-31', today })).toEqual({ endedAt: null, clearChecklist: true })
  })

  it('someone still working never carries an end date, or the exit rules would cut their commission', () => {
    expect(leavingChange({ before: 'active', asked: 'active', originalEndedAt: '2026-09-01', today })).toEqual({ endedAt: null })
    expect(leavingChange({ before: 'active', asked: 'active', endedAt: null, originalEndedAt: '2026-09-01', today })).toEqual({})
    expect(leavingChange({ before: 'active', asked: 'on-leave', today })).toEqual({})
  })

  it('re-hiring keeps the old agreement and clears the end', () => {
    expect(leavingChange({ before: 'ended', asked: 'invited', originalEndedAt: '2026-09-30', today })).toEqual({ rehire: true, endedAt: null, clearChecklist: true })
  })

  it('editing someone already ended changes nothing about the end', () => {
    expect(leavingChange({ before: 'ended', originalEndedAt: '2026-09-30T00:00:00.000Z', today })).toMatchObject({ status: 'ended', endedAt: '2026-09-30' })
  })

  it('the checklist has the salary line only once a salary started', () => {
    expect(exitChecklist(false).map((r) => r.item)).toEqual([
      'Brand files and logins returned',
      'Left the WhatsApp groups',
      'Handover notes received',
      'Final commission paid',
      'Final data allowance settled',
    ])
    expect(exitChecklist(true)).toHaveLength(6)
    expect(exitChecklist(true).every((r) => r.done === false)).toBe(true)
  })

  it('a lead they found can earn for 60 days after the end (Agreement §11)', () => {
    expect(earnUntil('2026-10-31')).toBe('2026-12-30')
    expect(earnUntil('2026-10-31T00:00:00.000Z')).toBe('2026-12-30')
  })
})
