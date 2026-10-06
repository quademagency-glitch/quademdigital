import { describe, expect, it } from 'vitest'
import { cleanDraft, draftNewsletter, inSegment, newsletterPrompt } from '../../src/lib/newsletterDesk'

describe('the newsletter from the portal', () => {
  it('who an audience reaches: the website’s own rule', () => {
    expect(inSegment(['web-design'], 'all')).toBe(true)
    expect(inSegment([], 'seo')).toBe(true)
    expect(inSegment(null, 'video')).toBe(true)
    expect(inSegment(['general'], 'seo')).toBe(true)
    expect(inSegment(['web-design'], 'seo')).toBe(false)
    expect(inSegment(['seo', 'video'], 'video')).toBe(true)
  })

  it('a drafted email is kept to size, with no dashes and only real web links', () => {
    const d = cleanDraft({ subject: 'Three quick wins \u2014 this week', previewText: 'x'.repeat(300), body: 'One.\n\nTwo.', ctaText: 'Book a call', ctaUrl: 'javascript:alert(1)' })
    expect(d.subject).toBe('Three quick wins, this week')
    expect(d.previewText).toHaveLength(160)
    expect(d.body).toBe('One.\n\nTwo.')
    expect(d.ctaUrl).toBe('')
    expect(cleanDraft({ ctaUrl: 'https://quademdigital.com/contact/' }).ctaUrl).toBe('https://quademdigital.com/contact/')
    expect(cleanDraft(null)).toEqual({ subject: '', previewText: '', body: '', ctaText: '', ctaUrl: '' })
  })

  it('the prompt names the audience and carries the notes', () => {
    const p = newsletterPrompt('Google Business Profile tips for restaurants', 'seo')
    expect(p).toContain('people interested in SEO and paid ads')
    expect(p).toContain('Google Business Profile tips for restaurants')
    expect(p).toContain('no em dashes')
  })

  it('end to end with a stand-in model', async () => {
    const d = await draftNewsletter('notes about websites', 'web-design', async () =>
      '```json\n{"subject":"Is your website losing you customers?","previewText":"Three checks","body":"## Three checks\\n\\n- Speed\\n- Phone\\n- A clear button","ctaText":"Get a free check","ctaUrl":"https://quademdigital.com/contact/"}\n```',
    )
    expect(d).toMatchObject({ subject: 'Is your website losing you customers?', ctaText: 'Get a free check' })
    expect(d.body).toContain('- Phone')
  })
})
