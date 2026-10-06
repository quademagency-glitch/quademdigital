import { describe, expect, it } from 'vitest'
import { addMonths, currentDeal, draftInvoice, type DraftClient, type DraftDeal } from '../../src/lib/invoiceDraft'
import { invoiceEmail, notSendable, payLink } from '../../src/lib/invoiceDesk'

const today = new Date('2026-10-06T09:00:00.000Z')
const client: DraftClient = { id: 7, clientName: 'Ama Bakery', service: 'web-design', package: 'Business website', price: 6000, currency: 'GHS', customizations: { depositPercent: 50 } }

describe('a new invoice, filled in from what was agreed', () => {
  it('a first invoice with no deal bills the client’s agreed fee and deposit', () => {
    const d = draftInvoice({ client, deal: null, previous: [], today })
    expect(d.data).toMatchObject({ items: [{ description: 'Business website', quantity: 1, rate: 6000 }], currency: 'GHS', depositPercent: 50, taxRate: 0, dateIssued: '2026-10-06T09:00:00.000Z', dueDate: '2026-10-20T09:00:00.000Z' })
    expect(d.from).toBe('Filled from Ama Bakery’s agreed fee: GH₵6,000 for Business website, 50% deposit to start.')
  })

  it('no fee on record: an empty price, and says so', () => {
    const d = draftInvoice({ client: { ...client, price: null, package: null }, deal: null, previous: [], today })
    expect(d.data.items).toEqual([{ description: 'Web design', quantity: 1, rate: 0 }])
    expect(d.from).toMatch(/no agreed fee on record/)
  })

  it('a one-off deal: its lines, currency and deposit', () => {
    const deal: DraftDeal = { id: 3, packageName: 'Booking site', total: 850000, currency: 'NGN', depositPercent: 40, dealStatus: 'accepted', lineItems: [{ description: 'Design', quantity: 1, rate: 350000 }, { description: 'Build', quantity: 1, rate: 500000 }] }
    const d = draftInvoice({ client, deal, previous: [], today })
    expect(d.data).toMatchObject({ deal: 3, currency: 'NGN', depositPercent: 40, items: [{ description: 'Design', quantity: 1, rate: 350000 }, { description: 'Build', quantity: 1, rate: 500000 }] })
    expect(d.from).toBe('Filled from the deal “Booking site”: ₦850,000, 40% deposit to start.')
  })

  it('a one-off deal with no lines is one line for its total', () => {
    const d = draftInvoice({ client, deal: { id: 3, summary: 'Logo and brand kit', total: 3000, dealStatus: 'active' }, previous: [], today })
    expect(d.data.items).toEqual([{ description: 'Logo and brand kit', quantity: 1, rate: 3000 }])
  })

  it('a one-off deal already invoiced is never billed twice', () => {
    const d = draftInvoice({ client, deal: { id: 3, packageName: 'Booking site', total: 850000, dealStatus: 'accepted' }, previous: [{ id: 1, invoiceId: 'QD-2026-0001', deal: 3, createdAt: '2026-09-01' }], today })
    expect(d.data.items).toEqual([{ description: 'Additional work', quantity: 1, rate: 0 }])
    expect(d.from).toMatch(/already invoiced \(QD-2026-0001\)/)
  })

  it('a retainer bills the next month not yet invoiced', () => {
    const deal: DraftDeal = { id: 9, packageName: 'Social starter', total: 1500, currency: 'GHS', recurring: true, durationMonths: 3, startDate: '2026-08-31T00:00:00.000Z', dealStatus: 'active' }
    const first = draftInvoice({ client, deal, previous: [], today })
    expect(first.data.items).toEqual([{ description: 'Social starter, August 2026', quantity: 1, rate: 1500 }])
    expect(first.data.depositPercent).toBe(0)
    const third = draftInvoice({ client, deal, previous: [{ id: 1, deal: { id: 9 } }, { id: 2, deal: 9 }], today })
    // 31 August plus two months is the last day of October.
    expect(third.data.items[0].description).toBe('Social starter, October 2026')
    expect(third.from).toBe('Filled from the retainer deal “Social starter”: month 3 of 3, GH₵1,500 a month.')
    const fourth = draftInvoice({ client, deal, previous: [{ id: 1, deal: 9 }, { id: 2, deal: 9 }, { id: 3, deal: 9 }], today })
    expect(fourth.from).toMatch(/The agreed 3 months are already invoiced/)
  })

  it('no deal but invoiced before: copies the last invoice, with its tax', () => {
    const d = draftInvoice({
      client,
      deal: null,
      previous: [
        { id: 1, invoiceId: 'QD-2026-0001', createdAt: '2026-08-01', items: [{ description: 'Old', quantity: 1, rate: 1 }], taxRate: 0 },
        { id: 2, invoiceId: 'QD-2026-0002', createdAt: '2026-09-01', items: [{ description: 'Hosting, a year', quantity: 1, rate: 900 }, { description: '', quantity: 1, rate: 5 }], taxRate: 15 },
      ],
      today,
    })
    expect(d.data).toMatchObject({ items: [{ description: 'Hosting, a year', quantity: 1, rate: 900 }], taxRate: 15, depositPercent: 0 })
    expect(d.from).toMatch(/^Copied from QD-2026-0002/)
  })

  it('the deal it bills is an agreed one, the newest first', () => {
    expect(currentDeal([{ id: 1, dealStatus: 'sent' }, { id: 2, dealStatus: 'declined' }, { id: 3, dealStatus: 'draft' }])).toBeNull()
    expect(currentDeal([{ id: 1, dealStatus: 'accepted', acceptedAt: '2026-01-01' }, { id: 2, dealStatus: 'active', acceptedAt: '2026-06-01' }, { id: 4, dealStatus: 'ended', acceptedAt: '2026-09-01' }])?.id).toBe(2)
  })

  it('months keep their day, or the month’s last', () => {
    expect(addMonths(new Date('2026-01-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2026-02-28')
    expect(addMonths(new Date('2026-11-15T00:00:00Z'), 2).toISOString().slice(0, 10)).toBe('2027-01-15')
  })
})

describe('sending an invoice', () => {
  const inv = {
    id: 5,
    invoiceId: 'QD-2026-0005',
    accessToken: 'tok123',
    currency: 'GHS',
    amountMinor: 600000,
    depositMinor: 300000,
    depositPercent: 50,
    amountPaidMinor: 0,
    dueDate: '2026-10-20T09:00:00.000Z',
    items: [{ description: 'Business website', quantity: 1, rate: 6000 }],
    client: { id: 7, clientName: 'Ama Bakery', contactName: 'Ama Owusu', clientEmail: 'ama@example.test' },
  }

  it('says what is missing before it can go', () => {
    expect(notSendable(inv)).toBeNull()
    expect(notSendable({ ...inv, client: { ...inv.client, clientEmail: null } })).toMatch(/email address/)
    expect(notSendable({ ...inv, items: [] })).toMatch(/at least one line/)
    expect(notSendable({ ...inv, items: [{ description: ' ', quantity: 1, rate: 5 }] })).toMatch(/description/)
    expect(notSendable({ ...inv, amountMinor: 0 })).toMatch(/total is nothing/)
  })

  it('the email: the amount, the deposit, the due date and the pay link', () => {
    const m = invoiceEmail(inv)
    expect(m.subject).toBe('Invoice QD-2026-0005 from Quadem Digital')
    expect(m.text).toContain('Hello Ama,')
    expect(m.text).toContain('Amount due: GH₵6,000')
    expect(m.text).toContain('A 50% deposit of GH₵3,000 is enough to start.')
    expect(m.text).toContain('Due by 20 October 2026')
    expect(m.text).toContain(payLink(inv))
    expect(payLink(inv)).toBe('https://quademdigital.com/invoice/QD-2026-0005/?t=tok123')
    expect(m.html + m.text).not.toContain('—')
    // Part paid: what is left, and no deposit line.
    const part = invoiceEmail({ ...inv, amountPaidMinor: 300000 }, true)
    expect(part.text).toContain('Here again is invoice')
    expect(part.text).toContain('Left to pay: GH₵3,000')
    expect(part.text).not.toContain('deposit')
  })
})
