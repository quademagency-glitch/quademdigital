import { describe, expect, it } from 'vitest'
import { planEdit, priceText, protectedChange, relabel } from '../../src/lib/pricingRules'

describe('price texts follow the number, in the style they had', () => {
  it('bare numbers, cedis a month, dollars from, custom', () => {
    expect(priceText('5500', 6000, 'ghana', false, null)).toBe('6000')
    expect(priceText('GH₵4,000 a month', 4500, 'ghana', false, '/mo')).toBe('GH₵4,500 a month')
    expect(priceText('from $3,750 a month', 4000, 'international', false, '/mo')).toBe('from $4,000 a month')
    expect(priceText('$3,000', 3500, 'international', false, '')).toBe('$3,500')
    expect(priceText('$3,000', 3500, 'international', true, '')).toBe('Custom')
    expect(priceText(undefined, 1200, 'ghana', false, '')).toBe('GH₵1,200')
  })

  it('a label quoting the old figure quotes the new one; any other label is left', () => {
    expect(relabel('from $3,750', 3750, 4000, 'international')).toBe('from $4,000')
    expect(relabel('Retainer', 3750, 4000, 'international')).toBe('Retainer')
    expect(relabel('from $3,750', 3750, 3750, 'international')).toBe('from $3,750')
    expect(relabel(null, 1, 2, 'ghana')).toBeNull()
  })
})

describe('the homepage bundles keep what the price check finds them by', () => {
  const seen = { name: 'Get seen', market: 'ghana', kind: 'bundle' }
  it('no new name, market or kind', () => {
    expect(protectedChange(seen, { name: 'Get seen plus' })).toMatch(/keeps its name/)
    expect(protectedChange(seen, { market: 'international' })).toMatch(/stays in its market/)
    expect(protectedChange(seen, { kind: 'package' })).toMatch(/stays a bundle/)
    expect(protectedChange(seen, { name: 'Get seen', priceGHS: 2400 })).toBeNull()
  })
  it('the same name is protected in both markets', () => {
    expect(protectedChange({ name: 'Get seen', market: 'international', kind: 'bundle' }, { name: 'Seen' })).toMatch(/keeps its name/)
  })
  it('a package that shares a name is not one of them', () => {
    expect(protectedChange({ name: 'One-page website', market: 'international', kind: 'package' }, { name: 'One page site' })).toBeNull()
  })
  it('the bundles retired on 19 October 2026 can be renamed and switched off', () => {
    expect(protectedChange({ name: 'Starter', market: 'ghana', kind: 'bundle' }, { name: 'One-page website' })).toBeNull()
    expect(protectedChange({ name: 'Video retainer', market: 'international', kind: 'bundle' }, { active: false })).toBeNull()
  })
})

describe('editing a plan', () => {
  const plan = { name: 'Logo Design', market: 'ghana', kind: 'package', price: 'GH₵2,000', priceGHS: 2000, billingCycle: '', custom: false }
  it('a new cedi price rewrites the text', () => {
    expect(planEdit(plan, { priceGHS: 2400 })).toMatchObject({ changes: { priceGHS: 2400, price: 'GH₵2,400' }, oldPrice: 2000, newPrice: 2400 })
  })
  it('needs the price for its market, unless custom', () => {
    expect(planEdit({ ...plan, priceGHS: null }, { name: 'Logo Design' })).toEqual({ error: expect.stringMatching(/price in cedis/) })
    expect(planEdit({ market: 'international', kind: 'package', name: 'X' }, {})).toEqual({ error: expect.stringMatching(/US dollars/) })
    expect(planEdit({ ...plan, priceGHS: null }, { custom: true })).toMatchObject({ changes: { custom: true, price: 'Custom' } })
    expect(planEdit(plan, { priceGHS: -5 })).toEqual({ error: expect.stringMatching(/above nothing/) })
  })
  it('checks where the card leads, and ignores fields it does not edit', () => {
    expect(planEdit(plan, { pageUrl: 'services/web-design' })).toEqual({ error: expect.stringMatching(/slash at each end/) })
    const r = planEdit(plan, { pageUrl: '/services/branding/', calculatorFrom: true, priceUSD: 999 })
    expect(r).toMatchObject({ changes: { pageUrl: '/services/branding/' } })
    expect('calculatorFrom' in (r as { changes: object }).changes || 'priceUSD' in (r as { changes: object }).changes).toBe(false)
  })
})
