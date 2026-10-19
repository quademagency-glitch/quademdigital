#!/usr/bin/env node
/*
  Release 1 of Ernest's services restructure, approved 19 October 2026.

  Dry run by default. It prints every change and writes nothing. --live writes.
  Plan: /Users/macbookpro/.claude/plans/do-the-plan-spicy-starfish.md
  Wording: the review document "Quadem website: new wording for review".

  WHAT IT CHANGES

  1. The homepage bundles, in both markets. Three "Build it" cards paid once
     (One-page website, Website up to 5 pages, WhatsApp assistant) and three
     "Grow it" cards paid monthly (Get seen, Get found, Get customers), the same
     names in both markets, each priced from its own list. Africa's "Starter"
     and the international "Website build" were already the one-page website,
     so they are renamed. Ghana Growth and Premium, Video retainer and Growth
     retainer are switched off, never deleted, because deals point at them.
  2. The service packages the team portal's price list reads, renamed to match
     the service pages: the video plans become "4/6/10 videos a month", Growth
     SEO becomes Full SEO, and so on. Buyer profiles becomes Growth plan and
     tracking at GH₵ 3,000 (it now includes tracking). "Ads on top" becomes
     Ads run for you, priced. Calendar and page, and the six branding packages,
     are switched off.
  3. The tier names on the service pages (web design, video, SEO, AI
     automation), so every name on the site is the one the price list uses.
  4. Digital Marketing & Social Media becomes Growth & Performance Marketing:
     title, description, tags, page text, prices and enquiry questions. The
     slug is never sent, so the address stays the same.
  5. Branding: the service row is retitled "(retired)" and kept, because the
     switched-off packages point at it; its calculator row is deleted.
  6. The calculator rows that name a renamed tier.
  7. The homepage: the branding promo goes, the marketing promo is renamed, and
     "Brands" leaves the hero words.
  8. Offers: the free month of social media and 15% off end yesterday, and
     their addresses forward to the free audit, renamed Free Website Check-up.

  The site settings (footer links, site description) are admin-only and are
  changed by migration 20261019_120000_services_restructure_links instead.

  HOW IT WRITES

  Every update sends the whole document back with the changes laid over it.
  payload.update reapplies a field's defaultValue for anything the data does
  not name (cms/CLAUDE.md), and pricingPlans has five fields with defaults
  (market, kind, custom, active, calculatorFrom): a PATCH naming only `name`
  would quietly move an international plan to Africa and switch a package
  into a bundle. A service row is sent without `slug`, which would regenerate
  from the new title and break the address.

  Everything it reads is saved to restructure-services-2026-10-backup.json
  beside it first (gitignored), so any change is one write away from undone.
  It stops at the first failed write and says what was done before it.

  Run:
    node cms/scripts/restructure-services-2026-10.mjs
    node cms/scripts/restructure-services-2026-10.mjs --live
*/

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const LIVE = process.argv.includes('--live')

function readEnv() {
    const out = {}
    const file = join(ROOT, '.env')
    if (!existsSync(file)) return out
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
    return out
}

const env = { ...readEnv(), ...process.env }
const BASE = env.PUBLIC_PAYLOAD_URL
const KEY = env.PAYLOAD_API_KEY
if (!BASE || !KEY) {
    console.error('Need PUBLIC_PAYLOAD_URL and PAYLOAD_API_KEY in the repo root .env.')
    process.exit(2)
}
const headers = { 'Content-Type': 'application/json', Authorization: `users API-Key ${KEY}` }

async function api(method, path, body) {
    const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    const text = await res.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch { json = { raw: text.slice(0, 300) } }
    if (!res.ok) {
        const why = json?.errors?.map((e) => e.message + (e.data?.errors ? ` ${JSON.stringify(e.data.errors)}` : '')).join('; ') || json?.message || text.slice(0, 300)
        throw new Error(`${method} ${path}: HTTP ${res.status} ${why}`)
    }
    return json
}

/* ------------------------------------------------------------------ lexical */

const t = (text, format = 0) => ({ type: 'text', version: 1, format, detail: 0, mode: 'normal', style: '', text })
const p = (...parts) => ({ type: 'paragraph', version: 1, children: parts.map((x) => (typeof x === 'string' ? t(x) : x)) })
const b = (text) => t(text, 1)
const h = (text, tag = 'h2') => ({ type: 'heading', tag, version: 1, children: [t(text)] })
const list = (listType, items) => ({
    type: 'list',
    listType,
    tag: listType === 'number' ? 'ol' : 'ul',
    start: 1,
    version: 1,
    children: items.map((item, i) => ({
        type: 'listitem',
        version: 1,
        value: i + 1,
        children: (Array.isArray(item) ? item : [item]).map((x) => (typeof x === 'string' ? t(x) : x)),
    })),
})
const ul = (...items) => list('bullet', items)
const ol = (...items) => list('number', items)
const doc = (...children) => ({ root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children } })

/* -------------------------------------------------------------------- read */

console.log(LIVE ? 'LIVE RUN: changes will be written.\n' : 'DRY RUN: nothing will be written. Add --live to write.\n')

const [plansRes, servicesRes, calcRes, offersRes, redirectsRes] = await Promise.all([
    api('GET', '/api/pricingPlans?limit=200&depth=0&sort=order'),
    api('GET', '/api/services?limit=50&depth=0'),
    api('GET', '/api/calculatorServices?limit=50&depth=0'),
    api('GET', '/api/offers?limit=50&depth=0'),
    api('GET', '/api/redirects?limit=500&depth=0'),
])
const globalSlugs = ['webDesignPage', 'seoPage', 'videoProductionPage', 'homepage']
const globals = Object.fromEntries(await Promise.all(globalSlugs.map(async (g) => [g, await api('GET', `/api/globals/${g}?depth=0`)])))
const plans = plansRes.docs || []
const services = servicesRes.docs || []
const calc = calcRes.docs || []
const offers = offersRes.docs || []
const redirects = redirectsRes.docs || []
if (!plans.length || !services.length) {
    console.error('The CMS returned no plans or no services. Nothing done.')
    process.exit(2)
}

const backupFile = join(HERE, 'restructure-services-2026-10-backup.json')
if (LIVE || !existsSync(backupFile)) {
    writeFileSync(backupFile, JSON.stringify({ takenAt: new Date().toISOString(), plans, services, calc, offers, redirects, globals }, null, 2))
    console.log(`Backup of everything read: ${backupFile}\n`)
}

/* ------------------------------------------------------------- the changes */

const changes = [] // { what, method, path, body }
const STRIP = ['id', 'createdAt', 'updatedAt', 'globalType']
const whole = (docIn, over, extraStrip = []) => {
    const out = { ...docIn }
    for (const k of [...STRIP, ...extraStrip]) delete out[k]
    return { ...out, ...over }
}
const updateDoc = (collection, docIn, over, what, extraStrip = []) =>
    changes.push({ what, method: 'PATCH', path: `/api/${collection}/${docIn.id}`, body: whole(docIn, over, extraStrip) })
const createDoc = (collection, body, what) => changes.push({ what, method: 'POST', path: `/api/${collection}`, body })
const deleteDoc = (collection, docIn, what) => changes.push({ what, method: 'DELETE', path: `/api/${collection}/${docIn.id}` })
const updateGlobal = (slug, over, what) => changes.push({ what, method: 'POST', path: `/api/globals/${slug}`, body: whole(globals[slug], over) })

const fail = (msg) => {
    console.error(`STOPPED: ${msg}`)
    process.exit(1)
}

const AFRICA = 'ghana' // stored value of the cedi list, see CMS_AFRICA_MARKET
const INTL = 'international'
const fmt = (n) => n.toLocaleString('en-US')
const priceTextFor = (market, n, monthly) =>
    market === INTL ? `from $${fmt(n)}${monthly ? ' a month' : ''}` : `GH₵${fmt(n)}${monthly ? ' a month' : ''}`

/* 1. Homepage bundles ------------------------------------------------------ */

const BUNDLES = [
    {
        name: 'One-page website', order: 1, monthly: false, popular: false, ghs: 2500, usd: 3000, pageUrl: '/services/web-design/',
        description: 'One page, built to do one job, like bringing in enquiries for a single service or a launch.',
        features: ['One custom-designed page, written to bring in enquiries', 'Works properly on a phone', 'Contact form set up and tested', 'Set up so Google can find it', 'Links to your social pages', 'About a week from start to live'],
    },
    {
        name: 'Website, up to 5 pages', order: 2, monthly: false, popular: true, ghs: 5000, usd: 7500, pageUrl: '/services/web-design/',
        description: 'A full business website you can update yourself.',
        features: ['Up to 5 custom-designed pages', 'Change your own text, prices and photos, without calling us', 'A blog you can post to', 'Set up for Google, with visitor tracking', 'Fast to load on any phone', 'About 3 weeks from start to live', '30 days of support after launch'],
    },
    {
        name: 'WhatsApp assistant', order: 3, monthly: false, popular: false, ghs: 3000, usd: 3000, pageUrl: '/services/ai-automation/',
        description: 'Every enquiry answered within a minute, then handed to you with the details filled in.',
        features: ['Replies the moment a message arrives, day or night', 'Asks three questions to find out what the customer needs, then hands over to you', 'Every enquiry saved in a list you can sort, not lost in a chat', 'Shows how fast each enquiry was answered', 'Nothing to pay between enquiries'],
    },
    {
        name: 'Get seen', order: 4, monthly: true, popular: false, ghs: 2200, usd: 1750, pageUrl: '/services/video-production/',
        description: 'Show up every week, without filming anything.',
        features: ['4 AI videos and 12 posts a month, on one platform', 'A monthly content calendar', 'Comments and messages answered', 'A short monthly report'],
    },
    {
        name: 'Get found', order: 5, monthly: true, popular: true, ghs: 4500, usd: 3500, pageUrl: '/services/seo/',
        description: 'Be seen every week and found on Google.',
        features: ['Everything in Get seen, with 6 videos and 20 posts a month on 2 to 3 platforms', 'Your Google Business Profile set up and kept up to date', 'Your business listed on 15 local directories each month', 'Your 5 most important pages tuned for Google', 'Small website changes each month', 'A monthly report on where you rank'],
    },
    {
        name: 'Get customers', order: 6, monthly: true, popular: false, ghs: 12000, usd: 9000, pageUrl: '/services/digital-marketing-social-media/',
        description: 'Content, search and ads working together to bring in customers.',
        features: ['Everything in Get found, with 10 videos and 30 posts a month on every platform', '12 ad designs a month, to test what works', 'Ads run for you on Facebook, Instagram and Google', 'Full SEO: technical fixes, links from other websites and 4 blog posts a month', 'Monthly reporting on enquiries and sales', 'Led by our founder throughout'],
    },
]

const bundleBody = (spec, market) => {
    const n = market === INTL ? spec.usd : spec.ghs
    const text = priceTextFor(market, n, spec.monthly)
    return {
        name: spec.name,
        market,
        kind: 'bundle',
        service: null,
        custom: false,
        active: true,
        calculatorFrom: false,
        price: text,
        priceUSD: market === INTL ? n : null,
        priceGHS: market === INTL ? null : n,
        priceLabel: market === INTL ? `from $${fmt(n)}` : null,
        billingCycle: spec.monthly ? '/mo' : '',
        description: spec.description,
        isPopular: spec.popular,
        features: spec.features.map((feature) => ({ feature })),
        buttonText: 'Book a call',
        pageUrl: spec.pageUrl,
        order: spec.order,
    }
}

const isBundle = (p) => p.kind !== 'package'
const findBundle = (name, market) => plans.find((p) => isBundle(p) && p.name === name && p.market === market)
const RENAME_INTO = { [AFRICA]: { 'One-page website': 'Starter' }, [INTL]: { 'One-page website': 'Website build' } }

for (const market of [AFRICA, INTL]) {
    for (const spec of BUNDLES) {
        const label = `${market === INTL ? 'international' : 'africa'} bundle "${spec.name}"`
        const already = findBundle(spec.name, market)
        const renameFrom = RENAME_INTO[market][spec.name]
        const old = already || (renameFrom && findBundle(renameFrom, market))
        const body = bundleBody(spec, market)
        if (old) {
            // Keep the record's own price text style when the number is unchanged (the Africa
            // bundles hold a bare "2500"), so the portal reads it the way it always has.
            const sameNumber = market === INTL ? old.priceUSD === body.priceUSD : Number(old.priceGHS) === body.priceGHS
            if (sameNumber && old.price) body.price = old.price
            updateDoc('pricingPlans', old, body, `${label}: ${old.name === spec.name ? 'rewritten' : `renamed from "${old.name}"`}, ${body.price} ${spec.monthly ? 'monthly' : 'once'}`)
        } else {
            createDoc('pricingPlans', body, `${label}: created, ${body.price} ${spec.monthly ? 'monthly' : 'once'}`)
        }
    }
}

const SWITCH_OFF_BUNDLES = [['Growth', AFRICA], ['Premium', AFRICA], ['Video retainer', INTL], ['Growth retainer', INTL]]
for (const [name, market] of SWITCH_OFF_BUNDLES) {
    const old = findBundle(name, market)
    if (!old) { console.log(`  (no ${market} bundle "${name}" to switch off; skipped)`); continue }
    if (old.active === false) continue
    updateDoc('pricingPlans', old, { active: false }, `${market === INTL ? 'international' : 'africa'} bundle "${name}": switched off (kept for the deals that point at it)`)
}

/* 2. Service packages (the portal's price list) ---------------------------- */

const serviceId = Object.fromEntries(services.map((s) => [s.slug, s.id]))
const sid = (slug) => serviceId[slug] ?? fail(`no service with slug ${slug}`)
const packagesOf = (slug) => plans.filter((p) => p.kind === 'package' && p.service === sid(slug))

const PACKAGE_RENAMES = {
    'web-design-development': { 'Landing Page': 'One-page website', 'Corporate Site (up to 5 pages)': 'Website, up to 5 pages', 'E-Commerce': 'Online shop' },
    'video-production': { 'Reel Pack (3 reels)': '3-reel pack', Starter: '4 videos a month', Growth: '6 videos a month', Scale: '10 videos a month' },
    'seo-paid-ads': { 'Growth SEO': 'Full SEO', Enterprise: 'Custom SEO' },
    'ai-automation': { 'The build': 'WhatsApp assistant', 'Beyond the standard build': 'Bigger setups' },
}
for (const [slug, map] of Object.entries(PACKAGE_RENAMES)) {
    for (const pkg of packagesOf(slug)) {
        const to = map[pkg.name]
        if (to) updateDoc('pricingPlans', pkg, { name: to }, `${pkg.market} package "${pkg.name}" (${slug}): renamed "${to}"`)
    }
}

for (const pkg of packagesOf('digital-marketing-social-media')) {
    const where = `${pkg.market} package "${pkg.name}" (marketing)`
    if (pkg.name === 'Buyer profiles') {
        const over = { name: 'Growth plan and tracking' }
        if (pkg.market === AFRICA) Object.assign(over, { priceGHS: 3000, price: 'GH₵3,000' })
        updateDoc('pricingPlans', pkg, over, `${where}: renamed "Growth plan and tracking"${pkg.market === AFRICA ? ', GH₵ 2,500 to GH₵ 3,000' : ''}`)
    } else if (pkg.name === 'Calendar and page management') {
        updateDoc('pricingPlans', pkg, { active: false, calculatorFrom: false }, `${where}: switched off (page replies are now in every monthly plan)`)
    } else if (pkg.name.startsWith('Ads on top')) {
        const over = pkg.market === INTL
            ? { name: 'Ads run for you', custom: false, calculatorFrom: true, priceUSD: 1500, price: '$1,500 a month', billingCycle: '/mo' }
            : { name: 'Ads run for you', custom: false, calculatorFrom: true, priceGHS: 2000, price: 'GH₵2,000 a month', billingCycle: '/mo' }
        updateDoc('pricingPlans', pkg, over, `${where}: renamed "Ads run for you", ${over.price}`)
    }
}
for (const market of [AFRICA, INTL]) {
    const exists = plans.some((p) => p.kind === 'package' && p.service === sid('digital-marketing-social-media') && p.market === market && p.name === 'Bigger campaigns')
    if (!exists) {
        createDoc('pricingPlans', {
            name: 'Bigger campaigns', market, kind: 'package', service: sid('digital-marketing-social-media'), custom: true, active: true,
            calculatorFrom: false, price: 'Custom', priceUSD: null, priceGHS: null, priceLabel: null, billingCycle: '/mo',
            description: 'Several countries, product ads for online shops, or TikTok. Priced on the size of the budget and the number of audiences.',
            isPopular: false, features: [], order: 112,
        }, `${market} package "Bigger campaigns" (marketing): created, Custom`)
    }
}

for (const pkg of packagesOf('branding-graphic-design')) {
    if (pkg.active === false) continue
    updateDoc('pricingPlans', pkg, { active: false, calculatorFrom: false }, `${pkg.market} package "${pkg.name}" (branding): switched off`)
}

/* 3. Tier names on the service pages ---------------------------------------- */

const renameTiers = (plansIn, map) => (plansIn || []).map((tier) => (map[tier.name] ? { ...tier, name: map[tier.name] } : tier))
const tierChanges = (plansIn, map) => (plansIn || []).filter((tier) => map[tier.name]).map((tier) => `"${tier.name}" to "${map[tier.name]}"`)

const WEB_TIERS = { 'Landing Page': 'One-page website', 'Corporate Site': 'Website, up to 5 pages', 'E-Commerce': 'Online shop' }
const VIDEO_TIERS = { 'Reel Pack': '3-reel pack', Starter: '4 videos a month', Growth: '6 videos a month', Scale: '10 videos a month' }
const SEO_TIERS = { 'Growth SEO': 'Full SEO', Enterprise: 'Custom SEO' }

{
    const g = globals.webDesignPage
    const names = tierChanges(g.pricingSection?.plans, WEB_TIERS)
    updateGlobal('webDesignPage', {
        pricingSection: { ...g.pricingSection, plans: renameTiers(g.pricingSection?.plans, WEB_TIERS) },
        ctaSection: { ...g.ctaSection, primaryButtonText: g.ctaSection?.primaryButtonText === 'Get Web Dev Discount' ? 'Book a free call' : g.ctaSection?.primaryButtonText },
    }, `web design page: tiers ${names.join(', ')}; button "Get Web Dev Discount" to "Book a free call" (it now books a call)`)
}
{
    const g = globals.videoProductionPage
    const names = tierChanges(g.pricingSection?.plans, VIDEO_TIERS)
    updateGlobal('videoProductionPage', {
        pricingSection: {
            ...g.pricingSection,
            plans: renameTiers(g.pricingSection?.plans, VIDEO_TIERS),
            note: "* Packs are paid up front. Monthly plans are billed monthly, and you can cancel with 30 days' notice. Want ads run with your videos? See Growth & Performance Marketing.",
        },
    }, `video page: tiers ${names.join(', ')}; the ad-management line now points at performance marketing`)
}
{
    const g = globals.seoPage
    const names = tierChanges(g.pricingSection?.plans, SEO_TIERS)
    updateGlobal('seoPage', { pricingSection: { ...g.pricingSection, plans: renameTiers(g.pricingSection?.plans, SEO_TIERS) } }, `SEO page: tiers ${names.join(', ')}`)
}

/* 4 and 5. Service rows ---------------------------------------------------- */

const svc = (slug) => services.find((s) => s.slug === slug) || fail(`no service ${slug}`)
const parsed = (v) => (typeof v === 'string' ? JSON.parse(v) : v)

{
    const s = svc('ai-automation')
    const ps = parsed(s.pricingSection) || {}
    const map = { 'The build': 'WhatsApp assistant', 'Beyond the standard build': 'Bigger setups' }
    // order 2: second in "Build it" on the services page, after web design.
    updateDoc('services', s, { order: 2, pricingSection: { ...ps, plans: renameTiers(ps.plans, map) } }, `AI automation: tiers ${tierChanges(ps.plans, map).join(', ')}; listed second, after web design`, ['slug'])
}

const MARKETING_BODY = doc(
    h('What you get'),
    ul(
        'A written plan of who buys from you, what makes them buy now, and what they need to see first',
        'Tracking set up, so every enquiry and sale from an ad is counted',
        'Ads on Facebook, Instagram and Google, set up and run for you',
        "Ads checked and adjusted every week, with fresh designs so people don't tune out",
        'A monthly report on what each enquiry cost you',
    ),
    p(b('Who it is for: '), "businesses ready to spend on ads that want to know what they get back. We'll recommend a starting ad budget on our first call, and tell you honestly if ads aren't the right next step."),

    h('How it works'),
    ol(
        [b('Free call (30 minutes). '), t("What you sell, who buys and what you've tried before.")],
        [b('Growth plan and tracking (about two weeks). '), t('We write your buyer profiles and campaign plan, and set up tracking.')],
        [b('Launch (first week). '), t('Your first ads go live in several versions, so we can see what works.')],
        [b('Improve every week. '), t("We move money to what works, cut what doesn't and report monthly.")],
    ),

    h("Work we've done"),
    p('For Omek Gigs Appliances, a home appliance retailer with branches across Ghana, the work started with six written buyer profiles before a single ad was made.'),
    p('One example: the new homeowner furnishing an empty house buys three to five items at once and worries about refurbished goods sold as new. The family whose fridge died yesterday buys one thing, urgently, and cares most about the electricity bill. Those need different ads, pictures and places to run them.'),
    p(b("What you won't find here: "), "reach figures or return on ad spend. We'll publish results once a campaign has recorded before-and-after numbers we can stand behind."),

    h('Common questions'),
    h('How much should I spend on ads?', 'h3'),
    p("It depends on your market and goals. We recommend a starting budget on the first call. Too little, and the ads can't learn what works."),
    h('Is the ad budget included in your fee?', 'h3'),
    p('No. You pay Meta or Google directly, so you always see what was spent.'),
    h('Will you post on my social pages too?', 'h3'),
    p('This service is ads. Regular posts and videos are in our monthly Grow it plans and AI video.'),
    h('How soon will I see results?', 'h3'),
    p('Ads bring in data from the first week. It usually takes a few weeks of testing to find what works best.'),
    h('Can you handle a large ad budget?', 'h3'),
    p('Yes. Bigger campaigns are planned in phases, with tracking and a report at every step.'),
)

{
    const s = svc('digital-marketing-social-media')
    const ps = parsed(s.pricingSection) || {}
    const form = parsed(s.enquiryForm) || {}
    const choice = (choices) => choices.map((c) => ({ choice: c }))
    updateDoc('services', s, {
        title: 'Growth & Performance Marketing',
        // After video (4) and SEO (5) in "Grow it", the order of the monthly levels: seen, found, customers.
        order: 6,
        description: 'We run ads on Facebook, Instagram and Google that are judged by the enquiries and sales they bring, not by likes. It starts with knowing exactly who buys from you.',
        tags: [{ tag: 'Meta and Google Ads' }, { tag: 'Sales Tracking' }, { tag: 'Buyer Profiles' }],
        body: MARKETING_BODY,
        pricingSection: {
            ...ps,
            heading: 'What it costs',
            subtitle: 'The growth plan comes first and is yours to keep. The ads then run monthly.',
            note: "Your ad budget is separate and paid straight to Meta or Google, so you always see exactly what was spent. If you already have written buyer profiles and tracking, we'll tell you and skip that part.",
            plans: [
                {
                    name: 'Growth plan and tracking', price: 'GH₵ 3,000', priceUsd: 'from $3,000', period: 'one off', isPopular: false,
                    description: 'Who buys from you and why, a campaign plan, and tracking so every enquiry and sale from an ad is counted.',
                    features: [{ feature: 'Written profiles of who buys and why' }, { feature: 'A campaign plan: which ads, audiences and offers' }, { feature: 'Tracking so every enquiry and sale from an ad is counted' }, { feature: 'Yours to keep long after any campaign' }],
                },
                {
                    name: 'Ads run for you', price: 'GH₵ 2,000', priceUsd: 'from $1,500', period: 'a month', isPopular: true,
                    description: 'Ads on Facebook, Instagram and Google, run for you and checked every week.',
                    features: [{ feature: 'Ads on Facebook, Instagram and Google, run for you' }, { feature: 'Checked and adjusted weekly' }, { feature: "Fresh ad designs, so people don't tune out" }, { feature: 'A monthly report on what each enquiry cost' }, { feature: "Cancel with 30 days' notice" }],
                },
                {
                    name: 'Bigger campaigns', price: 'Custom', priceUsd: 'Custom', period: 'a month', isPopular: false,
                    description: 'Several countries, product ads for online shops, or TikTok. Priced on the size of the budget and the number of audiences.',
                    features: [],
                },
            ],
        },
        enquiryForm: {
            ...form,
            heading: 'Tell us about your customers',
            intro: 'Ads start with who buys, so these questions are about them.',
            questionsHeading: 'About your customers',
            buttonLabel: form.buttonLabel || 'Send enquiry',
            questions: [
                { label: 'Where do your customers spend time?', key: 'platforms', inputType: 'choice', choices: choice(['Instagram and Facebook', 'TikTok', 'LinkedIn', 'Google search', 'I am not sure yet']) },
                { label: 'Have you run ads before?', key: 'ads-before', inputType: 'choice', choices: choice(['No, never', 'Yes, ourselves', 'Yes, with an agency or freelancer']) },
                { label: 'What would a great month of enquiries look like?', key: 'goal', inputType: 'longtext', placeholder: 'For example: 20 serious enquiries a month from Accra and Kumasi.', choices: [] },
            ],
        },
    }, 'Digital Marketing & Social Media: becomes Growth & Performance Marketing (title, description, tags, page text, prices, enquiry questions; address unchanged)', ['slug'])
}

{
    const s = svc('seo-paid-ads')
    updateDoc('services', s, { tags: [{ tag: 'Google Business Profile' }, { tag: 'Organic Ranking' }, { tag: 'Blog Content' }] }, 'SEO: tags "Google Ads, Meta Ads, Organic Ranking" to "Google Business Profile, Organic Ranking, Blog Content"', ['slug'])
}
{
    const s = svc('branding-graphic-design')
    if (!/\(retired\)/.test(s.title)) updateDoc('services', s, { title: 'Branding & Graphic Design (retired)' }, 'Branding: retitled "(retired)", kept for the switched-off packages that point at it', ['slug'])
}

/* 6. Calculator rows -------------------------------------------------------- */

for (const row of calc) {
    const d = String(row.description || '')
    if (/^Branding/i.test(row.name)) {
        deleteDoc('calculatorServices', row, `calculator row "${row.name}": deleted (branding retired)`)
    } else if (/Digital Marketing/i.test(row.name)) {
        updateDoc('calculatorServices', row, {
            name: 'Growth & Performance Marketing', basePrice: 2000, priceGHS: 2000, priceUSD: 1500, billingCycle: '/mo',
            description: 'Ads on Facebook, Instagram and Google, run for you and checked every week, with a monthly report on what each enquiry cost. Your ad budget is separate. Matches Ads run for you on the growth and performance marketing page.',
        }, `calculator row "${row.name}": becomes Growth & Performance Marketing, GH₵ 2,000 / $1,500 a month`)
    } else {
        const next = d
            .replace('Matches the Starter plan on the video page', 'Matches 4 videos a month on the video page')
            .replace('Matches Landing Page on the web design page', 'Matches One-page website on the web design page')
            .replace('Matches The build on the AI automation page', 'Matches WhatsApp assistant on the AI automation page')
            .replace(/Growth SEO/g, 'Full SEO')
            .replace(/the Corporate Site/g, 'the Website, up to 5 pages')
            .replace(/Corporate Site/g, 'Website, up to 5 pages')
        if (next !== d) updateDoc('calculatorServices', row, { description: next }, `calculator row "${row.name}": names the renamed tier`)
    }
}

/* 7. Homepage --------------------------------------------------------------- */

{
    const g = globals.homepage
    const promos = (g.promoSections || [])
        .filter((pr) => pr.visual !== 'brandIdentity')
        .map((pr) => pr.visual === 'digitalMarketing'
            ? { ...pr, badge: 'Performance Marketing', heading: 'Ads that bring', headingAccent: 'enquiries, not likes', body: 'Ads on Facebook, Instagram and Google, judged by the enquiries and sales they bring.', ctaLabel: 'See performance marketing' }
            : pr)
    const heroServices = (g.heroServices || []).filter((x) => x.service !== 'Brands')
    updateGlobal('homepage', { promoSections: promos, heroServices }, 'homepage: branding promo removed, marketing promo renamed, "Brands" out of the hero words')
}

/* 8. Offers and their redirects --------------------------------------------- */

const offer = (slug) => offers.find((o) => o.slug === slug)
for (const slug of ['social-media-bonus', 'web-dev-discount']) {
    const o = offer(slug)
    if (!o) { console.log(`  (no offer ${slug}; skipped)`); continue }
    if (!o.expiresAt) updateDoc('offers', o, { expiresAt: '2026-10-18T00:00:00.000Z' }, `offer "${o.title}": ends 18 October 2026, so it is gone from today`, ['slug'])
    const from = `/offers/${slug}`
    if (!redirects.some((r) => String(r.fromPath).replace(/\/$/, '') === from)) {
        createDoc('redirects', { fromPath: from, toPath: '/offers/free-seo-audit/', type: 'permanent', enabled: true, note: 'Offer ended 19 October 2026 (services restructure). Old links go to the free website check-up, the one offer kept.' }, `redirect ${from}/ to /offers/free-seo-audit/`)
    }
}
{
    const o = offer('free-seo-audit') || fail('no free-seo-audit offer')
    updateDoc('offers', o, {
        title: 'Free Website Check-up',
        description: "Not sure what's holding your website back? We check its speed, how it works on phones and how you show up on Google, then send you a short list of what to fix first. Free, with no obligation.",
        cta: 'Get my free check-up',
    }, 'offer "Free Technical SEO & Website Performance Audit": renamed Free Website Check-up', ['slug'])
}

/* ------------------------------------------------------------------ report */

console.log(`${changes.length} changes:\n`)
for (const [i, c] of changes.entries()) console.log(`${String(i + 1).padStart(2)}. ${c.what}`)
console.log('')

if (!LIVE) {
    console.log('Dry run. Nothing written. Run with --live to write these.')
    process.exit(0)
}

for (const [i, c] of changes.entries()) {
    try {
        await api(c.method, c.path, c.body)
        console.log(`  done ${i + 1}/${changes.length}  ${c.what}`)
    } catch (err) {
        console.error(`\nFAILED at ${i + 1}/${changes.length}: ${c.what}\n  ${err.message}`)
        console.error(`\n${i} change(s) before it were written. The backup is ${backupFile}.`)
        process.exit(1)
    }
}
console.log(`\nAll ${changes.length} changes written. Allow a minute for the site's cache, then run npm run check:all.`)
