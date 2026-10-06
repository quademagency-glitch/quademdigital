import { describe, expect, it } from 'vitest'
import { enquiryNotice, isInbound, servicesOf } from '../../src/lib/enquiries'

describe('enquiries (founder portal)', () => {
  it('knows an enquiry from a lead the team found', () => {
    for (const s of ['contact-form', 'homepage', 'cms-page', 'calculator', 'lead-magnet', 'whatsapp', 'referral']) expect(isInbound(s)).toBe(true)
    for (const s of ['outreach', 'daily-briefing', 'other', '', null]) expect(isInbound(s)).toBe(false)
  })

  it('finds the services wherever the form put them', () => {
    expect(servicesOf({ servicesInterested: ['Web design', 'SEO'] })).toEqual(['Web design', 'SEO'])
    expect(servicesOf({ metadata: { services: ['Branding'] } })).toEqual(['Branding'])
    expect(servicesOf({})).toEqual([])
  })

  it('the notice says who, from where and what they want', () => {
    const n = enquiryNotice({ name: 'Ama Owusu', businessName: 'Ama Bakes', source: 'contact-form', servicesInterested: ['Web design'], budget: 'GHS 2,500 - 6,000', message: 'We need a site\nwith online orders.' })
    expect(n.title).toBe('New enquiry: Ama Owusu (Ama Bakes)')
    expect(n.body).toBe('From the contact page.\nWants: Web design.\nBudget: GHS 2,500 - 6,000.\n"We need a site with online orders."')
    expect(enquiryNotice({ email: 'a@b.co', source: 'lead-magnet', magnetRequested: 'Free website audit' }).body).toBe('From the offer: Free website audit.')
    expect(enquiryNotice({ source: 'homepage', message: 'x'.repeat(400) }).body.length).toBeLessThan(260)
  })
})
