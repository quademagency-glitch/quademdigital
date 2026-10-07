import { describe, expect, it } from 'vitest'
import { correction, totalMinor } from '../../src/lib/invoiceCorrection'

const fmt = (m: number) => `GH₵${(m / 100).toLocaleString('en-GB')}`
const now = Date.parse('2026-10-07T09:00:00.000Z')
const issued = { amountMinor: 600000, amountPaidMinor: 300000, status: 'pending', issuedAt: '2026-10-01T09:00:00.000Z', paidAt: null }
const line = (description: string, quantity: number, rate: number) => ({ description, quantity, rate })
const fix = (o: Partial<Parameters<typeof correction>[0]>) => correction({ invoice: issued, items: [line('Website', 1, 6000)], reason: 'Wording', dueDate: '2026-10-20', fmt, now, ...o })

describe('correcting an invoice after money came in', () => {
  it('works the total out as the invoice does, tax included', () => {
    expect(totalMinor([line('A', 2, 1000.5), line('B', 1, 99.99)], 15)) .toBe(Math.round((2001 + 99.99) * 1.15 * 100))
    expect(totalMinor([], 0)).toBe(0)
  })

  it('needs a reason, lines that make sense and a sent invoice', () => {
    expect(fix({ reason: '  ' })).toEqual({ error: expect.stringMatching(/Say why/) })
    expect(fix({ items: [] })).toEqual({ error: 'Add at least one line.' })
    expect(fix({ items: [line('', 1, 1)] })).toEqual({ error: 'Every line needs a description.' })
    expect(fix({ items: [line('A', 0, 1)] })).toEqual({ error: expect.stringMatching(/Quantities/) })
    expect(fix({ items: [line('A', 1, -1)] })).toEqual({ error: expect.stringMatching(/price/) })
    expect(fix({ taxRate: 120 })).toEqual({ error: expect.stringMatching(/Tax/) })
    expect(fix({ dueDate: 'soon' })).toEqual({ error: 'That due date is not a date.' })
    expect(fix({ invoice: { ...issued, issuedAt: null } })).toEqual({ error: expect.stringMatching(/not been sent/) })
  })

  it('never asks for less than was paid', () => {
    expect(fix({ items: [line('Website', 1, 2999)] })).toEqual({ error: expect.stringMatching(/less than the GH₵3,000 already paid/) })
    expect(fix({ items: [line('Website', 1, 3000)] })).toMatchObject({ totalMinor: 300000, status: 'paid', paidAt: '2026-10-07T09:00:00.000Z' })
  })

  it('a paid invoice can be reworded or lowered to what was paid, never raised', () => {
    const paid = { ...issued, amountPaidMinor: 600000, status: 'paid', paidAt: '2026-10-02T09:00:00.000Z' }
    expect(fix({ invoice: paid, items: [line('Website', 1, 6500)] })).toEqual({ error: expect.stringMatching(/Make a new invoice for the extra GH₵500/) })
    expect(fix({ invoice: paid, items: [line('Five-page website', 1, 6000)] })).toMatchObject({ status: 'paid', paidAt: '2026-10-02T09:00:00.000Z' })
  })

  it('works the status out again from what is owed and when it is due', () => {
    expect(fix({ items: [line('Website', 1, 7000)] })).toMatchObject({ totalMinor: 700000, status: 'pending', paidAt: null })
    expect(fix({ items: [line('Website', 1, 7000)], dueDate: '2026-10-01' })).toMatchObject({ status: 'overdue' })
    expect(fix({ items: [line('Website', 1, 7000)], dueDate: '2026-10-06T12:00:00.000Z' })).toMatchObject({ status: 'pending' })
  })
})
