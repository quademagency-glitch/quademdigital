#!/usr/bin/env node
/*
  Release 2 of Ernest's services restructure: the wording, in plain language,
  led by the results clients get.

  Dry run by default. --live writes. --plan=<file> writes the planned changes
  to a file for previewing the site, and writes nothing to the CMS.
  Wording: the review document "Quadem website: new wording for review".

  THE RULES THIS WORDING FOLLOWS (Ernest, 19 October 2026)

  - Every headline says what the client gets: more enquiries and sales, every
    enquiry answered, found on Google, a known cost per enquiry.
  - "We" for the business. No founder selling ("led by our founder", "work
    directly with Ernest") and no location ("Accra", "Built for Ghana").
  - No invented people, numbers or guarantees. The proof is real: Omek's main
    picture 19.3s to 2.9s on a phone, the assistant's 64 seconds.

  WHAT IT CHANGES

  The homepage (hero, promise, service cards, results, contact, search
  wording), the contact page, the four steps, the homepage questions, the About page, the web
  design, SEO and video pages, and the AI automation and Fieldwork rows'
  descriptions, page text and enquiry forms. Prices are untouched: those are
  release 1 (restructure-services-2026-10.mjs), which must already have run.

  It writes whole documents with the changes laid over them, for the same
  reason as release 1 (payload.update reapplies defaults for fields a write
  leaves out), never sends a service's slug, and backs up everything it reads
  to plain-language-copy-2026-10-backup.json first (gitignored).

  Run:
    node cms/scripts/plain-language-copy-2026-10.mjs
    node cms/scripts/plain-language-copy-2026-10.mjs --live
    node cms/scripts/plain-language-copy-2026-10.mjs --plan=/tmp/plan2.json
*/

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const LIVE = process.argv.includes('--live')
const PLAN_OUT = (process.argv.find((x) => x.startsWith('--plan=')) || '').slice('--plan='.length)

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
const b = (text) => t(text, 1)
const p = (...parts) => ({ type: 'paragraph', version: 1, children: parts.map((x) => (typeof x === 'string' ? t(x) : x)) })
const h = (text, tag = 'h2') => ({ type: 'heading', tag, version: 1, children: [t(text)] })
const list = (listType, items) => ({
    type: 'list', listType, tag: listType === 'number' ? 'ol' : 'ul', start: 1, version: 1,
    children: items.map((item, i) => ({ type: 'listitem', version: 1, value: i + 1, children: (Array.isArray(item) ? item : [item]).map((x) => (typeof x === 'string' ? t(x) : x)) })),
})
const ul = (...items) => list('bullet', items)
const ol = (...items) => list('number', items)
const doc = (...children) => ({ root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children } })

/* -------------------------------------------------------------------- read */

console.log(LIVE ? 'LIVE RUN: changes will be written.\n' : 'DRY RUN: nothing will be written. Add --live to write.\n')

const GLOBALS = ['homepage', 'about', 'contactPage', 'servicesPage', 'webDesignPage', 'seoPage', 'videoProductionPage']
const globals = Object.fromEntries(await Promise.all(GLOBALS.map(async (g) => [g, await api('GET', `/api/globals/${g}?depth=0`)])))
const [servicesRes, stepsRes, faqsRes] = await Promise.all([
    api('GET', '/api/services?limit=50&depth=0'),
    api('GET', '/api/processSteps?limit=20&depth=0'),
    api('GET', '/api/faqs?limit=100&depth=0&sort=order'),
])
const services = servicesRes.docs || []
const steps = stepsRes.docs || []
const faqs = faqsRes.docs || []

const backupFile = join(HERE, 'plain-language-copy-2026-10-backup.json')
if (LIVE || !existsSync(backupFile)) {
    writeFileSync(backupFile, JSON.stringify({ takenAt: new Date().toISOString(), globals, services, steps, faqs }, null, 2))
    console.log(`Backup of everything read: ${backupFile}\n`)
}

const changes = []
const STRIP = ['id', 'createdAt', 'updatedAt', 'globalType']
const whole = (d, over, extra = []) => { const o = { ...d }; for (const k of [...STRIP, ...extra]) delete o[k]; return { ...o, ...over } }
const updateDoc = (collection, d, over, what, extra = []) => changes.push({ what, method: 'PATCH', path: `/api/${collection}/${d.id}`, body: whole(d, over, extra) })
const createDoc = (collection, body, what) => changes.push({ what, method: 'POST', path: `/api/${collection}`, body })
const deleteDoc = (collection, d, what) => changes.push({ what, method: 'DELETE', path: `/api/${collection}/${d.id}` })
const updateGlobal = (slug, over, what) => changes.push({ what, method: 'POST', path: `/api/globals/${slug}`, body: whole(globals[slug], over) })
const fail = (msg) => { console.error(`STOPPED: ${msg}`); process.exit(1) }

/* Lay new text over an array of rows by position, keeping each row's id and
   any field the new text does not name (icons, images). Fails loudly if the
   CMS holds a different number of rows than the wording was written for. */
const overRows = (rows, next, label) => {
    if ((rows || []).length !== next.length) fail(`${label}: the CMS has ${(rows || []).length} rows, the wording has ${next.length}`)
    return rows.map((row, i) => ({ ...row, ...next[i] }))
}
const features = (...items) => items.map((feature) => ({ feature }))

/* --------------------------------------------------------------- homepage */

{
    const g = globals.homepage
    const promo = {
        webDesign: { badge: 'Build it', heading: 'A website that', headingAccent: 'sells for you', body: 'More enquiries and sales from the people who visit, from one page to a full online shop.', ctaLabel: 'See web design' },
        aiAutomation: { badge: 'Build it', heading: 'Never miss', headingAccent: 'an enquiry', body: 'Every enquiry answered within a minute, day or night, so no buyer goes elsewhere while you sleep.', ctaLabel: 'See the WhatsApp assistant' },
        video: { badge: 'Grow it', heading: 'Stay seen', headingAccent: 'every week', body: 'Fresh videos and posts every week keep you in front of buyers, with no shoot day.', ctaLabel: 'See AI video' },
        seo: { badge: 'Grow it', heading: 'Get found', headingAccent: 'on Google', body: 'More visitors who are already searching for what you sell, without paying for every click.', ctaLabel: 'See SEO' },
        digitalMarketing: { badge: 'Grow it', heading: 'Ads that bring', headingAccent: 'enquiries, not likes', body: 'Ads on Facebook, Instagram and Google, judged by the enquiries and sales they bring.', ctaLabel: 'See performance marketing' },
        fieldwork: { badge: 'Grow it', heading: 'Know exactly', headingAccent: 'who to call', body: 'A fresh list every month of businesses that fit your ideal customer, so sales time goes on the right people.', ctaLabel: 'See Fieldwork' },
    }
    const ORDER = ['webDesign', 'aiAutomation', 'video', 'seo', 'digitalMarketing', 'fieldwork']
    const promoSections = (g.promoSections || [])
        .filter((pr) => promo[pr.visual])
        .map((pr) => ({ ...pr, ...promo[pr.visual] }))
        .sort((a, z) => ORDER.indexOf(a.visual) - ORDER.indexOf(z.visual))
    updateGlobal('homepage', {
        heroEyebrow: 'Websites · AI video · Search · Ads',
        heroPresentation: {
            ...g.heroPresentation,
            heading: 'More enquiries.',
            accent: 'More sales.',
            body: 'We build websites, make AI video, get you found on Google and run your ads, all aimed at one result: more customers for your business.',
            note: 'A fixed price before we start, and a report every month on what it brought in.',
        },
        heroMetaLabels: 'Fixed prices,Monthly reports',
        primaryCta: { label: 'Get a free website check-up', link: '/offers/free-seo-audit/' },
        secondaryCta: { label: 'See our work', link: '#work' },
        heroTagline: 'Websites, AI video, search and ads that bring businesses more enquiries and sales.',
        heroHeadline: 'Websites, AI video, search and ads, built to bring in customers.',
        heroSubheadline: 'Every piece is built around one action, an enquiry or a sale, and measured against it.',
        riskReversal: { ...g.riskReversal, enabled: true, heading: 'Your project, without the risk.', body: 'You know the price and the timeline before we start. You pay in stages, see progress every week in your client portal, and we refine the work until you sign it off.' },
        trustHighlights: [
            { icon: null, title: 'More enquiries from your website', description: 'One clear action on every page and fast loading on any phone. Enquiries counted from day one.' },
            { icon: null, title: 'Every enquiry answered', description: 'A WhatsApp assistant that replies within a minute, with a record of how fast each one was answered.' },
            { icon: null, title: 'Found on Google', description: 'Local listings, tuned pages and helpful articles, with a monthly report on where you rank.' },
            { icon: null, title: 'Ads that pay their way', description: 'Tracking first, then ads checked every week, with what each enquiry cost reported every month.' },
        ],
        promoSections,
        contactHeading: "Let's get you more customers.",
        contactSubheading: 'Fill in the form or message us on WhatsApp.',
        contactInfoTitle: 'Get in touch',
        contactInfoText: "Tell us what you want to achieve and we'll come back with a clear next step.",
        contactWhatsappButtonText: 'Chat on WhatsApp',
        contactSubmitButtonText: 'Send message',
        contactFormSuccessMessage: "Thanks for getting in touch. We'll reply shortly.",
        meta: { ...g.meta, title: 'Quadem Digital | Websites, AI Video, SEO and Ads That Bring In Customers', description: 'We build websites, WhatsApp assistants, AI video, SEO and ads designed to bring businesses more enquiries and sales, with a report every month.' },
    }, 'homepage: hero, promise, service cards, results, contact and search wording')
}

/* ----------------------------------------------------------- the 4 steps */

const STEPS = {
    1: { title: 'Free check-up', description: 'We look at your website and how you show up on Google, then send a short list of what to fix first.' },
    2: { title: 'A clear plan and a fixed price', description: "We agree what you get, when it's ready and what it costs. You get the price in writing before any work starts." },
    3: { title: 'We build it', description: 'You see progress every week in your client portal and approve each stage.' },
    4: { title: 'We help it grow', description: "After launch, a monthly plan keeps your videos, search and ads working. Cancel with 30 days' notice." },
}
for (const s of steps) {
    const next = STEPS[s.stepNumber]
    if (next && (s.title !== next.title || s.description !== next.description)) updateDoc('processSteps', s, next, `step ${s.stepNumber}: "${s.title}" becomes "${next.title}"`)
}

/* ------------------------------------------------------ homepage questions */

const FAQ_ANSWERS = [
    ['How much will my project cost?', 'How much will my project cost?', "You get a fixed price in writing before any work starts. No hourly billing, no surprise invoices. Tell us what you want to achieve and we'll quote within 24 hours."],
    ['How long does it take?', 'How long does it take?', 'A one-page website takes about a week, and most business websites go live in 2 to 4 weeks. We agree the timeline before we start, and you see progress every week.'],
    ['What do you need from me to get started?', 'What do you need from me to get started?', "A short conversation about your business and your customers. Then your logo, any photos you want used, and a rough idea of what you want to say. If you don't have the words, we can write them."],
    ['Can my customers pay on the site with Mobile Money?', 'Can my customers pay with Mobile Money?', 'Yes. We set up Mobile Money and card payments through Paystack. Money goes straight to your account.'],
    ['Will I be able to update the site myself?', 'Can I update the site myself?', 'Yes. You can change text, prices, photos and blog posts yourself. We walk you through it and leave you a short guide.'],
    ['Do you handle the domain and hosting?', 'Do you handle the domain and hosting?', 'Yes. We set up your domain, hosting, business email and security certificate, and tell you the yearly running cost. You own every account.'],
    ['What happens after the site goes live?', 'What happens after launch?', 'You get 30 days of free fixes and small changes. Then you can manage it yourself or choose a monthly plan. No lock-in either way.'],
    ['What if I do not like the design?', "What if I don't like the design?", 'You see the design before anything is built, and we refine it until you approve it. Changes at the design stage are included.'],
    ['Will my site actually show up on Google?', 'Will my site show up on Google?', 'Every site we build is set up to be found: fast, with proper page titles, a sitemap and a Google Business Profile. Ranking for competitive searches takes ongoing SEO, which is one of our monthly plans.'],
]
for (const [was, q, a] of FAQ_ANSWERS) {
    const f = faqs.find((x) => x.question.trim() === was) || faqs.find((x) => x.question.trim() === q)
    if (!f) { console.log(`  (no question "${was}"; skipped)`); continue }
    if (f.question !== q || f.answer !== a) updateDoc('faqs', f, { question: q, answer: a }, `question "${was}": reworded`)
}
{
    const accra = faqs.find((x) => /outside Accra/i.test(x.question))
    if (accra) deleteDoc('faqs', accra, `question "${accra.question}": removed (no location on the site)`)
    const add = [
        [3, 'What results can I expect?', 'Every plan is built around one result, like more enquiries, faster replies or a higher Google ranking. We agree it before we start and report on it every month.'],
        [11, 'Can you handle a large project?', "Yes. Large websites, online shops, software and campaigns are planned in phases. Each phase has a fixed price, a timeline and your sign-off, and you follow progress, files and invoices in your client portal. We built Omek's online store and the system behind it, and QuadERP, store management software for retailers."],
    ]
    for (const [order, question, answer] of add) {
        if (!faqs.some((x) => x.question === question)) createDoc('faqs', { question, answer, order }, `question "${question}": added`)
    }
    // Renumber so the new results question sits third.
    const ORDER = ['How much will my project cost?', 'How long does it take?', 'What do you need from me to get started?', 'Can my customers pay on the site with Mobile Money?', 'Will I be able to update the site myself?', 'Do you handle the domain and hosting?', 'What happens after the site goes live?', 'What if I do not like the design?', 'Will my site actually show up on Google?']
    for (const c of changes.filter((x) => x.path.startsWith('/api/faqs/') && x.method === 'PATCH')) {
        const i = ORDER.indexOf(faqs.find((f) => c.path.endsWith(`/${f.id}`))?.question)
        if (i >= 0) c.body.order = i < 2 ? i + 1 : i + 2
    }
}

/* ----------------------------------------------------------------- about */

updateGlobal('about', {
    title: 'About Quadem Digital',
    headline: 'We help businesses win more customers online.',
    subheadline: 'Websites, WhatsApp assistants, AI video, search and ads, each built to bring in enquiries and sales, and measured every month.',
    bio: "Quadem Digital was started by Ernest Avorwlanu to give businesses digital work that earns its keep. We've built online stores, business software and websites, and every project runs the same way: a fixed price, clear stages and results you can see.",
    mission: 'Digital work that pays for itself: it should look good and bring results you can see in the numbers.',
    vision: 'Every business, big or small, able to compete on the quality of its marketing, not just its budget.',
    coreValues: overRows(globals.about.coreValues, [
        { title: 'Results first', description: 'We focus on the numbers that matter. Every design and campaign is built to bring in business.' },
        { title: 'Transparency', description: 'No hidden fees and no jargon. You see progress at every stage.' },
        { title: 'Quality', description: "We don't settle for good enough. The work holds a high bar, so your business stays ahead." },
    ], 'about values'),
    meta: { ...globals.about.meta, description: 'Quadem Digital builds websites, AI video, search and ads that bring businesses more enquiries and sales. How we work and what we value.' },
}, 'About: leads with what we do for clients; Ernest named once, as a fact')

updateGlobal('servicesPage', {
    subheading: 'Websites, AI video, search and ads that bring businesses more enquiries and sales.',
}, 'services page: subtitle led by the result')

/* --------------------------------------------------------------- contact */

updateGlobal('contactPage', {
    heroHeading: "Let's get you more customers",
    heroSubtitle: "Tell us what you want to achieve and we'll come back with a clear next step.",
    contactText: "Tell us about your business and what you want more of: enquiries, sales or visibility. We'll reply with a clear next step.",
    formSuccessMessage: "Thanks for getting in touch. We'll reply shortly.",
    submitButtonText: 'Send message',
    bookingHeading: 'Book a free call',
}, 'contact page: "we" wording, led by what the client wants more of')

/* ------------------------------------------------------------ web design */

{
    const g = globals.webDesignPage
    const plans = g.pricingSection.plans
    const plan = (name) => plans.find((x) => x.name === name) || fail(`web design tier ${name} missing (has release 1 run?)`)
    updateGlobal('webDesignPage', {
        hero: { ...g.hero, badge: 'Web design', headline: 'Websites that bring you customers', subtitle: 'We design and build fast, clear websites for businesses that want more enquiries and sales, from a single page to a full online shop.', primaryCtaText: 'Get a free quote', secondaryCtaText: 'See prices' },
        servicesSection: {
            ...g.servicesSection, heading: 'What we build', subtitle: 'Pick the website that fits where your business is now. Every one works on a phone, loads fast and is set up for Google.',
            services: overRows(g.servicesSection.services, [
                { title: 'Business websites', description: 'Up to 5 pages that explain what you do and make it easy to get in touch. You can update it yourself.' },
                { title: 'Online shops', description: 'Sell online with Mobile Money and card payments, stock tracking and order emails.' },
                { title: 'One-page websites', description: 'A single page for one job, like a launch, a campaign or one service.' },
                { title: 'Web apps and dashboards', description: "Custom tools that run your business, like the system behind Omek's online store." },
            ], 'web design services'),
        },
        showreel: { ...g.showreel, heading: "Websites we've built", subtitle: 'Recent websites, from first idea to launch.' },
        portfolioGallery: { ...g.portfolioGallery, heading: 'More of our work', subtitle: 'Recent websites and the results they were built for.' },
        processSection: {
            ...g.processSection, heading: 'How we build your website', subtitle: 'Four steps. You see the design before anything is built.',
            steps: overRows(g.processSection.steps, [
                { title: 'Plan (a few days)', description: "We agree what the site must do, who it's for and what goes on each page." },
                { title: 'Design (about a week)', description: 'You see how it looks on a phone and a computer, and we refine it until you approve.' },
                { title: 'Build (one to two weeks)', description: 'We build the site, connect your forms and payments, and set it up for Google.' },
                { title: 'Launch and support (30 days)', description: 'We test everything, put it live, show you how to update it, and fix anything for 30 days.' },
            ], 'web design steps'),
        },
        pricingSection: {
            ...g.pricingSection, heading: 'Website prices', subtitle: 'A fixed price in writing before we start.',
            note: 'Prices are starting points. The final price depends on the number of pages, payments and how much writing you need, and you get it in writing before any work starts.',
            plans: plans.map((x) => {
                if (x === plan('One-page website')) return { ...x, description: 'One page, built to do one job, like bringing in enquiries for a single service or a launch.', features: features('One custom-designed page, written to bring in enquiries', 'Works properly on a phone', 'Contact form set up and tested', 'Set up so Google can find it', 'Links to your social pages', 'About a week from start to live') }
                if (x === plan('Website, up to 5 pages')) return { ...x, description: 'A full business website you can update yourself.', features: features('Up to 5 custom-designed pages', 'Change your own text, prices and photos, without calling us', 'A blog you can post to', 'Set up for Google, with visitor tracking', 'Fast to load on any phone', 'About 3 weeks from start to live', '30 days of support after launch') }
                if (x === plan('Online shop')) return { ...x, description: 'A shop that takes orders and payments while you sleep.', features: features('As many products as you need', 'Mobile Money and card payments', 'Stock and order tracking', 'Customer accounts', 'Planned in phases, each with a fixed price', 'Ongoing care available') }
                return x
            }),
        },
        faqSection: {
            ...g.faqSection, heading: 'Common questions', subtitle: 'What people ask before starting a website with us.',
            faqs: [
                { question: 'How long does a website take?', answer: 'A one-page website takes about a week. A 5-page business website takes about 3 weeks. Online shops and web apps take 6 to 12 weeks, planned in phases. The biggest factor is how quickly we get your content and feedback.' },
                { question: 'What do you build on?', answer: 'Whatever suits the job. Business websites use modern, fast tools with a simple system to edit your content. Online shops can use Shopify or a custom build. You own every account.' },
                { question: 'Do I need to provide the words and photos?', answer: 'No. If you have them, we use them. If not, we write the words and prepare the images for an extra fee.' },
                { question: 'Will it work on phones?', answer: 'Yes. Every site is designed for phones first, then tablets and computers.' },
                { question: 'What happens after launch?', answer: 'You get 30 days of fixes and small changes. After that, you can update it yourself or choose a monthly plan for updates, backups and reporting.' },
                { question: 'Can you handle a large project?', answer: "Yes. Large websites, online shops and web apps are planned in phases. Each phase has a fixed price, a timeline and your sign-off, and you follow progress in your client portal. We built Omek's online store and the system that runs it." },
            ],
        },
        ctaSection: { ...g.ctaSection, heading: 'Ready for a website that brings in customers?', subtitle: 'Book a free call and tell us about your business. No commitment, just a clear plan and a price.', primaryButtonText: 'Book a free call', whatsappButtonText: 'Chat on WhatsApp' },
        meta: { ...g.meta, title: 'Web Design That Brings In Customers | Quadem Digital', description: 'Websites that bring in customers, from one page to full online shops, with fixed prices and 30 days of support.' },
    }, 'web design page: every section in plain language')
}

/* ------------------------------------------------------------------- SEO */

{
    const g = globals.seoPage
    const plans = g.pricingSection.plans
    const plan = (name) => plans.find((x) => x.name === name) || fail(`SEO tier ${name} missing (has release 1 run?)`)
    updateGlobal('seoPage', {
        hero: { ...g.hero, badge: 'SEO', headline: 'Get found when customers search', subtitle: 'We help your business show up on Google when people search for what you sell, in your area or across the country. That means more visitors who are ready to buy, without paying for every click.', primaryCtaText: 'Get a free website check-up', secondaryCtaText: 'See prices' },
        servicesSection: {
            ...g.servicesSection, heading: 'What we do', subtitle: 'Four kinds of work that help Google find you, trust you and send you customers.',
            services: overRows(g.servicesSection.services, [
                { title: 'Fixing the basics', description: 'We make sure Google can read your site and that it loads fast on phones.', features: features('Faster pages', 'Works well on phones', 'Broken pages fixed', 'Clear information for Google about your business') },
                { title: 'Your pages', description: 'We tune your words, page titles and links so they match what customers type into Google.', features: features('Research into what customers search', 'Better page titles and descriptions', 'Easier to read', 'Pages linked together sensibly') },
                { title: 'Local search', description: 'We get you into Google Maps and "near me" searches, and build trust from other websites.', features: features('Google Business Profile', 'Listings on local directories', 'Links from trusted websites', 'Mentions in the press') },
                { title: 'Helpful content', description: "We write articles that answer your customers' questions, so Google sends them to you.", features: features('Blog posts', 'Guides people can download', 'Landing page writing', 'Old content refreshed') },
            ], 'SEO services'),
        },
        portfolioGallery: { ...g.portfolioGallery, heading: 'Research and results', subtitle: 'Our study of 3,928 small business websites, and the search work behind our own site.' },
        processSection: {
            ...g.processSection, heading: 'How we get you found', subtitle: 'Four steps, with a report every month.',
            steps: overRows(g.processSection.steps, [
                { title: 'Check-up and plan (first two weeks)', description: "We look at where you rank, what competitors do better and what's broken, then agree a plan." },
                { title: 'Fix the basics (first month)', description: 'We repair broken pages, speed up the site and make it easy for Google to read.' },
                { title: 'Add and improve content (every month)', description: 'We improve your key pages and publish new articles.' },
                { title: 'Build trust and report (every month)', description: 'We earn links from other websites and send a monthly report on rankings and visitors.' },
            ], 'SEO steps'),
        },
        pricingSection: {
            ...g.pricingSection, heading: 'SEO prices', subtitle: "Monthly plans with no long contract. Cancel with 30 days' notice.",
            plans: plans.map((x) => {
                if (x === plan('Local SEO')) return { ...x, features: features('A full check of your website first', 'Your Google Business Profile set up and kept up to date', 'Your business listed on 15 local directories each month', 'Your 5 most important pages tuned for Google', 'A monthly report on where you rank') }
                if (x === plan('Full SEO')) return { ...x, features: features('Everything in Local SEO', 'Technical fixes that help Google read your site', '4 blog posts a month, written for you', 'Links to your site from other trusted websites', "What competitors rank for that you don't", 'A strategy call every three months') }
                if (x === plan('Custom SEO')) return { ...x, features: features('For large websites and online shops', 'Large sites made easy for Google to read', 'Pages for every product or location, made at scale', 'Coverage in respected publications', 'Shop categories organised for Google', 'Planned in phases, each with a fixed price') }
                return x
            }),
        },
        faqSection: {
            ...g.faqSection, heading: 'Common questions', subtitle: 'What people ask before starting SEO with us.',
            faqs: [
                { question: 'How long until I see results?', answer: "Usually 3 to 6 months for clear movement, depending on your competition and your site's history. Unlike ads, the results keep working after you stop paying for each click." },
                { question: 'Can you guarantee first place on Google?', answer: 'No one honest can, because Google changes how it ranks sites. We promise careful, approved methods and a clear monthly report on what moved.' },
                { question: 'Is writing included?', answer: 'On Full SEO, yes: four blog posts a month, written for you. On Local SEO we improve the words you already have.' },
                { question: "What's the difference between Local and Full SEO?", answer: 'Local SEO is for businesses serving one area, like a plumber serving one town, and focuses on Google Maps and local listings. Full SEO is for reaching customers across the country or abroad, with articles and links from other websites.' },
                { question: 'Can you handle a large website or online shop?', answer: 'Yes. Custom SEO is planned in phases, each with a fixed price and a report.' },
            ],
        },
        ctaSection: { ...g.ctaSection, heading: 'Stop losing customers to competitors on Google', subtitle: "Get a free check-up of your website and we'll show you what it takes to move up.", primaryButtonText: 'Get a free website check-up' },
        meta: { ...g.meta, title: 'SEO That Gets You Found | Quadem Digital', description: 'Show up on Google when customers search for what you sell. Local SEO, content and monthly reports.' },
    }, 'SEO page: every section in plain language, no jargon, no results claims we cannot show')
}

/* ----------------------------------------------------------------- video */

{
    const g = globals.videoProductionPage
    const plans = g.pricingSection.plans
    updateGlobal('videoProductionPage', {
        hero: { ...g.hero, badge: 'AI video and reels', headline: 'AI video and reels that keep you posting, with no shoot day', subtitle: 'We make reels, ads and product videos with AI, from your logo, your products and your offer. No camera, no crew, nothing to organise. You approve the script, and you can post the same week.', primaryCtaText: 'Get a free quote', secondaryCtaText: 'See prices' },
        servicesSection: {
            ...g.servicesSection, heading: 'What we make', subtitle: 'Short videos for the places your customers scroll.',
            services: overRows(g.servicesSection.services, [
                { title: 'Reels and TikToks', description: 'Vertical videos for Instagram, TikTok and YouTube Shorts, with captions and a strong first second.' },
                { title: 'Video ads', description: 'Short ads for Facebook, Instagram and TikTok, in three or four versions so you can see which brings sales for the least money.' },
                { title: 'Product videos', description: 'Send us photos of what you sell, and we turn them into video so your product moves on screen.' },
                { title: 'AI presenter videos', description: 'A face and voice on screen without anyone filming, using licensed AI presenters, or you with your written permission.' },
            ], 'video services'),
        },
        showreel: { ...g.showreel, heading: 'Recent videos', subtitle: "A few of the reels we've made recently." },
        portfolioGallery: { ...g.portfolioGallery, heading: 'Work gallery', subtitle: 'Frames from recent AI video work.' },
        processSection: {
            ...g.processSection, heading: 'How it works', subtitle: 'Four steps, no shoot day, and nothing goes out without your yes.',
            steps: overRows(g.processSection.steps, [
                { title: 'Your brand kit (once)', description: 'You send your logo, colours, product photos and the offer to push. We set it up once and reuse it every time.' },
                { title: 'Script and hooks (a day or two)', description: 'We write the script and two or three openings. You approve them before anything is made.' },
                { title: 'We make and edit (a few days)', description: 'AI creates the visuals and voice, then we edit by hand: pacing, captions, your logo and licensed music.' },
                { title: 'You approve and post', description: 'We fix anything you flag, then send files sized for every platform.' },
            ], 'video steps'),
        },
        pricingSection: {
            ...g.pricingSection, heading: 'AI video prices', subtitle: 'One pack to try it, or a monthly plan that keeps you posting. Card, bank transfer and mobile money accepted.',
            plans: plans.map((x) => x.name === '10 videos a month'
                ? { ...x, features: (x.features || []).map((f) => ({ ...f, feature: f.feature.replace('12 ad creatives + paid-ad creative', '12 ad designs a month').replace('Advanced analytics & reporting', 'Detailed monthly report') })) }
                : x),
        },
        faqSection: {
            ...g.faqSection, heading: 'Common questions', subtitle: 'What people ask before buying AI video.',
            faqs: [
                { question: 'Do you film anything?', answer: 'No. No shoot, camera, crew or location. Everything is made with AI and edited by hand, which is why it costs a fraction of a shoot and arrives in days.' },
                { question: 'Will it look fake?', answer: "Some AI video does. Ours doesn't go out until it looks right. We keep shots short, use your real product photos, and replace anything that looks odd. You see everything first." },
                { question: 'Do you use my real products and branding?', answer: 'Yes. Send your logo, colours and product photos once, and every video uses them.' },
                { question: 'Can you put me or my staff in the videos?', answer: 'Only with written permission, using a short consent form. Otherwise we use licensed AI presenters.' },
                { question: 'How many changes, and how fast?', answer: 'Two rounds of changes on every video. A 3-reel pack takes about five working days. Monthly plans follow a calendar you approve at the start of the month.' },
                { question: 'Who owns the videos? Can I run them as ads?', answer: 'You do, once the invoice is paid, including for ads. Music and presenters are licensed for business use.' },
                { question: 'Can you handle a large volume?', answer: 'Yes. Monthly plans go up to 10 videos and 30 posts a month, planned a month ahead. Bigger campaigns are quoted.' },
            ],
        },
        ctaSection: { ...g.ctaSection, heading: 'Ready to stop going quiet?', subtitle: "Book a free 15-minute call. We'll show you what your first three reels would look like before you pay anything.", primaryButtonText: 'Book a free call', whatsappButtonText: 'Chat on WhatsApp' },
        meta: { ...g.meta, title: 'AI Video and Reels | Quadem Digital', description: 'Reels, ads and product videos made with AI. No shoot day, no crew, your brand on screen every week.' },
    }, 'video page: every section in plain language')
}

/* ---------------------------------------------------------- service rows */

const svc = (slug) => services.find((s) => s.slug === slug) || fail(`no service ${slug}`)
const parsed = (v) => (typeof v === 'string' ? JSON.parse(v) : v)

/* The one-line result each service shows on the services page, the same line
   as its homepage card. */
const LINES = {
    'web-design-development': 'More enquiries and sales from the people who visit, from one page to a full online shop.',
    'video-production': 'Fresh videos and posts every week keep you in front of buyers, with no shoot day.',
    'seo-paid-ads': 'More visitors who are already searching for what you sell, without paying for every click.',
    fieldwork: 'A fresh list every month of businesses that fit your ideal customer, with checked contacts and a reason to call now.',
}
const FORMS = {
    'web-design-development': { heading: 'Tell us about your website', intro: "Three questions, then how to reach you. We'll come back with what it takes and what it costs." },
    'video-production': { heading: 'Tell us what you want to post', intro: 'No shoot day and no crew, so these answers are most of what we need to price it.' },
    'seo-paid-ads': { heading: 'Tell us about the website you want found', intro: 'We need the web address to look at anything useful, so that one is required.' },
    fieldwork: { heading: 'Tell us who you want to reach', intro: 'The clearer the description, the better the list.' },
    'ai-automation': { heading: 'Tell us where your enquiries arrive', intro: 'Three quick answers shape your assistant.' },
}
/* Example answers in the enquiry forms, without a location (19 October 2026). */
const PLACEHOLDERS = {
    'For example: dental clinics in Accra with fewer than ten staff and no working website.': 'For example: dental clinics with fewer than ten staff and no working website.',
    'For example: bridal shop in Accra': 'For example: a bridal shop',
}
const withPlaceholders = (form) => ({ ...form, questions: (form.questions || []).map((q) => (PLACEHOLDERS[q.placeholder] ? { ...q, placeholder: PLACEHOLDERS[q.placeholder] } : q)) })
for (const [slug, line] of Object.entries(LINES)) {
    const s = svc(slug)
    const form = withPlaceholders(parsed(s.enquiryForm) || {})
    updateDoc('services', s, { description: line, enquiryForm: { ...form, ...FORMS[slug] } }, `${s.title}: services page line and enquiry form in plain language`, ['slug'])
}

const AI_BODY = doc(
    h('What you get'),
    ul(
        'An assistant on your WhatsApp that replies the moment a message arrives',
        'The three questions you ask every customer, asked for you, then a handover to you',
        'Every enquiry saved in a list you can sort and filter, not buried in chats',
        'A record of how fast each enquiry was answered',
        'No monthly fee: you pay once for the build',
    ),
    p(b('Who it is for: '), "businesses that get more messages than they can answer quickly, and ask the same questions every time. It doesn't suit a business where every enquiry needs a real conversation from the first message. If that's you, we'll say so rather than build one."),
    h('How it works'),
    ol(
        [b('Free call (30 minutes). '), t('We look at where your enquiries arrive and what you ask every time.')],
        [b('Plan and price (a few days). '), t('We agree the questions, the replies and where the answers are saved. You get a fixed price.')],
        [b('Build and test (about two weeks). '), t('We set it up on your WhatsApp and test it with real messages before it goes live.')],
        [b('Go live. '), t('It starts answering, and you get your enquiry list and a short guide.')],
    ),
    h('What it will never do'),
    ul(
        [b('Guess. '), t("If a customer gives an answer it doesn't recognise, it saves exactly what they typed and flags it for you.")],
        [b('Talk over you. '), t('Once a person is needed, it stops replying for good.')],
        [b('Message people out of the blue. '), t('It only replies to customers who wrote first, so nobody gets spam.')],
    ),
    h('The result, measured'),
    p("It runs on our own enquiries. On its first live run, a new enquiry went from first message to fully answered in 64 seconds, with each reply sent two to three seconds after the customer's message."),
    h('Common questions'),
    h('What does it cost to run?', 'h3'),
    p("Close to nothing. Replies inside a conversation the customer started aren't charged by Meta, and nothing runs between enquiries."),
    h('Does it work on Instagram or Facebook?', 'h3'),
    p('The standard build is WhatsApp. Other channels are quoted as a bigger setup.'),
    h('Can it connect to the system we already use?', 'h3'),
    p('Yes, as a bigger setup, priced once we know what it has to connect to.'),
    h('What if a customer wants a person straight away?', 'h3'),
    p('It hands over and stops replying, so you take it from there.'),
)
{
    const s = svc('ai-automation')
    const ps = parsed(s.pricingSection) || {}
    const form = parsed(s.enquiryForm) || {}
    updateDoc('services', s, {
        description: 'We set up a WhatsApp assistant that answers every enquiry within a minute, day or night, asks the questions you always ask, and hands the customer to you with the details filled in.',
        body: AI_BODY,
        pricingSection: {
            ...ps,
            heading: 'What it costs',
            subtitle: "One build, no monthly fee. The assistant only replies inside conversations your customers start, so Meta doesn't charge for those messages.",
            note: "A starting point. The price depends on how many questions it asks and where the answers are saved. If an assistant is the wrong fit for your business, we'll tell you.",
            plans: (ps.plans || []).map((x) => x.name === 'WhatsApp assistant'
                ? { ...x, description: 'Every enquiry answered within a minute, then handed to you with the details filled in.', features: features('Replies the moment a message arrives, day or night', 'Asks three questions to find out what the customer needs, then hands over to you', 'Every enquiry saved in a list you can sort, not lost in a chat', 'Shows how fast each enquiry was answered', 'Nothing to pay between enquiries') }
                : x.name === 'Bigger setups'
                    ? { ...x, description: 'More than three questions, more than one channel, or connecting to a system you already use. Priced once we know what it has to connect to.' }
                    : x),
        },
        enquiryForm: { ...form, ...FORMS['ai-automation'] },
    }, 'AI automation: page text, prices wording and enquiry form in plain language', ['slug'])
}

/* ------------------------------------------------------------------ report */

if (PLAN_OUT) {
    writeFileSync(PLAN_OUT, JSON.stringify(changes, null, 2))
    console.log(`Planned changes written to ${PLAN_OUT}`)
}

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
