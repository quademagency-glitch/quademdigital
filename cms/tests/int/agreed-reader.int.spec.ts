import { describe, expect, it } from 'vitest'
import { agreedPrompt, cleanAgreed, ModelBusy, withRetry } from '../../src/lib/agreedReader'
import { previewClient } from '../../src/lib/agreementPreview'
import { quotePatchFromAgreed } from '../../src/lib/quoteFromAgreed'

/* What was agreed, read from Ernest's files (lib/agreedReader.ts): what the model says, made safe; a quotation filled from it; the agreement preview's client. Reading on a real CMS is in api.int.spec.ts. */
const empty = cleanAgreed({})

describe('what was agreed, made safe to fill a form with', () => {
  it('keeps what the CMS accepts and empties the rest', () => {
    const a = cleanAgreed({
      clientName: 'Mama Ade’s Kitchen — Osu',
      email: 'not an email',
      country: 'gh',
      service: 'websites',
      currency: 'cedis',
      total: '4,500',
      recurring: 'yes',
      durationMonths: 0,
      depositPercent: 100,
      startDate: '2 November',
      revisions: 3,
      numberOfPages: 5.5,
      deliverables: ['Five page website', '', 42, null],
      lineItems: [{ description: 'Website', quantity: '1', rate: '4,500' }, { description: 'Free extra', quantity: 1, rate: 0 }, { quantity: 1, rate: 100 }],
      toConfirm: ['a', 'b', 'c', 'd', 'e', 'f'],
    })
    expect(a.clientName).toBe('Mama Ade’s Kitchen, Osu')
    expect(a).toMatchObject({ email: null, country: 'GH', service: null, currency: null, total: 4500, recurring: null, durationMonths: null, depositPercent: null, startDate: null, revisions: 3, numberOfPages: null })
    expect(a.deliverables).toEqual(['Five page website', '42'])
    expect(a.lineItems).toEqual([{ description: 'Website', quantity: 1, rate: 4500 }])
    expect(a.toConfirm).toHaveLength(5)
    expect(empty).toMatchObject({ clientName: null, total: null, deliverables: [], lineItems: [], toConfirm: [] })
  })

  it('asks never to invent, to take the last thing agreed, and knows what it is for', () => {
    const won = agreedPrompt('won', '2026-10-17')
    expect(won).toMatch(/Never invent/)
    expect(won).toMatch(/take the last thing both sides agreed/)
    expect(won).toMatch(/service agreement/)
    expect(won).toContain('Today is 2026-10-17')
    expect(agreedPrompt('quote', '2026-10-17')).toMatch(/quotation the client accepts online/)
  })
})

describe('a draft quotation filled from Ernest’s proposal', () => {
  const draft = { currency: 'GHS', clientName: 'Chosen Lead Ltd', clientEmail: '', lineItems: [{ description: 'Agreed work', quantity: 1, rate: 0 }] }

  it('takes the proposal’s lines and terms, custom priced, and never renames who it is for', () => {
    const a = cleanAgreed({
      clientName: 'Some Other Name',
      email: 'owner@chosen.test',
      currency: 'GHS',
      service: 'web-design',
      lineItems: [{ description: 'Five page website', quantity: 1, rate: 4500 }, { description: 'Logo', quantity: 1, rate: 1500 }],
      depositPercent: 50,
      recurring: false,
      deliverables: ['Five pages', 'Contact form'],
      paymentTerms: 'Half to start, half on delivery.',
      toConfirm: ['Is hosting included?'],
    })
    const { patch, note } = quotePatchFromAgreed(a, draft, 'They want to start on 2 November.')
    expect(patch).toMatchObject({ currency: 'GHS', total: 6000, pricing: 'custom', plans: [], service: 'web-design', depositPercent: 50, recurring: false, paymentTerms: 'Half to start, half on delivery.', clientEmail: 'owner@chosen.test' })
    expect(patch.clientName).toBeUndefined()
    expect(patch.deliverables).toEqual([{ item: 'Five pages' }, { item: 'Contact form' }])
    expect(patch.discussionNotes).toBe('They want to start on 2 November.')
    expect(note).toMatch(/^Filled from your proposal\. Check every line/)
    expect(note).toContain('To confirm with the client: Is hosting included?')
    expect(patch.suggestionNote).toBe(note)
  })

  it('a total alone is one line; another currency is said; no prices at all is said too', () => {
    const one = quotePatchFromAgreed(cleanAgreed({ total: 900, currency: 'USD', packageName: 'Starter plan' }), draft)
    expect(one.patch.lineItems).toEqual([{ description: 'Starter plan', quantity: 1, rate: 900 }])
    expect(one.note).toContain('The prices are in USD, as in the proposal, not GHS.')
    const none = quotePatchFromAgreed(empty, draft)
    expect(none.patch.lineItems).toEqual([{ description: 'Agreed work', quantity: 1, rate: 0 }])
    expect(none.note).toContain('No prices were found in it')
  })
})

describe('the agreement preview’s client, as onboarding sees it', () => {
  it('keeps only the agreement’s own settings, and the details onboarding writes from', () => {
    const c = previewClient({
      clientName: ' Kente Cafe ',
      contactName: '',
      clientEmail: 'owner@kente.test',
      service: 'social-media',
      package: 'Grow',
      price: '2500',
      currency: 'GHS',
      startDate: '2026-11-02',
      customizations: { duration: 6, postsPerMonth: 12, platforms: 'Instagram, TikTok', specialTerms: '', stray: 'x' },
    })
    expect(c).toMatchObject({ businessName: 'Kente Cafe', contactName: 'Kente Cafe', email: 'owner@kente.test', service: 'social-media', package: 'Grow', price: 2500, currency: 'GHS', startDate: '2026-11-02' })
    expect(c.customizations).toEqual({ duration: 6, postsPerMonth: 12, platforms: 'Instagram, TikTok' })
  })
})

describe('when Google’s model is busy', () => {
  const busy = Object.assign(new Error('[GoogleGenerativeAI Error]: [503 Service Unavailable] This model is currently experiencing high demand.'), { status: 503 })
  it('waits and asks again, as its error says, and answers when it can', async () => {
    const waited: number[] = []
    let calls = 0
    const r = await withRetry(async () => (++calls < 3 ? Promise.reject(busy) : 'read'), [3000, 8000, 15000], async (ms) => void waited.push(ms))
    expect(r).toBe('read')
    expect(waited).toEqual([3000, 8000])
  })
  it('gives up after the last wait, saying it was busy; anything else fails at once', async () => {
    const waited: number[] = []
    await expect(withRetry(async () => Promise.reject(busy), [1, 2], async (ms) => void waited.push(ms))).rejects.toBeInstanceOf(ModelBusy)
    expect(waited).toEqual([1, 2])
    let calls = 0
    const bad = Object.assign(new Error('[400 Bad Request] invalid argument'), { status: 400 })
    await expect(withRetry(async () => { calls++; return Promise.reject(bad) }, [1, 2], async () => undefined)).rejects.toBe(bad)
    expect(calls).toBe(1)
  })
})
