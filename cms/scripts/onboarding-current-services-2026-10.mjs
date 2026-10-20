#!/usr/bin/env node
/*
  Client onboarding in step with the services restructure (Ernest, 20 October
  2026: "go", with "we" for the voice).

  The client service list predates the restructure. Its closest values are
  kept and the words around them change:
    digital-marketing  is Growth & Performance Marketing (ads on Facebook,
                       Instagram and Google, judged on enquiries and sales)
    seo-paid-ads       is SEO & Content Marketing (the ads moved to growth
                       marketing on 19 October)
    social-media       stays: posting and replies are part of the monthly plans
    branding           stays as it is, for past clients only; nothing new is
                       sold under it, so its journey and guide are left alone

  WHAT IT CHANGES
  1. Journey templates: "Digital marketing" becomes "Growth & Performance
     Marketing" with a growth plan, tracking, Google as well as Meta, weekly
     checks and a cost-per-enquiry report; "SEO and paid ads" becomes "SEO and
     content" without the Google Ads step; every "I" says "we".
  2. Onboarding guides: the same two, retitled and rewritten; every guide's
     "I am your one point of contact" becomes "Ernest is your main contact"
     (true, and no invented team), and every "I" says "we".
  3. The growth service's "Buyer Profiles" tag becomes "Growth Plan &
     Tracking", the plan's name since 19 October.

  Journeys are copied onto a client when their onboarding starts, so this
  changes what new clients see, never a journey already under way.

  Dry run by default. --live writes. Every replacement must find its text, or
  the run stops before writing anything. Whole documents are written with the
  changes laid over them (cms/CLAUDE.md), never a service's slug, after a
  backup to onboarding-current-services-2026-10-backup.json (gitignored).

  Run:
    node cms/scripts/onboarding-current-services-2026-10.mjs
    node cms/scripts/onboarding-current-services-2026-10.mjs --live
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
    if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${json?.errors?.map((e) => e.message).join('; ') || text.slice(0, 300)}`)
    return json
}

/* Whole strings, anywhere in a journey or a guide. Each must be found. */
const TEXT = new Map([
    // Every guide.
    ['I am your one point of contact from start to finish. Message me on WhatsApp, or email ernest@quademdigital.com.', 'Ernest is your main contact from start to finish. Message us on WhatsApp, or email ernest@quademdigital.com.'],
    ['What I need from you', 'What we need from you'],
    // Website.
    ['How your website gets made, what I need from you, and what happens after launch.', 'How your website gets made, what we need from you, and what happens after launch.'],
    ['The words for each page, or ask me to write them.', 'The words for each page, or ask us to write them.'],
    ['Access to your domain, or tell me if you need a new one.', 'Access to your domain, or tell us if you need a new one.'],
    ['We talk through your business, your customers and what the site has to do. I confirm the pages and the dates.', 'We talk through your business, your customers and what the site has to do. We confirm the pages and the dates.'],
    ['Everything on your setup checklist: your logo, the photos you want used, the words for each page (or ask me to write them) and links to two or three sites you like.', 'Everything on your setup checklist: your logo, the photos you want used, the words for each page (or ask us to write them) and links to two or three sites you like.'],
    ['An invitation to your domain account, or tell me if you need a new domain. Please never email a password.', 'An invitation to your domain account, or tell us if you need a new domain. Please never email a password.'],
    ['I make your changes, connect your domain and put the site live.', 'We make your changes, connect your domain and put the site live.'],
    // Brand identity (past clients).
    ['I start with logo concepts, each shown on real things like a sign or a phone screen. You choose one, we refine it together, and then I prepare your files. Your agreement says how many concepts and rounds of changes are included.', 'We start with logo concepts, each shown on real things like a sign or a phone screen. You choose one, we refine it together, and then we prepare your files. Your agreement says how many concepts and rounds of changes are included.'],
    ['Pick the concept you want to take forward and tell me what to change.', 'Pick the concept you want to take forward and tell us what to change.'],
    // Social media.
    ["I send the month's posts, each with its date, caption and design.", "We send the month's posts, each with its date, caption and design."],
    ['Posts go out on schedule, and I keep an eye on comments and messages.', 'Posts go out on schedule, and we keep an eye on comments and messages.'],
    // Video.
    ['Videos can use an AI presenter, a voiceover only, or captions only. If you want your own face or voice used, I send you a consent form first. Nothing of yours is used without it.', 'Videos can use an AI presenter, a voiceover only, or captions only. If you want your own face or voice used, we send you a consent form first. Nothing of yours is used without it.'],
    ['I write a short script for each video for you to approve.', 'We write a short script for each video for you to approve.'],
    ['I make the videos with captions, music and your logo.', 'We make the videos with captions, music and your logo.'],
    ['Tell me what to change before production starts.', 'Tell us what to change before production starts.'],
    // SEO and content (was SEO and paid ads).
    ['Access to your website, Google Search Console and Google Analytics. If you do not have them, I set them up.', 'Access to your website, Google Search Console and Google Analytics. If you do not have them, we set them up.'],
    ['I start with an audit of your site and the searches worth winning, then send you the plan and your first ads for approval. After that the work runs every month.', 'We start with an audit of your site and the searches worth winning, then send you the plan for approval. After that the work runs every month.'],
    ["Each month you get a short report: where you rank, how many people visited, the enquiries that came in and what the ads spent. It ends with next month's plan.", "Each month you get a short report: where you rank, how many people visited and the enquiries that came in. It ends with next month's plan."],
    ['Ads can bring visits from the first week. Search rankings usually take a few months to build, and then keep working without paying for each click.', 'Search rankings usually take a few months to build, and then keep working without paying for each click.'],
    ['Invitations, not passwords. If you do not have Search Console or Analytics, I set them up.', 'Invitations, not passwords. If you do not have Search Console or Analytics, we set them up.'],
    ['The fixes I will make and the ads I will run, for your yes.', 'The fixes we will make and the pages we will improve or write, for your yes.'],
    ['Site fixes done and your first campaigns running.', 'Site fixes done and your Google Business Profile up to date.'],
    ["Rankings, visits, enquiries and ad spend, with next month’s plan.", "Rankings, visits and enquiries, with next month’s plan."],
    // Growth & Performance Marketing (was Digital marketing).
    ['Admin access to your Facebook Business Manager, Page and ad account.', 'Admin access to your Facebook Business Manager, Page and ad account, and to Google Ads if we are using it.'],
    ['Your monthly ad budget and a card added to your ad account. The budget is paid to Meta directly, separate from my fee.', 'Your monthly ad budget and a card added to your ad account. The budget is paid to Meta or Google directly, separate from our fee.'],
    ['I plan who to reach and what to say, then send you the first ads to approve. Once they run, I check the results after the first week and keep improving them.', 'We set up tracking so every enquiry and sale from an ad is counted, plan who to reach and what to say, then send you the first ads to approve. Once they run, we check them every week and keep improving them.'],
    ["Each month you get a short report: what was spent, what it brought in, and next month's plan.", "Each month you get a short report: what was spent, what each enquiry cost, what worked, and next month's plan."],
    ['Admin access to your Business Manager, Page and ad account, or tell me if we are creating one.', 'Admin access to your Facebook Business Manager, Page and ad account, and to Google Ads if we are using it, or tell us if we are creating them.'],
    ['Your ad budget is paid to Meta directly, separate from my fee.', 'Your ad budget is paid to Meta or Google directly, separate from our fee.'],
    ['What you want more of (enquiries, visits, sales), who your best customers are and what to promote first.', 'What you want more of (enquiries, visits, sales), who your best customers are, what to promote first and your monthly ad budget.'],
    ['Who we will reach and what we will say to them.', 'Who buys from you and why, who we will reach and what we will say, and tracking so every enquiry and sale from an ad is counted.'],
    ['Early numbers: what to keep and what to change.', 'Early numbers: what to keep and what to change. From here we check the ads every week.'],
    ["Spend, results and next month’s plan.", "What was spent, what each enquiry cost, what worked, and next month’s plan."],
    // The custom project and the default guide.
    ['How your project runs, what I need from you, and how to reach me.', 'How your project runs, what we need from you, and how to reach us.'],
    ['How your project runs, what I need from you, and how changes are handled.', 'How your project runs, what we need from you, and how changes are handled.'],
    ['On our kick-off call we agree exactly what I will make, and the dates.', 'On our kick-off call we agree exactly what we will make, and the dates.'],
    ['I finish the work, you check it, and I hand everything over.', 'We finish the work, you check it, and we hand everything over.'],
    ['Your agreement lists the work it covers. Anything not on that list is outside it, and I will quote for it separately if you would like it.', 'Your agreement lists the work it covers. Anything not on that list is outside it, and we will quote for it separately if you would like it.'],
])

/* Guide list items that go entirely (the SEO guide's Google Ads lines). */
const DROP = new Set([
    'Access to Google Ads, or tell me if we are creating an account.',
    'Your monthly ad budget. It is paid to Google directly, separate from my fee.',
])

/* Field-level changes by record. */
const JOURNEY_FIELDS = {
    'digital-marketing': {
        name: ['Digital marketing', 'Growth & Performance Marketing'],
        summary: ['Meta ads: set-up and first campaigns in about ten days, then monthly management and reports.', 'Ads on Facebook, Instagram and Google: growth plan, tracking and first campaigns in about ten days, then weekly checks and a monthly report on what each enquiry cost.'],
        stepTitles: [['Access to your Facebook Business Manager', 'Access to your ad accounts'], ['Audience and offer plan', 'Growth plan and tracking']],
    },
    'seo-paid-ads': {
        name: ['SEO and paid ads', 'SEO and content'],
        dropSteps: ['Google Ads access and budget'],
        stepTitles: [['Approve the plan and first ads', 'Approve the plan'], ['Fixes made and ads live', 'Fixes made']],
    },
}
const GUIDE_FIELDS = {
    'seo-paid-ads': { title: ['Your SEO and ads', 'Your SEO'], description: ['How your search and Google Ads work is set up and reported.', 'How your search work is set up, done and reported each month.'] },
    'digital-marketing': { title: ['Your digital marketing', 'Your growth and ads'], description: ['How your Facebook and Instagram ads are planned, run and reported.', 'How your ads on Facebook, Instagram and Google are planned, tracked, run and reported.'] },
}

const used = new Map([...TEXT.keys()].map((k) => [k, 0]))
const dropped = new Map([...DROP].map((k) => [k, 0]))
const textOf = (n) => (n?.type === 'text' ? n.text || '' : (n?.children || []).map(textOf).join(''))

/* Replace whole strings anywhere; remove list items listed in DROP. */
function rewrite(value) {
    if (typeof value === 'string') {
        if (TEXT.has(value)) { used.set(value, used.get(value) + 1); return TEXT.get(value) }
        return value
    }
    if (Array.isArray(value)) {
        return value
            .filter((item) => {
                if (item && item.type === 'listitem' && DROP.has(textOf(item))) { dropped.set(textOf(item), dropped.get(textOf(item)) + 1); return false }
                return true
            })
            .map(rewrite)
    }
    if (value && typeof value === 'object') {
        const out = {}
        for (const [k, v] of Object.entries(value)) out[k] = k === 'id' ? v : rewrite(v)
        return out
    }
    return value
}

console.log(LIVE ? 'LIVE RUN: changes will be written.\n' : 'DRY RUN: nothing will be written. Add --live to write.\n')

const journeys = (await api('GET', '/api/journey-templates?limit=100&depth=0')).docs
const guides = (await api('GET', '/api/onboarding-guides?limit=100&depth=0')).docs
const growth = await api('GET', '/api/services?where[slug][equals]=digital-marketing-social-media&depth=0&limit=1').then((r) => r.docs[0])
const backupFile = join(HERE, 'onboarding-current-services-2026-10-backup.json')
if (LIVE || !existsSync(backupFile)) writeFileSync(backupFile, JSON.stringify({ takenAt: new Date().toISOString(), journeys, guides, growth }, null, 2))

const problems = []
const changes = []
const strip = (doc) => { const d = { ...doc }; for (const k of ['id', 'createdAt', 'updatedAt']) delete d[k]; return d }

for (const j of journeys) {
    let doc = rewrite(strip(j))
    const f = JOURNEY_FIELDS[j.service]
    if (f) {
        if (doc.name !== f.name[0]) problems.push(`journey ${j.id}: name is "${doc.name}", expected "${f.name[0]}"`); else doc.name = f.name[1]
        if (f.summary) { if (doc.summary !== f.summary[0]) problems.push(`journey ${j.id}: summary changed since`); else doc.summary = f.summary[1] }
        for (const t of f.dropSteps || []) {
            const before = doc.steps.length
            doc.steps = doc.steps.filter((s) => s.title !== t)
            if (doc.steps.length !== before - 1) problems.push(`journey ${j.id}: step "${t}" not found once`)
        }
        for (const [from, to] of f.stepTitles || []) {
            const s = doc.steps.filter((x) => x.title === from)
            if (s.length !== 1) problems.push(`journey ${j.id}: step "${from}" not found once`); else s[0].title = to
        }
    }
    if (JSON.stringify(doc) !== JSON.stringify(strip(j))) changes.push({ what: `journey "${j.name}"${f ? ` -> "${doc.name}"` : ''}`, path: `/api/journey-templates/${j.id}`, body: doc })
}
for (const g of guides) {
    let doc = rewrite(strip(g))
    const f = GUIDE_FIELDS[g.service]
    if (f) {
        if (doc.title !== f.title[0]) problems.push(`guide ${g.id}: title is "${doc.title}"`); else doc.title = f.title[1]
        if (doc.description !== f.description[0]) problems.push(`guide ${g.id}: description changed since`); else doc.description = f.description[1]
    }
    if (JSON.stringify(doc) !== JSON.stringify(strip(g))) changes.push({ what: `guide "${g.title}"${f ? ` -> "${doc.title}"` : ''}`, path: `/api/onboarding-guides/${g.id}`, body: doc })
}
if (!growth) problems.push('the growth service (digital-marketing-social-media) was not found')
else {
    const tags = growth.tags || []
    const i = tags.findIndex((t) => t.tag === 'Buyer Profiles')
    if (i === -1) console.log('  (the growth service has no "Buyer Profiles" tag; left alone)')
    else {
        const doc = strip(growth)
        delete doc.slug // never send a service's slug (cms/CLAUDE.md)
        doc.tags = tags.map((t, n) => (n === i ? { ...t, tag: 'Growth Plan & Tracking' } : t))
        changes.push({ what: 'growth service: tag "Buyer Profiles" -> "Growth Plan & Tracking"', path: `/api/services/${growth.id}`, body: doc })
    }
}

for (const [k, n] of used) if (n === 0) problems.push(`text not found: "${k.slice(0, 80)}"`)
for (const [k, n] of dropped) if (n === 0) problems.push(`list item not found: "${k.slice(0, 80)}"`)
const leftovers = JSON.stringify(changes.map((c) => c.body)).match(/[^.>"]{0,40}\b(I|me|my)\b[^.<"]{0,30}/g) || []
if (leftovers.length) console.log(`  first person left after the changes (check these are a client's own words):\n    ${leftovers.slice(0, 10).join('\n    ')}`)
if (/\u2014|\u2013/.test(JSON.stringify(changes.map((c) => c.body)).replace(/\\u2014|\\u2013/g, ''))) problems.push('an em or en dash would be written')

console.log(`${changes.length} changes:\n`)
for (const [i, c] of changes.entries()) console.log(`${String(i + 1).padStart(2)}. ${c.what}`)
if (problems.length) { console.error(`\nSTOPPED, nothing written:\n  ${problems.join('\n  ')}`); process.exit(1) }
console.log('')
if (!LIVE) { console.log('Dry run. Nothing written. Run with --live to write these.'); process.exit(0) }
for (const [i, c] of changes.entries()) {
    try {
        await api('PATCH', c.path, c.body)
        console.log(`  done ${i + 1}/${changes.length}  ${c.what}`)
    } catch (err) {
        console.error(`\nFAILED at ${i + 1}/${changes.length}: ${c.what}\n  ${err.message}\nThe backup is ${backupFile}.`)
        process.exit(1)
    }
}
console.log(`\nAll ${changes.length} changes written.`)
