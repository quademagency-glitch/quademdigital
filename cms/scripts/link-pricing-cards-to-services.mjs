#!/usr/bin/env node
/*
  Points the homepage price cards at the pages that explain them, and makes the
  three buttons in a row say the same thing.

  Dry run by default.

  THE HOMEPAGE PRICING WAS A CLOSED LOOP

  src/components/home/PricingSection.astro has read `plan.pageUrl` since it was
  written, for the card's button and for a "View Details" link under it. The
  field did not exist on the collection, so the expression was always undefined:
  every one of the six cards fell back to /contact/, and the View Details link
  has never rendered. Verified on the live page, which carried zero of them.

  So the one section on the homepage that quotes prices could not reach any of
  the seven pages that say what the prices buy. Somebody who wanted to know what
  "Website build" covers got a contact form.

  WHERE EACH CARD NOW GOES

  The three international cards are single service lines and go to that
  service's own page. The three Ghana cards are bundles that cut across several
  services, so they go to /services/, which lists all of them, rather than
  pretending to be one.

  THE BUTTONS

  The Ghana row read "Get  Started" (with a double space, straight from the CMS),
  "Book a Call" and "Get Started", three labels across three cards sitting side
  by side. The international row already says "Book a call" on all three, which
  is also what the header button and the Fieldwork page say, so that is the
  wording the whole row takes.

  Booking is also the honest verb here. None of these buttons starts anything:
  every one leads to a page or a form, and "Get Started" promises a checkout
  that does not exist.

  WHAT THIS DELIBERATELY DOES NOT CHANGE

  Not one price. The Ghana bundles are priced well below what their own feature
  lists cost as separate services on the service pages, and that is a decision
  for Ernest, not a cleanup. See docs/pricing-audit-2026-09-02.md.

  Run:
    node cms/scripts/link-pricing-cards-to-services.mjs
    node cms/scripts/link-pricing-cards-to-services.mjs --confirm
*/

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CONFIRM = process.argv.includes('--confirm')

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

/* Trailing slashes are not optional. The site sets trailingSlash: 'always', so
   a path without one answers 308 and costs every visitor a redirect. */
const CARDS = {
    'Website build': { pageUrl: '/services/web-design/', buttonText: 'Book a call' },
    'Video retainer': { pageUrl: '/services/video-production/', buttonText: 'Book a call' },
    'Growth retainer': { pageUrl: '/services/video-production/', buttonText: 'Book a call' },
    Starter: { pageUrl: '/services/', buttonText: 'Book a call' },
    Growth: { pageUrl: '/services/', buttonText: 'Book a call' },
    Premium: { pageUrl: '/services/', buttonText: 'Book a call' },
}

const plans = (await (await fetch(`${BASE}/api/pricingPlans?limit=50&depth=0&sort=order`, { headers })).json()).docs || []

let failed = 0
let changed = 0
const missing = Object.keys(CARDS).filter((n) => !plans.some((p) => p.name === n))
if (missing.length) {
    console.error(`No card named: ${missing.join(', ')}`)
    console.error('A plan was renamed in the CMS. Fix the key here rather than silently skipping it.')
    process.exit(1)
}

for (const plan of plans) {
    const patch = CARDS[plan.name]
    if (!patch) continue
    const before = `${plan.pageUrl || '/contact/ (fallback)'}  "${plan.buttonText || 'Get Started (default)'}"`
    console.log(`  [${String(plan.market).padEnd(13)}] ${plan.name.padEnd(16)} ${before}`)
    console.log(`  ${''.padEnd(15)} ${''.padEnd(16)} -> ${patch.pageUrl}  "${patch.buttonText}"`)
    if (!CONFIRM) continue

    const res = await fetch(`${BASE}/api/pricingPlans/${plan.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch),
    })
    const out = await res.json()
    if (!res.ok) {
        console.error(`    HTTP ${res.status}`)
        failed++
        continue
    }
    /* Payload strips fields its running config does not declare and answers 200
       while doing it, so a new field that has not shipped to Railway yet looks
       exactly like a successful write. Compare, do not trust the status. */
    const got = out.doc || out
    if (got.pageUrl !== patch.pageUrl || got.buttonText !== patch.buttonText) {
        console.error(`    came back as pageUrl=${got.pageUrl} buttonText=${got.buttonText}`)
        console.error('    The CMS has not been redeployed with the pageUrl field yet.')
        failed++
        continue
    }
    changed++
    console.log('    written')
}

console.log('')
if (failed) {
    console.error(`${failed} card(s) did not take.`)
    process.exit(1)
}
if (!CONFIRM) {
    console.log('Dry run. Nothing was written. Re-run with --confirm.')
    process.exit(0)
}
console.log(`${changed} card(s) written. The edge cache holds public pages for 60 seconds.`)
