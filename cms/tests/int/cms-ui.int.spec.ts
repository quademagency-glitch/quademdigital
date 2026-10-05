import { describe, expect, it, vi } from 'vitest'
import {
  activeRetainerWhere,
  dayBounds,
  findAll,
  formatMoney,
  invoiceSetURL,
  invoiceSummary,
  listURL,
  retainerSummary,
} from '../../src/lib/dashboard'
import { onboardingStepLabel } from '../../src/lib/onboardingPresentation'
import { sortDestinations, workspaceFor } from '../../src/lib/adminNavigation'

const now = new Date('2026-10-04T12:00:00Z')
describe('CMS dashboard record sets', () => {
  it('keeps currencies separate and includes partial payments without counting paid invoices as overdue', () => {
    const result = invoiceSummary(
      [
        {
          id: 1,
          currency: 'GHS',
          amountMinor: 250000,
          amountPaidMinor: 70000,
          status: 'pending',
          dueDate: '2026-10-01T00:00:00Z',
        },
        {
          id: 2,
          currency: 'USD',
          amountMinor: 120000,
          amountPaidMinor: 120000,
          status: 'paid',
          dueDate: '2026-09-01T00:00:00Z',
        },
        {
          id: 3,
          currency: 'USD',
          amountMinor: 80000,
          amountPaidMinor: 0,
          status: 'pending',
          dueDate: '2026-10-04T00:00:00Z',
        },
        {
          id: 4,
          currency: 'GHS',
          amountMinor: 20000,
          amountPaidMinor: 22000,
          status: 'pending',
          dueDate: '2026-10-01T00:00:00Z',
        },
      ],
      now,
    )
    expect(result.collected).toEqual({ GHS: 92000, USD: 120000 })
    expect(result.awaiting).toEqual({ GHS: 180000, USD: 80000 })
    expect(result.overdue).toEqual({ GHS: 180000 })
    expect(result.due.map((d) => [d.id, d.daysLate])).toEqual([[1, 3]])
    expect(result.awaitingIds).toEqual([1, 3])
  })
  it('uses the Accra calendar boundary even when a due time was in the afternoon', () => {
    expect(dayBounds(now).end.toISOString()).toBe('2026-10-04T23:59:59.999Z')
    expect(
      invoiceSummary([{ id: 1, amountMinor: 500, dueDate: '2026-10-03T23:30:00Z' }], now).due[0]
        .daysLate,
    ).toBe(1)
  })
  it('does not link an empty computed set to every invoice', () => {
    const query = new URL(invoiceSetURL([]), 'http://localhost').searchParams
    expect(query.get('where[id][equals]')).toBe('-1')
    const populated = new URL(invoiceSetURL([1, 3]), 'http://localhost').searchParams
    expect(populated.get('where[id][in][0]')).toBe('1')
    expect(populated.get('where[id][in][1]')).toBe('3')
  })
  it('carries every retainer criterion into its list link', () => {
    const query = new URL(listURL('proposals', activeRetainerWhere(now)), 'http://localhost')
      .searchParams
    expect(query.get('where[and][0][recurring][equals]')).toBe('true')
    expect(query.get('where[and][1][acceptedAt][exists]')).toBe('true')
    expect(query.get('where[and][3][or][1][endedAt][greater_than]')).toBe(now.toISOString())
    expect(
      retainerSummary([
        { country: 'GH', total: 6400 },
        { currency: 'USD', total: 200 },
      ]),
    ).toEqual({ GHS: 640000, USD: 20000 })
  })
  it('reads every page using the authenticated viewer and rejects a partial total after a failed page', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [{ id: 1 }], hasNextPage: true })
      .mockResolvedValueOnce({ docs: [{ id: 2 }], hasNextPage: false })
    const payload = { find } as unknown as Parameters<typeof findAll>[0]
    const user = { id: 10, role: 'admin' } as Parameters<typeof findAll>[1]
    expect(await findAll(payload, user, 'invoices')).toEqual([{ id: 1 }, { id: 2 }])
    expect(find.mock.calls[1][0]).toMatchObject({ page: 2, overrideAccess: false, user })
    find
      .mockReset()
      .mockResolvedValueOnce({ docs: [{ id: 1 }], hasNextPage: true })
      .mockRejectedValueOnce(new Error('Database unavailable'))
    await expect(findAll(payload, user, 'invoices')).rejects.toThrow('Database unavailable')
  })
  it('formats minor units and unknown currency codes without crashing the screen', () => {
    expect(formatMoney('GHS', 125050)).toContain('1,250.50')
    expect(formatMoney('invalid', 12500)).toBe('invalid 125')
  })
})
describe('Onboarding evidence labels', () => {
  it('distinguishes a saved document, an accepted email and a scheduled email', () => {
    expect(onboardingStepLabel('fileContract', { status: 'complete' })).toBe('Saved')
    expect(
      onboardingStepLabel('welcome', { status: 'complete', result: { providerId: 'sample' } }),
    ).toBe('Accepted')
    expect(
      onboardingStepLabel('contract', {
        status: 'complete',
        result: { scheduledAt: '2026-10-05' },
      }),
    ).toBe('Scheduled')
    expect(onboardingStepLabel('setup', { status: 'failed' })).toBe('Failed')
    expect(onboardingStepLabel('checkin')).toBe('Not started')
  })
})
describe('Workspace destinations', () => {
  it('keeps finance, sales and content distinct while retaining unknown permitted destinations', () => {
    expect(workspaceFor('invoices')).toBe('Finance')
    expect(workspaceFor('signature-requests')).toBe('Sales')
    expect(workspaceFor('media')).toBe('Content')
    expect(workspaceFor('new-plugin')).toBe('Settings')
    expect(
      sortDestinations([
        { slug: 'media', label: 'Media', href: '/media', group: 'Content' },
        { slug: 'clients', label: 'Clients', href: '/clients', group: 'Sales' },
      ]).map((d) => d.slug),
    ).toEqual(['clients', 'media'])
  })
})

// Newly released collections must stay in their business workspace.
describe('Current release navigation', () => {
  it('groups newer sales and team collections without losing them', async () => {
    const { workspaceFor } = await import('../../src/lib/adminNavigation')
    expect(workspaceFor('quote-requests')).toBe('Sales')
    for (const slug of [
      'projects',
      'deliverables',
      'time-off',
      'appraisals',
      'training-modules',
      'meetings',
      'openings',
      'channels',
      'polls',
    ]) {
      expect(workspaceFor(slug)).toBe('Team')
    }
  })
})
