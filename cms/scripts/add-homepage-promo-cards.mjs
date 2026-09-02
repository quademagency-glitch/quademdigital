#!/usr/bin/env node
/*
  Adds the three missing service cards to the homepage.

  The homepage draws its promo cards from `homepage.promoSections`. It held
  four: AI Video, Web Design, Brand Identity, SEO. Three live services had no
  card at all, so the only route to them from the front page was the Services
  list in the footer:

    AI Automation
    Fieldwork
    Digital Marketing & Social Media

  The words here are the same defaults the three Astro components carry, so
  what the CMS says and what the page shows without a CMS agree. Change them
  freely in the admin afterwards, that is the point of the field.

  Order: appended, so nothing that was already on the page moves. Drag them in
  the admin if you want a different running order.

  TWO THINGS THAT WILL BITE IF THIS FAILS
  ---------------------------------------
  1. `visual` is a Payload select, which in Postgres is an enum. A value the
     type does not carry is rejected. Migrations 20260901_094500 and
     20260901_101500 add the three. Run `pnpm migrate` in cms/ if this errors
     on the value.

  2. A migration is half the job. Until the CMS on Railway is redeployed with
     the updated Homepage.ts, Payload does not know the three new options and
     drops them from the write WITHOUT erroring. That is why this reads every
     card back and compares the visual it asked for against the visual it got,
     rather than trusting a 200.

  Run:
    node cms/scripts/add-homepage-promo-cards.mjs --dry-run
    node cms/scripts/add-homepage-promo-cards.mjs
*/

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
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

const NEW_CARDS = [
    {
        visual: 'aiAutomation',
        badge: 'Automation',
        heading: 'Never miss an enquiry with',
        headingAccent: 'AI Automation',
        body: 'Your enquiries answered in sixty seconds, day or night. Quotes, bookings and follow-ups handled without anyone typing.',
        ctaLabel: 'See AI Automation',
        ctaUrl: '/services/ai-automation/',
    },
    {
        visual: 'fieldwork',
        badge: 'Lead Research',
        heading: 'Know exactly who to call with',
        headingAccent: 'Fieldwork',
        body: 'Every month, a list of businesses that match your exact description, each with a checked email address, a phone number, and one line explaining why they need calling now.',
        ctaLabel: 'See Fieldwork',
        ctaUrl: '/services/fieldwork/',
    },
    {
        visual: 'digitalMarketing',
        badge: 'Social Media',
        heading: 'Strategy first with',
        headingAccent: 'Digital Marketing',
        body: 'Most social media work starts with a calendar and works backwards to an audience. I start with who actually buys, and what makes them buy today rather than next month. The calendar comes out of that.',
        ctaLabel: 'See Digital Marketing',
        ctaUrl: '/services/digital-marketing-social-media/',
    },
]

const read = await fetch(`${BASE}/api/globals/homepage?depth=0`, { headers })
if (!read.ok) {
    console.error(`Could not read the homepage global: HTTP ${read.status}`)
    process.exit(1)
}
const homepage = await read.json()
const existing = Array.isArray(homepage.promoSections) ? homepage.promoSections : []

const already = new Set(existing.map((p) => p.visual))
const toAdd = NEW_CARDS.filter((c) => !already.has(c.visual))

console.log(`Cards on the homepage now: ${existing.length}`)
existing.forEach((p) => console.log(`   ${p.visual}`))
console.log('')

if (toAdd.length === 0) {
    console.log('All three are already there. Nothing to do.')
    process.exit(0)
}

console.log(`Adding ${toAdd.length}:`)
toAdd.forEach((c) => console.log(`   ${c.visual.padEnd(17)} ${c.heading} ${c.headingAccent}`))
console.log('')
console.log(`After this: ${existing.length + toAdd.length} cards. Nothing already there moves.`)

if (DRY) {
    console.log('\nDry run. Nothing was written.')
    process.exit(0)
}

// Strip Payload's row ids off the existing rows so it does not try to reuse
// them, and send the whole array: this field is replaced, not appended to.
const promoSections = [
    ...existing.map(({ id, ...row }) => row),
    ...toAdd,
]

const res = await fetch(`${BASE}/api/globals/homepage`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ promoSections }),
})
const out = await res.json()
if (!res.ok) {
    console.error(`\nHTTP ${res.status}`)
    console.error(JSON.stringify(out, null, 2).slice(0, 1200))
    process.exit(1)
}

const got = (out.result || out.doc || out).promoSections || []
const gotVisuals = got.map((p) => p.visual)
console.log(`\nWrote ${got.length} card(s): ${gotVisuals.join(', ')}`)

const missing = NEW_CARDS.filter((c) => !gotVisuals.includes(c.visual)).map((c) => c.visual)
if (missing.length) {
    console.error('')
    console.error(`These did not come back: ${missing.join(', ')}`)
    console.error('Payload drops values its running config does not declare, without erroring.')
    console.error('The CMS on Railway needs redeploying with the updated Homepage.ts.')
    process.exit(1)
}
console.log('All three landed. The edge cache holds public pages for 60 seconds.')
