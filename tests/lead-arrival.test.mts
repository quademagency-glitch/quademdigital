import assert from 'node:assert/strict'
import { DIRECT, NOT_RECORDED, describeCampaign, readArrival, siteName } from '../src/lib/leadArrival.ts'

// How a visitor reached the site, as saved on their lead (src/lib/leadArrival.ts).
const host = 'quademdigital.com'
const cookie = (value: unknown) => `theme=dark; qd_arrival=${encodeURIComponent(JSON.stringify(value))}; other=1`
const read = (value: unknown, referer: string | null = null, campaign?: Record<string, string> | null) =>
  readArrival({ cookie: cookie(value), referer, host }, campaign)

// The site that sent them, in words.
assert.equal(siteName('www.google.com'), 'Google search')
assert.equal(siteName('www.google.com.gh'), 'Google search')
assert.equal(siteName('com.google.android.googlequicksearchbox'), 'Google search', 'the Google app on Android')
assert.equal(siteName('mail.google.com'), 'Gmail', 'not Google search')
assert.equal(siteName('gemini.google.com'), 'Gemini', 'not Google search')
assert.equal(siteName('l.instagram.com'), 'Instagram')
assert.equal(siteName('lm.facebook.com'), 'Facebook')
assert.equal(siteName('t.co'), 'X (Twitter)')
assert.equal(siteName('chatgpt.com'), 'ChatGPT')
assert.equal(siteName('clutch.co'), 'A link on clutch.co')
assert.equal(siteName('notgoogle.example'), 'A link on notgoogle.example', 'a name containing google is not Google')

// A search visit that filled in the form on a later page.
const search = read({ r: 'www.google.com', l: '/' }, 'https://quademdigital.com/offers/free-seo-audit/?x=1')
assert.deepEqual(search, { cameFrom: 'Google search', referrer: 'www.google.com', landingPage: '/', formPage: '/offers/free-seo-audit/' })

// Tags on this visit's link say why they came, above the site they came through.
const ad = read({ r: 'www.google.com', l: '/offers/free-seo-audit/', c: 1 }, null, { gclid: 'abc', utm_campaign: 'accra-web' })
assert.equal(ad.cameFrom, 'Google Ads · accra-web')
assert.equal(ad.tagged, true)
assert.equal(read({ r: '', l: '/', c: 1 }, null, { utm_source: 'newsletter', utm_medium: 'email' }).cameFrom, 'Campaign link: newsletter · email')
assert.equal(read({ r: '', l: '/', c: 1 }, null, { ref: 'omek' }).cameFrom, 'Referral link: omek')

// A campaign cookie from an earlier visit is not why they came this time.
const later = read({ r: 'www.bing.com', l: '/' }, null, { utm_source: 'newsletter' })
assert.equal(later.cameFrom, 'Bing search')
assert.equal(later.tagged, undefined)
assert.equal(read({ r: '', l: '/' }, null, { utm_source: 'newsletter' }).cameFrom, DIRECT)

// Facebook and Instagram add their click id even when the app hides the site.
assert.equal(read({ r: '', l: '/', f: 1 }).cameFrom, 'Facebook or Instagram')

// No referring site, and no record at all, are different answers.
assert.equal(read({ r: '', l: '/about/' }).cameFrom, DIRECT)
assert.deepEqual(readArrival({ cookie: 'theme=dark', referer: null, host }), { cameFrom: NOT_RECORDED })
assert.equal(readArrival({ cookie: null, referer: null, host }, { utm_source: 'x' }).cameFrom, 'Campaign link: x', 'cookies from before this existed still say something')

// A forged or broken cookie gets nowhere.
assert.deepEqual(readArrival({ cookie: 'qd_arrival=%7Bnot json', referer: null, host }), { cameFrom: NOT_RECORDED })
assert.deepEqual(readArrival({ cookie: 'qd_arrival=%5B1%5D', referer: null, host }), { cameFrom: NOT_RECORDED })
const forged = read({ r: '<script>alert(1)</script>', l: 'https://evil.example/' })
assert.equal(forged.cameFrom, DIRECT)
assert.equal(forged.referrer, undefined)
assert.equal(forged.landingPage, undefined)
assert.equal(read({ r: '', l: '//evil.example/' }).landingPage, undefined, 'a protocol-relative path is not a page of ours')
assert.equal(read({ r: '', l: `/${'a'.repeat(500)}` }).landingPage?.length, 200, 'capped')

// Only our own pages count as the page the form was on.
assert.equal(read({ r: '', l: '/' }, 'https://evil.example/contact/').formPage, undefined)
assert.equal(read({ r: '', l: '/' }, 'not a url').formPage, undefined)

assert.equal(describeCampaign(null), null)
assert.equal(describeCampaign({}), null)
assert.equal(describeCampaign({ gclid: 'abc' }), 'Google Ads')
