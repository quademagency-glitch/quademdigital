import { describe, expect, it } from 'vitest'
import { dealEdit, type DealDoc } from '../../src/lib/dealEdit'

const accepted: DealDoc = {
  clientName: 'Ama Bakery',
  currency: 'GHS',
  total: 6000,
  acceptedAt: '2026-10-01T09:00:00.000Z',
  depositPercent: null,
  startDate: '2026-10-10T00:00:00.000Z',
  lineItems: [{ description: 'Business website', quantity: 1, rate: 6000 }],
  deliverables: [{ item: 'Five pages' }],
}
const edit = (data: Record<string, unknown>, o: { deal?: DealDoc; reason?: string; hasPayments?: boolean } = {}) => dealEdit({ deal: o.deal ?? accepted, data, reason: o.reason, hasPayments: o.hasPayments ?? false })

describe('editing a deal', () => {
  it('words and dates change freely, and only what differs is listed', () => {
    const r = edit({ clientName: ' Ama Bakery ', summary: 'A new site', startDate: '2026-10-10', depositPercent: 0, deliverables: ['Five pages'] })
    expect(r).toMatchObject({ money: false, changed: ['summary'] })
  })

  it('checks what it is given', () => {
    expect(edit({ clientName: '' })).toEqual({ error: expect.stringMatching(/name/) })
    expect(edit({ clientEmail: 'ama@' })).toEqual({ error: expect.stringMatching(/email/) })
    expect(edit({ country: 'Ghana' })).toEqual({ error: expect.stringMatching(/two-letter/) })
    expect(edit({ service: 'plumbing' })).toEqual({ error: expect.stringMatching(/service/) })
    expect(edit({ currency: 'JPY' })).toEqual({ error: expect.stringMatching(/currency/) })
    expect(edit({ depositPercent: 100 })).toEqual({ error: expect.stringMatching(/deposit/) })
    expect(edit({ durationMonths: 1.5 })).toEqual({ error: expect.stringMatching(/months/) })
    expect(edit({ lineItems: [{ description: 'A', quantity: 0, rate: 1 }] })).toEqual({ error: expect.stringMatching(/Quantities/) })
    expect(edit({ journeySteps: [{ title: 'Kick-off', owner: 'someone' }] })).toEqual({ error: expect.stringMatching(/Kick-off/) })
  })

  it('the lines are the total, and must add up when both are given', () => {
    const r = edit({ lineItems: [{ description: 'Website', quantity: 1, rate: 5000 }, { description: 'Logo', quantity: 2, rate: 250.5 }] }, { reason: 'Logo added' })
    expect(r).toMatchObject({ money: true, changes: { total: 5501 } })
    expect(edit({ total: 7000, lineItems: [{ description: 'Website', quantity: 1, rate: 6000 }] })).toEqual({ error: expect.stringMatching(/add up to 6000, not 7000/) })
    expect(edit({ total: 7000 })).toEqual({ error: expect.stringMatching(/add up to 6000/) })
    expect(edit({ total: 7000 }, { deal: { ...accepted, lineItems: [], acceptedAt: null } })).toMatchObject({ changes: { total: 7000 }, money: true })
  })

  it('after acceptance, the money needs a reason; before, it does not', () => {
    expect(edit({ currency: 'USD' })).toEqual({ error: expect.stringMatching(/needs a reason/) })
    expect(edit({ currency: 'USD' }, { reason: 'Billed from the US office' })).toMatchObject({ changed: ['currency'] })
    expect(edit({ currency: 'USD' }, { deal: { ...accepted, acceptedAt: null } })).toMatchObject({ money: true })
  })

  it('the currency stays once a payment is recorded', () => {
    expect(edit({ currency: 'USD' }, { reason: 'x', hasPayments: true })).toEqual({ error: expect.stringMatching(/recorded against this deal in GHS/) })
    expect(edit({ currency: 'GHS', summary: 'same money' }, { hasPayments: true })).toMatchObject({ changed: ['summary'] })
  })

  it('journey steps come out whole, with the defaults the CMS uses', () => {
    expect(edit({ journeySteps: [{ title: 'Kick-off call', dueOffsetDays: '' }, { title: 'Send logo files', owner: 'client', stage: 'design', dueOffsetDays: 3, clientVisible: false }] })).toMatchObject({
      changes: {
        journeySteps: [
          { title: 'Kick-off call', detail: null, owner: 'quadem', stage: 'onboarding', dueOffsetDays: 0, clientVisible: true },
          { title: 'Send logo files', owner: 'client', stage: 'design', dueOffsetDays: 3, clientVisible: false },
        ],
      },
    })
  })
})
