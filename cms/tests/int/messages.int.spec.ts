import { describe, expect, it } from 'vitest'
import { channelKey, emailFor, preview, tally } from '../../src/lib/messages'

describe('channels (spec 14.8)', () => {
  it('two people have one conversation, whoever starts it', () => {
    expect(channelKey.direct(7, 12)).toBe('dm:7:12')
    expect(channelKey.direct(12, 7)).toBe('dm:7:12')
    expect(channelKey.direct('3', 20)).toBe('dm:3:20')
  })

  it('everyone has one channel, and each job role one', () => {
    expect(channelKey.everyone()).toBe('everyone')
    expect(channelKey.role(4)).toBe('role:4')
  })

  it('a message in a list is one short line', () => {
    expect(preview('  Hello\n\nthere  ')).toBe('Hello there')
    expect(preview('', true)).toBe('Sent a file')
    expect(preview('x'.repeat(200))).toHaveLength(120)
    expect(preview('x'.repeat(200)).endsWith('…')).toBe(true)
  })
})

describe('how each person hears about things', () => {
  it('straight away, a daily email, or the portal only', () => {
    expect(emailFor('now', {})).toBe('now')
    expect(emailFor(null, {})).toBe('now')
    expect(emailFor('digest', {})).toBe('digest')
    expect(emailFor('portal', {})).toBe('none')
  })

  it('a notice that is portal-only stays so; an important one is emailed whatever they chose', () => {
    expect(emailFor('now', { email: false })).toBe('none')
    expect(emailFor('portal', { important: true })).toBe('now')
    expect(emailFor('digest', { important: true })).toBe('now')
  })
})

describe('poll results', () => {
  it('count each choice and its share, in the poll order', () => {
    const choices = [
      { id: 'a', text: 'Monday' },
      { id: 'b', text: 'Wednesday' },
      { id: 'c', text: 'Friday' },
    ]
    expect(tally(choices, [{ choice: 'a' }, { choice: 'c' }, { choice: 'c' }, { choice: 'x' }])).toEqual([
      { id: 'a', text: 'Monday', count: 1, share: 25 },
      { id: 'b', text: 'Wednesday', count: 0, share: 0 },
      { id: 'c', text: 'Friday', count: 2, share: 50 },
    ])
    expect(tally(choices, [])[0].share).toBe(0)
  })
})
