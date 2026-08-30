#!/usr/bin/env node
/*
  Writes the missing body copy for the two services that had none.

  Why
  ---
  Seven services exist. Five have hand-built pages under src/pages/services/.
  Two fall through to the CMS template at src/pages/services/[slug].astro, and
  that template prints "Detailed service content coming soon" when the body is
  empty. Both were live saying exactly that:

    /services/ai-automation/                   688 words, one heading
    /services/digital-marketing-social-media/  688 words, one heading

  Neither is an obscure corner. The services grid links both, the homepage and
  the contact form link Digital Marketing, and AI Automation was added to the
  CMS on 29 August 2026 and is now offered on the contact form and on /global.
  So both were being sold, and both told the buyer to come back later.

  Where the copy comes from
  -------------------------
  Nothing here is invented, and no result is claimed that was not recorded.

    ai-automation   The quadem-whatsapp-intake repo on this drive: its README
                    and its own portfolio_case_study.md. The three-question
                    flow, the 64 second first live run, the 2 to 3 second reply
                    times, the refusal to guess a city, the permanent stop once
                    a human is involved, and the 24 hour service window that
                    means Meta charges nothing for the replies. This system runs
                    on Quadem's own enquiries, which the copy says plainly
                    rather than implying a roster of deployments.

    digital-marketing-social-media
                    Meta Campaigns/Omek_Gigs_Meta_Ads_Campaign.md on this
                    drive: a real campaign strategy for a real client, with six
                    buyer profiles mapped to product categories, branch cities,
                    Meta targeting and creative direction. The page describes
                    that work and explicitly does NOT claim a spend, a return or
                    a reach figure, because none was recorded. Saying so is the
                    honest version and it matches how the Omek case study ends.

  The tags already on each document (Strategy, Content Calendar, Page
  Management) are what the second page is organised around, so the page and the
  card a visitor clicked agree with each other.

  Run:
    node cms/scripts/write-service-bodies.mjs --dry-run
    node cms/scripts/write-service-bodies.mjs
*/

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const DRY = process.argv.includes('--dry-run')

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

/* ------------------------------------------------------------------ lexical */

const t = (text) => ({ type: 'text', version: 1, format: 0, detail: 0, mode: 'normal', style: '', text })
const p = (text) => ({ type: 'paragraph', version: 1, children: [t(text)] })
const h = (text, tag = 'h2') => ({ type: 'heading', tag, version: 1, children: [t(text)] })
const li = (text) => ({ type: 'listitem', version: 1, value: 1, children: [t(text)] })
const ul = (...items) => ({
    type: 'list',
    listType: 'bullet',
    tag: 'ul',
    start: 1,
    version: 1,
    children: items.map((text, i) => ({ ...li(text), value: i + 1 })),
})
const doc = (...children) => ({
    root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children },
})

/* -------------------------------------------------------------------- copy */

const BODIES = {
    'ai-automation': doc(
        h('The problem is the gap, not the answer'),
        p(
            'Someone messages your business at nine in the evening asking whether you have a thing in stock and what it costs. You see it at eight the next morning. By then they have asked two other people the same question, and one of them replied.'
        ),
        p(
            'Almost nobody measures that gap, which is why almost nobody fixes it. It is not in a report anywhere. It just quietly decides which enquiries turn into work.'
        ),

        h('What the assistant actually does'),
        p(
            'It answers on WhatsApp the moment a message arrives, asks three questions, and then stops.'
        ),
        ul(
            'What do you need?',
            'Which city are you in?',
            'Do you already have a website, and what is the address?'
        ),
        p(
            'Three, because three is enough to know whether this is worth a call, and because a bot that asks a fourth question starts to feel like a form. The answers are written into a proper database as a row you can sort and filter, rather than left buried in a chat thread nobody scrolls back through.'
        ),
        p(
            'Then a person takes over. That is the point of it. It is not there to close anybody.'
        ),

        h('It is measured, and the number is on record'),
        p(
            'The system stamps the moment a message first arrives and the moment the lead is qualified, and stores the difference. On the first live run that difference was 64 seconds, with each individual reply going out two to three seconds after the message that triggered it.'
        ),
        p(
            'This runs on my own enquiries. I am not describing a product I have installed for a dozen businesses, I am describing the thing that answers my WhatsApp, which is why I can tell you what it measures rather than what it promises.'
        ),

        h('What it deliberately will not do'),
        p(
            'These are the three decisions that separate an assistant from the chatbots everyone has learned to hate, and all three are refusals.'
        ),
        ul(
            'It does not guess. If someone names a city it does not recognise, it stores exactly what they typed and flags it for a human. It never quietly maps an unfamiliar answer onto a familiar one, because a wrong guess buried in a database is worse than a blank.',
            'It does not interrupt. Once a lead is qualified, or once it has decided a person is needed, it stops sending automatic replies. Permanently. A bot talking over a real conversation is worse than silence, and this is the branch most automations get wrong.',
            'It does not start conversations. Every message it sends is a reply inside the window a customer opened themselves, so nothing needs pre-approval as a marketing template and nobody gets messaged out of the blue.'
        ),

        h('What it costs to run'),
        p(
            'Because every message is a reply inside the window the customer opened, Meta does not charge for that traffic. The logic runs without a server sitting idle waiting for messages, so there is nothing to pay for between enquiries.'
        ),
        p(
            'The build is the cost. Running it is close to nothing, and I would rather say that plainly than sell you a monthly fee for something that mostly sits still.'
        ),

        h('Whether this suits you'),
        p(
            'It suits a business where enquiries arrive faster than someone can pick up a phone, where the same three questions get asked every time, and where the answers currently live in a chat history rather than anywhere you can count them.'
        ),
        p(
            'It does not suit a business whose enquiries all need a real conversation from the first message. If that is you, an assistant in front of it will annoy people, and I will tell you so rather than build it.'
        )
    ),

    'digital-marketing-social-media': doc(
        h('Strategy first, because posting is the easy part'),
        p(
            'Most social media work starts with a calendar and works backwards to an audience. It produces posts that are pleasant and sell nothing, because nobody ever wrote down who they were for.'
        ),
        p(
            'I start at the other end: who actually buys this, what makes them buy it today rather than next month, and what they need to see before they trust the price. The calendar is the output of that, not the input.'
        ),

        h('What that looks like in practice'),
        p(
            'For Omek Gigs Appliances, a home appliance retailer with branches across Ghana, the work started as six written buyer profiles before a single post was drafted.'
        ),
        p(
            'Not personas in the vague sense. Each one names the income band, the cities, what triggers the purchase, what they are afraid of, which products they actually buy, and roughly what they spend. The new homeowner furnishing an empty house buys three to five items at once and is frightened of buying a refurbished unit sold as new. The family whose fridge died yesterday buys one thing, urgently, and cares more about the electricity bill than the brand.'
        ),
        p(
            'Those are different adverts, different pictures, different opening lines and different places to run them, and you only know that because you wrote the profiles down first. That document then drives the targeting, the creative and the offers, so every post can be traced back to a person it was written for.'
        ),

        h('The calendar and the page'),
        p(
            'Once the profiles exist, the rest is routine, and routine is the point. A content calendar so the page does not go quiet for three weeks and then post five times in a day. Page management so comments and messages get answered rather than accumulating under a post from last month.'
        ),
        p(
            'Enquiries that come in through those messages are worth catching properly, which is what the AI automation service is for. The two work well together and neither requires the other.'
        ),

        h('What you will not find on this page'),
        p(
            'No reach figures, no engagement percentages and no return on ad spend. Not because the work did not happen, but because I do not have numbers from it that I could stand behind, and a marketing page is the last place a made-up figure should appear.'
        ),
        p(
            'When there is a campaign with recorded before-and-after numbers, it will appear in the work section with the method next to it, the same way the performance figures on this site already do. Until then this page tells you how the work is done and lets you judge that.'
        )
    ),
}

/* --------------------------------------------------------------------- run */

const res = await fetch(`${BASE}/api/services?depth=0&limit=50`, { headers })
if (!res.ok) {
    console.error(`Could not read services: HTTP ${res.status}`)
    process.exit(1)
}
const docs = (await res.json()).docs || []
const bySlug = new Map(docs.map((d) => [d.slug, d]))

const missing = Object.keys(BODIES).filter((s) => !bySlug.has(s))
if (missing.length) {
    console.error(`No service with slug: ${missing.join(', ')}`)
    process.exit(1)
}

// Never overwrite copy somebody wrote in the admin without saying so first.
const backupPath = join(HERE, 'service-bodies-backup.json')
if (!DRY) {
    writeFileSync(
        backupPath,
        JSON.stringify(
            Object.keys(BODIES).map((slug) => ({ slug, body: bySlug.get(slug).body })),
            null,
            2
        )
    )
    console.log(`Previous bodies saved to ${backupPath}\n`)
}

let failed = 0

for (const [slug, body] of Object.entries(BODIES)) {
    const current = bySlug.get(slug)
    const existing = JSON.stringify(current.body || '').length
    const heads = body.root.children.filter((n) => n.type === 'heading').length
    const words = body.root.children
        .flatMap((n) => (n.type === 'list' ? n.children.flatMap((c) => c.children || []) : n.children || []))
        .map((c) => c.text || '')
        .join(' ')
        .split(/\s+/)
        .filter(Boolean).length

    console.log(slug)
    console.log(`  existing body   ${existing} chars${existing <= 2 ? '  (empty: the page says "coming soon")' : ''}`)
    console.log(`  new body        ${heads} sections, ${words} words`)
    console.log('  untouched       title, description, tags, images, order, meta')

    if (existing > 2) {
        console.log('  SKIPPED: this document already has a body. Not overwriting it.')
        continue
    }
    if (DRY) continue

    const r = await fetch(`${BASE}/api/services/${current.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ body }),
    })
    const out = await r.json()
    if (!r.ok) {
        console.error(`  FAILED HTTP ${r.status}`)
        console.error(JSON.stringify(out, null, 2).slice(0, 700))
        failed += 1
        continue
    }
    // Payload drops fields the deployed app does not declare, so a 200 is not
    // proof. Read the heading count back.
    const savedHeads = (out.doc?.body?.root?.children || []).filter((n) => n.type === 'heading').length
    if (savedHeads !== heads) {
        console.error(`  FAILED silently: ${savedHeads} heading(s) came back, expected ${heads}.`)
        failed += 1
        continue
    }
    console.log('  written')
}

if (DRY) {
    console.log('\nDry run. Nothing was written.')
    process.exit(0)
}
if (failed) {
    console.error(`\n${failed} service(s) did not save.`)
    process.exit(1)
}
console.log('\nBoth pages have real copy now. The edge cache holds public pages for 60 seconds.')
