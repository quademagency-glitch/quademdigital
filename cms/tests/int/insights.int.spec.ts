import { describe, expect, it } from 'vitest'
import { buildInsights, lastMonths, median, type InsightInput } from '../../src/lib/insights'

const people = [
  { id: 1, name: 'Ama', status: 'active' },
  { id: 2, name: 'Kofi', status: 'active' },
  { id: 3, name: 'Left in March', status: 'left' },
]

const input = (over: Partial<InsightInput> = {}): InsightInput => ({ people, leads: [], quotes: [], deals: [], payments: [], reports: [], ...over })

describe('insights (spec 14.9)', () => {
  it('the months, oldest first, ending with this one', () => {
    expect(lastMonths(3, new Date('2026-02-10T09:00:00Z'))).toEqual(['2025-12', '2026-01', '2026-02'])
  })

  it('the middle value, to one decimal', () => {
    expect(median([])).toBeNull()
    expect(median([5, 1, 3])).toBe(3)
    expect(median([1, 2])).toBe(1.5)
  })

  it('counts what each person did, by month, as the daily report does', () => {
    const out = buildInsights(
      input({
        leads: [
          {
            id: 10,
            owner: 1,
            loggedAt: '2026-09-03T10:00:00Z',
            status: 'replied',
            activity: [
              { type: 'first-message', by: 1, at: '2026-09-03T10:00:00Z', recordedAt: '2026-09-03T10:05:00Z' },
              { type: 'reply', by: 1, at: '2026-09-05T10:00:00Z', recordedAt: '2026-10-01T08:00:00Z', direction: 'in' },
            ],
          },
          { id: 11, owner: 1, loggedAt: '2026-10-02T10:00:00Z', status: 'new', activity: [] },
          // Handed to Ama: Kofi found it, Ama messaged it.
          { id: 12, owner: 2, loggedAt: '2026-10-02T10:00:00Z', status: 'contacted', activity: [{ type: 'first-message', by: 1, at: '2026-10-02T11:00:00Z', recordedAt: '2026-10-02T11:00:00Z' }] },
        ],
        quotes: [{ lead: 10, requestedBy: 1, createdAt: '2026-10-03T09:00:00Z' }],
        deals: [
          { lead: 10, creditTo: 1, acceptedAt: '2026-10-04T09:00:00Z', dealStatus: 'accepted' },
          { lead: 11, creditTo: 1, acceptedAt: '2026-10-04T09:00:00Z', dealStatus: 'declined' },
        ],
        payments: [
          { creditTo: 1, creditType: 'sourced', clearedAt: '2026-10-05', amountGHSMinor: 550_000 },
          { creditTo: 1, creditType: 'sourced', clearedAt: '2026-10-06', amountGHSMinor: -50_000 },
          { creditTo: 2, creditType: 'handed', clearedAt: '2026-10-06', amountGHSMinor: 100_000 },
        ],
        reports: [
          { user: 1, date: '2026-10-01T00:00:00Z', onTime: true },
          { user: 1, date: '2026-10-02T00:00:00Z', onTime: false },
        ],
      }),
      ['2026-09', '2026-10'],
    )
    const ama = out.people.find((p) => p.name === 'Ama')!
    expect(ama.months['2026-09']).toMatchObject({ researched: 1, messaged: 1, replies: 0, replyDays: 2 })
    // The reply was written on 1 October, so it counts in October, like the report.
    expect(ama.months['2026-10']).toMatchObject({ researched: 1, messaged: 1, replies: 1, quotes: 1, deals: 1, revenueSourcedMinor: 500_000, reportsSent: 2, reportsOnTime: 1 })
    const kofi = out.people.find((p) => p.name === 'Kofi')!
    expect(kofi.months['2026-10']).toMatchObject({ researched: 1, messaged: 0, revenueSourcedMinor: 0, revenueHandedMinor: 100_000 })
    expect(out.team['2026-10']).toMatchObject({ researched: 2, messaged: 1, deals: 1, revenueSourcedMinor: 500_000, revenueHandedMinor: 100_000 })
    expect(out.team['2026-09'].replyDays).toBe(2)
  })

  it('conversion follows the leads logged that month; a later stage counts the ones before it', () => {
    const out = buildInsights(
      input({
        leads: [
          { id: 1, owner: 1, loggedAt: '2026-10-01T00:00:00Z', status: 'new' },
          { id: 2, owner: 1, loggedAt: '2026-10-01T00:00:00Z', status: 'contacted', activity: [{ type: 'first-message', by: 1, recordedAt: '2026-10-01T09:00:00Z' }] },
          { id: 3, owner: 1, loggedAt: '2026-10-01T00:00:00Z', status: 'in-conversation', activity: [{ type: 'call', by: 1, direction: 'in', recordedAt: '2026-10-02T09:00:00Z' }] },
          { id: 4, owner: 1, loggedAt: '2026-10-01T00:00:00Z', status: 'proposal-sent' },
          { id: 5, owner: 1, loggedAt: '2026-10-01T00:00:00Z', status: 'in-conversation' },
        ],
        deals: [{ lead: 5, creditTo: 1, acceptedAt: '2026-10-09T00:00:00Z', dealStatus: 'active' }],
      }),
      ['2026-10'],
    )
    expect(out.people[0].months['2026-10'].funnel).toEqual({ logged: 5, messaged: 4, replied: 3, quoted: 2, won: 1 })
  })

  it('someone who has left shows only where they did something; nobody unknown is counted', () => {
    const out = buildInsights(
      input({
        leads: [
          { id: 1, owner: 3, loggedAt: '2026-10-01T00:00:00Z' },
          { id: 2, owner: 99, loggedAt: '2026-10-01T00:00:00Z' },
          { id: 3, owner: 1, loggedAt: '2025-01-01T00:00:00Z' },
        ],
      }),
      ['2026-10'],
    )
    expect(out.people.map((p) => p.name)).toEqual(['Ama', 'Kofi', 'Left in March'])
    expect(out.team['2026-10'].researched).toBe(1)
    const quiet = buildInsights(input(), ['2026-10'])
    expect(quiet.people.map((p) => p.name)).toEqual(['Ama', 'Kofi'])
  })
})
