import { describe, expect, it } from 'vitest'
import { balanceLines, money, pdfSafe, receiptEmail, receiptNumber, receiptPdf, type ReceiptData } from '../../src/lib/paymentReceipt'

/* A client's receipt (lib/paymentReceipt.ts), its words and its PDF. Sending it, on a real CMS, is in api.int.spec.ts. */
const base: ReceiptData = {
  number: 'QD-R-2026-0042',
  refund: false,
  corrected: false,
  clientName: 'Mama Ade’s Kitchen',
  contactName: 'Ama Owusu',
  amount: 'GHS 3,000.00',
  date: '14 October 2026',
  method: 'Mobile money',
  reference: 'MM-889',
  forWhat: 'Invoice QD-2026-0007: Business website',
  balance: { kind: 'invoice', label: 'Invoice QD-2026-0007', currency: 'GHS', totalMinor: 600000, paidMinor: 300000, balanceMinor: 300000, link: 'https://quademdigital.com/invoice/QD-2026-0007/?t=x' },
  issuer: { name: 'Quadem Digital Enterprise', address: 'Accra, Ghana', email: 'ernest@quademdigital.com', phone: '+233530890302' },
}

describe('a client’s receipt, its words and its PDF', () => {
  it('numbers and amounts read the same everywhere', () => {
    expect(receiptNumber({ id: 42, clearedAt: '2026-10-14T00:00:00.000Z' })).toBe('QD-R-2026-0042')
    expect(money(300000, 'GHS')).toBe('GHS 3,000.00')
    expect(money(12345, 'USD')).toBe('USD 123.45')
  })

  it('states the balance: what is left, paid in full, or nothing owed', () => {
    expect(balanceLines(base.balance)).toEqual({ headline: 'Balance on Invoice QD-2026-0007: GHS 3,000.00', detail: 'Invoice total GHS 6,000.00, paid so far GHS 3,000.00.' })
    expect(balanceLines({ ...base.balance, paidMinor: 600000, balanceMinor: 0 } as never).headline).toBe('Invoice QD-2026-0007 is now paid in full.')
    expect(balanceLines({ kind: 'deal', label: 'Branding', currency: 'GHS', totalMinor: 500000, paidMinor: 200000, balanceMinor: 300000 }).headline).toBe('Balance on your project: GHS 3,000.00')
    expect(balanceLines({ kind: 'account', currency: 'GHS', balanceMinor: 0, invoices: 0 }).headline).toBe('You owe nothing more right now.')
    expect(balanceLines({ kind: 'account', currency: 'GHS', balanceMinor: 150000, invoices: 2 })).toEqual({ headline: 'Still owed: GHS 1,500.00', detail: 'Across 2 open invoices.' })
    expect(balanceLines({ kind: 'refund' }).headline).toBe('')
  })

  it('the email gives the payment, the balance and a way to pay the rest', () => {
    const { subject, html } = receiptEmail(base)
    expect(subject).toBe('Receipt QD-R-2026-0042: GHS 3,000.00 received, thank you')
    expect(html).toContain('Balance on Invoice QD-2026-0007: GHS 3,000.00')
    expect(html).toContain('View the invoice and pay the balance')
    expect(html).toContain('Mama Ade’s Kitchen')
    expect(html).not.toMatch(/[—–]/)
  })

  it('a refund is a refund confirmation, with no balance', () => {
    const { subject, html } = receiptEmail({ ...base, refund: true, amount: 'GHS 500.00', balance: { kind: 'refund' } })
    expect(subject).toBe('Refund QD-R-2026-0042: GHS 500.00 sent back to you')
    expect(html).toContain('we have refunded <strong>GHS 500.00</strong>')
    expect(html).not.toContain('Balance')
  })

  it('a corrected receipt says it replaces the last one', () => {
    const { subject, html } = receiptEmail({ ...base, corrected: true })
    expect(subject).toMatch(/^Corrected receipt QD-R-2026-0042/)
    expect(html).toContain('It replaces the one we sent before.')
  })

  it('the PDF draws only what its font can, and is a real PDF', async () => {
    expect(pdfSafe('Ọbalende Café ₵')).toBe('Obalende Cafe ?')
    const bytes = await receiptPdf(base)
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-')
    expect(bytes.byteLength).toBeGreaterThan(1500)
    const refund = await receiptPdf({ ...base, refund: true, balance: { kind: 'refund' }, clientName: 'Ọbalende ₦ Stores' })
    expect(refund.byteLength).toBeGreaterThan(1500)
  })
})
