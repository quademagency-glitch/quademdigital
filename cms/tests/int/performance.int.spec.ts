// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildPerformance, periodOf, type PerformanceInput } from '../../src/lib/performance'

/*
  The founder's dashboard figures (lib/performance), without a database: the
  periods and their comparisons, and each section's sums. Money is never added
  across currencies.
*/

const now = new Date('2026-10-07T12:00:00.000Z')

describe('the periods', () => {
  it('this month so far, against the same days last month, by week', () => {
    const p = periodOf('month', now)
    expect([p.from, p.to, p.prevFrom, p.prevTo, p.unit]).toEqual(['2026-10-01T00:00:00.000Z', now.toISOString(), '2026-09-01T00:00:00.000Z', '2026-09-07T12:00:00.000Z', 'week'])
    expect(p.buckets.map((b) => b.label)).toEqual(['1 Oct'])
  })
  it('last month whole, against the month before, in five weeks', () => {
    const p = periodOf('last-month', now)
    expect([p.from, p.to, p.prevFrom, p.prevTo]).toEqual(['2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'])
    expect(p.buckets).toHaveLength(5)
    expect(p.buckets.at(-1)!.to).toBe('2026-10-01T00:00:00.000Z')
  })
  it('this year by month, against the same days last year', () => {
    const p = periodOf('year', now)
    expect(p.unit).toBe('month')
    expect(p.buckets.map((b) => b.label)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'])
    expect(p.prevTo).toBe('2025-10-07T12:00:00.000Z')
  })
  it('so far: from the first record, with the year on each month when it spans two, and nothing to compare with', () => {
    const p = periodOf('all', now, new Date('2025-06-15T00:00:00.000Z'))
    expect(p.from).toBe('2025-06-01T00:00:00.000Z')
    expect(p.prevFrom).toBeNull()
    expect(p.buckets[0].label).toBe('Jun 25')
    expect(p.buckets.at(-1)!.label).toBe('Oct 26')
  })
})

const empty: PerformanceInput = { leads: [], priceRequests: [], deals: [], payments: [], invoices: [], subscribers: [], events: [], pitches: [], people: [], reports: [], payouts: [] }

describe('the figures', () => {
  const p = periodOf('month', now)
  const input: PerformanceInput = {
    ...empty,
    leads: [
      { id: 1, loggedAt: '2026-10-02T09:00:00Z', source: 'contact-form', status: 'won', owner: null, activity: [{ type: 'reply', at: '2026-10-03T09:00:00Z' }] },
      { id: 2, loggedAt: '2026-10-03T09:00:00Z', source: 'outreach', status: 'contacted', owner: 7, activity: [{ type: 'first-message', at: '2026-10-03T10:00:00Z', by: 7 }] },
      { id: 3, loggedAt: '2026-09-03T09:00:00Z', source: 'outreach', status: 'replied', owner: 7, activity: [{ type: 'first-message', at: '2026-09-04T10:00:00Z', by: 7 }] },
      { id: 4, loggedAt: '2026-10-04T09:00:00Z', source: 'whatsapp', status: 'new', owner: null },
    ],
    deals: [
      { lead: 1, quoteSentAt: '2026-10-02T12:00:00Z', acceptedAt: '2026-10-05T12:00:00Z', service: 'branding', currency: 'GHS', total: 3000, dealStatus: 'accepted', creditTo: 7 },
      { lead: 2, quoteSentAt: '2026-10-04T12:00:00Z', service: 'web-design', currency: 'USD', total: 1200 },
      { lead: 3, acceptedAt: '2026-09-05T12:00:00Z', service: 'social-media', currency: 'NGN', total: 300000, recurring: true, dealStatus: 'active' },
    ],
    payments: [
      { clearedAt: '2026-10-05T12:00:00Z', currency: 'GHS', amountMinor: 150000, commissionGHSMinor: 50000 },
      { clearedAt: '2026-10-06T12:00:00Z', currency: 'NGN', amountMinor: 30000000 },
      { clearedAt: '2026-10-06T13:00:00Z', currency: 'GHS', amountMinor: -20000 },
      { clearedAt: '2026-09-05T12:00:00Z', currency: 'GHS', amountMinor: 100000 },
    ],
    invoices: [
      { issuedAt: '2026-10-02T12:00:00Z', currency: 'GHS', amountMinor: 300000, amountPaidMinor: 150000, status: 'pending', dueDate: '2026-10-20T00:00:00Z' },
      { issuedAt: '2026-09-01T12:00:00Z', currency: 'USD', amountMinor: 50000, amountPaidMinor: 0, status: 'pending', dueDate: '2026-09-15T00:00:00Z' },
      { issuedAt: null, currency: 'GHS', amountMinor: 999900 }, // a draft
    ],
    subscribers: [{ confirmedAt: '2026-10-02T00:00:00Z', status: 'subscribed' }, { confirmedAt: '2026-09-02T00:00:00Z', unsubscribedAt: '2026-10-03T00:00:00Z', status: 'unsubscribed' }],
    events: [
      { event: 'opened', occurredAt: '2026-10-02T10:00:00Z', campaign: 1, email: 'a@x.test' },
      { event: 'opened', occurredAt: '2026-10-02T11:00:00Z', campaign: 1, email: 'A@x.test' }, // the same person again
      { event: 'opened', occurredAt: '2026-10-02T12:00:00Z', campaign: 1, email: 'b@x.test' },
    ],
    pitches: [{ createdAt: '2026-10-01T10:00:00Z', firstViewedAt: '2026-10-02T10:00:00Z' }],
    people: [{ id: 7, name: 'Ada', status: 'active' }, { id: 8, name: 'Gone', status: 'ended' }],
    reports: [{ user: 7, date: '2026-10-02T00:00:00Z', onTime: true }, { user: 7, date: '2026-10-03T00:00:00Z', onTime: false }],
    payouts: [{ paidAt: '2026-10-05T00:00:00Z', amountGHSMinor: 40000 }],
  }
  const d = buildPerformance(input, p, now)

  it('sales: enquiries and leads found apart, messages, quotes, deals, value per currency, win rate and days to win', () => {
    expect(d.sales.enquiries).toEqual({ now: 2, prev: 0, series: [2] })
    expect(d.sales.leadsFound).toEqual({ now: 1, prev: 1, series: [1] })
    expect(d.sales.firstMessages.now).toBe(1)
    expect(d.sales.firstMessages.prev).toBe(1)
    expect(d.sales.replies.now).toBe(1)
    expect(d.sales.quotesSent.now).toBe(2)
    expect(d.sales.dealsWon).toMatchObject({ now: 1, prev: 1 })
    expect(d.sales.wonValue).toEqual([
      { currency: 'GHS', now: 300000, prev: 0, series: [300000] },
      { currency: 'NGN', now: 0, prev: 30000000, series: [0] },
    ])
    expect(d.sales.winRate.now).toBe(50)
    expect(d.sales.daysToWin.now).toBe(3)
    expect(d.sales.bySource[0]).toEqual({ source: 'contact-form', inbound: true, leads: 1, won: 1 })
    expect(d.sales.byService).toEqual([{ service: 'branding', deals: 1, value: [{ currency: 'GHS', minor: 300000 }] }])
    expect(d.sales.pipeline).toEqual({ Found: 1, Messaged: 1, Talking: 1, Quote: 0 })
  })

  it('marketing: subscribers in and out, each person opening once, pitches made and opened', () => {
    expect(d.marketing.subscribers.now).toBe(1)
    expect(d.marketing.unsubscribed.now).toBe(1)
    expect(d.marketing.listening).toBe(1)
    expect(d.marketing.opened.now).toBe(2)
    expect(d.marketing.pitchesMade.now).toBe(1)
    expect(d.marketing.pitchesOpened.now).toBe(1)
    expect(d.marketing.enquiriesBySource).toEqual([{ source: 'contact-form', count: 1 }, { source: 'whatsapp', count: 1 }])
  })

  it('team: the people still on it, their work, reports on time, commission and cost in GH₵', () => {
    expect(d.team.active).toBe(1)
    expect(d.team.people).toEqual([{ id: '7', name: 'Ada', found: 1, messaged: 1, replies: 0, won: 1, reports: 2 }])
    expect(d.team.reportsOnTime.now).toBe(50)
    expect(d.team.commissionGHS.now).toBe(50000)
    expect(d.team.costGHS.now).toBe(40000)
  })

  it('money: collected and refunded per currency, never added together; owed and overdue now; drafts not counted; retainers', () => {
    expect(d.money.collected).toEqual([
      { currency: 'GHS', now: 150000, prev: 100000, series: [150000] },
      { currency: 'NGN', now: 30000000, prev: 0, series: [30000000] },
    ])
    expect(d.money.refunded).toEqual([{ currency: 'GHS', now: 20000, prev: 0, series: [20000] }])
    // Dollars were invoiced only in the period before: shown at nothing now, with the comparison kept.
    expect(d.money.invoiced.map((m) => [m.currency, m.now, m.prev])).toEqual([['GHS', 300000, 0], ['USD', 0, 50000]])
    expect(d.money.owed).toEqual([
      { currency: 'GHS', owed: 150000, overdue: 0, invoices: 1 },
      { currency: 'USD', owed: 50000, overdue: 50000, invoices: 1 },
    ])
    expect(d.money.retainers).toEqual({ count: 1, monthly: [{ currency: 'NGN', minor: 30000000 }] })
  })

  it('an empty period is zeros, never a guess', () => {
    const e = buildPerformance(empty, p, now)
    expect(e.sales.dealsWon).toEqual({ now: 0, prev: 0, series: [0] })
    expect(e.sales.winRate).toEqual({ now: null, prev: null })
    expect(e.money.collected).toEqual([])
    expect(e.team.reportsOnTime.now).toBeNull()
  })
})
