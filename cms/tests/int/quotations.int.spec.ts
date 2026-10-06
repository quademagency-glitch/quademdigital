import { describe, expect, it } from 'vitest'
import { cleanSuggestion, parseReply, quotePrompt, suggestQuote, type CatalogueItem } from '../../src/lib/quoteAi'
import { notSendableQuote, publicQuote, quoteEmail, quoteLink, quoteState, type Quote } from '../../src/lib/quoteDesk'

const catalogue: CatalogueItem[] = [
  { id: 11, name: 'Starter website', kind: 'package', service: 'web-design', priceMinor: 450000, description: 'Five pages', features: ['Five pages', 'Contact form'] },
  { id: 12, name: 'Growth social', kind: 'package', service: 'social-media', priceMinor: 150000, cycle: '/mo' },
  { id: 13, name: 'Custom app', kind: 'package', priceMinor: null },
]

describe('a quotation suggested from notes', () => {
  it('keeps list items at the list price, whatever the model said', () => {
    const s = cleanSuggestion({ lines: [{ planId: 11, description: 'Website', quantity: 1, rate: 99 }] }, catalogue)
    expect(s.lines).toEqual([{ plan: 11, description: 'Website', quantity: 1, rate: 4500 }])
  })

  it('a package the list does not have becomes a custom line marked as an estimate', () => {
    const s = cleanSuggestion({ lines: [{ planId: 999, description: 'Logo design', quantity: 1, rate: 1200 }] }, catalogue)
    expect(s.lines).toEqual([{ description: 'Logo design', quantity: 1, rate: 1200, estimate: true }])
  })

  it('a custom-priced list item takes the model’s figure, as an estimate', () => {
    const s = cleanSuggestion({ lines: [{ planId: '13', description: 'Booking app', rate: '20,000' }] }, catalogue)
    expect(s.lines).toEqual([{ plan: 13, description: 'Booking app', quantity: 1, rate: 20000, estimate: true }])
  })

  it('drops lines it cannot use and keeps the rest in bounds', () => {
    const s = cleanSuggestion(
      {
        lines: [{ description: '', rate: 5 }, { description: 'Thing', rate: -1 }, { description: 'Photos', quantity: 0, rate: 300 }],
        service: 'not-a-service',
        recurring: true,
        durationMonths: 99,
        depositPercent: 120,
        summary: 'We will build it \u2014 fast.',
        deliverables: ['A', '', 'B'],
        questions: ['Domain?'],
      },
      catalogue,
    )
    expect(s.lines).toEqual([{ description: 'Photos', quantity: 1, rate: 300, estimate: true }])
    expect(s).toMatchObject({ service: null, recurring: true, durationMonths: null, depositPercent: 0, deliverables: ['A', 'B'], questions: ['Domain?'] })
    expect(s.summary).toBe('We will build it, fast.')
  })

  it('reads a reply wrapped in a code fence or with words around it', () => {
    expect(parseReply('```json\n{"lines":[]}\n```')).toEqual({ lines: [] })
    expect(parseReply('Here you go: {"why":"x"} thanks')).toEqual({ why: 'x' })
    expect(() => parseReply('no json')).toThrow()
  })

  it('the prompt carries the price list in the client’s currency and the notes', () => {
    const p = quotePrompt('They want a site and monthly posts.', 'NGN', catalogue)
    expect(p).toContain('id 11: Starter website (package), service web-design, NGN 4,500')
    expect(p).toContain('id 13: Custom app (package), custom price')
    expect(p).toContain('They want a site and monthly posts.')
  })

  it('end to end with a stand-in model', async () => {
    const s = await suggestQuote('site and social', 'GHS', catalogue, async () =>
      JSON.stringify({ lines: [{ planId: 11, quantity: 1 }, { planId: 12, quantity: 1 }], service: 'multiple', recurring: false, depositPercent: 50, summary: 'A website and a month of posts.', deliverables: ['Website'], why: 'They asked for both.', questions: [] }),
    )
    expect(s.lines.map((l) => [l.plan, l.rate])).toEqual([[11, 4500], [12, 1500]])
    expect(s).toMatchObject({ service: 'multiple', depositPercent: 50, why: 'They asked for both.' })
  })
})

describe('a quotation’s state, page and email', () => {
  const q: Quote = {
    id: 4,
    quoteNumber: 'QT-2026-0004',
    quoteToken: 'abcdefghijklmnopqrstuvwx',
    quoteSentAt: '2026-10-01T09:00:00Z',
    validUntil: '2026-10-31T00:00:00Z',
    clientName: 'Ama Bakery',
    contactName: 'Ama Owusu',
    clientEmail: 'ama@example.test',
    service: 'web-design',
    currency: 'GHS',
    total: 4500,
    depositPercent: 50,
    summary: 'A five page website.',
    lineItems: [{ description: 'Starter website', quantity: 1, rate: 4500, plan: 11 }],
    dealStatus: 'sent',
  }
  const now = Date.parse('2026-10-06T12:00:00Z')

  it('states', () => {
    expect(quoteState({ ...q, quoteSentAt: null }, now)).toBe('draft')
    expect(quoteState(q, now)).toBe('open')
    // Valid until the end of its last day.
    expect(quoteState(q, Date.parse('2026-10-31T22:00:00Z'))).toBe('open')
    expect(quoteState(q, Date.parse('2026-11-01T01:00:00Z'))).toBe('expired')
    expect(quoteState({ ...q, acceptedAt: '2026-10-05' }, now)).toBe('accepted')
    expect(quoteState({ ...q, dealStatus: 'declined' }, now)).toBe('declined')
  })

  it('the client’s page shows nothing private', () => {
    const v = publicQuote({ ...q, discussionNotes: 'they are price sensitive', suggestionNote: 'x', creditTo: 2 } as Quote, now)
    expect(v).toMatchObject({ number: 'QT-2026-0004', state: 'open', total: 4500, currency: 'GHS', lines: [{ description: 'Starter website', quantity: 1, rate: 4500 }] })
    expect(JSON.stringify(v)).not.toMatch(/price sensitive|suggestion|creditTo|quoteToken|clientEmail/)
  })

  it('what is missing before it can be sent', () => {
    expect(notSendableQuote(q)).toBeNull()
    expect(notSendableQuote({ ...q, clientEmail: '' })).toMatch(/email/)
    expect(notSendableQuote({ ...q, service: null })).toMatch(/service/)
    expect(notSendableQuote({ ...q, total: 0 })).toMatch(/total is nothing/)
    expect(notSendableQuote({ ...q, lineItems: [] })).toMatch(/at least one line/)
  })

  it('the email: the total, the date and the link', () => {
    const m = quoteEmail(q)
    expect(m.subject).toBe('Quotation QT-2026-0004 from Quadem Digital')
    expect(m.text).toContain('Hello Ama,')
    expect(m.text).toContain('Total: GH₵4,500')
    expect(m.text).toContain('Valid until 31 October 2026')
    expect(m.text).toContain(quoteLink('abcdefghijklmnopqrstuvwx'))
    expect(quoteLink('abcdefghijklmnopqrstuvwx')).toBe('https://quademdigital.com/quote/abcdefghijklmnopqrstuvwx/')
    expect(quoteEmail({ ...q, recurring: true }, true).text).toContain('Monthly: GH₵4,500 a month')
    expect(m.html + m.text).not.toContain('\u2014')
  })
})
