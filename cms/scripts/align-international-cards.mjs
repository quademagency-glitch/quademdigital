#!/usr/bin/env node
/*
  Makes the three international cards claim what their price actually buys.

  Ernest's call, 3 September 2026: fix the claim, and move one price.

  THE PROBLEM

  The audit had only ever looked at the three Ghana cards. The international
  three were never checked, and they were worse. They are also the row /global
  shows, which is where roughly a thousand cold emails land.

      Video retainer   $1,500/mo   "eight to twelve short videos a month"
      video page       $1,500/mo   four videos. Ten costs $6,000.

  So the homepage undercut its own service page by 75%, and the "What this
  covers" link added on 2 September walks a buyer straight from one number to
  the other. Growth retainer was 72% under its parts on the same reading, or 55%
  read charitably as the Growth tier. Either way past the 35% a bundle should be.

  WHAT EACH ONE BECOMES

  Website build, $3,000, price unchanged. At this price the web design page sells
  the Landing Page: one page, about a week. The card said "design and build,
  start to finish" over "three to five weeks", which is Corporate Site language,
  and the Corporate Site is $7,500. So the card becomes the Landing Page in the
  Landing Page's own terms, exactly as Ghana's Starter did on 2 September.

  Video retainer, $1,500, price unchanged. Becomes the Starter plan it is priced
  as: four videos, twelve posts, one platform. It gains the posts and the
  platform, which Starter has always included and the card never mentioned, so
  the honest version of this card is fuller than the false one was.

  Growth retainer, $2,500 -> $3,750. The one price that moves. Video Growth
  $2,500 plus Growth SEO $3,000 is $5,500, so $3,750 is 32% off, which is what a
  bundle should be. "Everything in the video retainer" now reads "plus two more
  videos a month", because the video retainer is four videos and Video Growth is
  six; without that line the parts no longer add up to what is promised.

  WHAT THIS DELIBERATELY LEAVES ALONE

  "One month of changes after launch" stays on Website build even though the
  Landing Page tier does not list post-launch support. It is a promise in the
  buyer's favour that Ernest already makes, and quietly deleting it is a
  delivery decision, not a cleanup. Either add it to the Landing Page tier or
  drop it here, but do it on purpose.

  "Ongoing changes to the site" stays on Growth retainer for the same reason. It
  is not sold as a tier anywhere, so it is not in the parts total.

  KEEPING IT TRUE

  scripts/pricing-audit.mjs now checks both markets, not just Ghana, and fails
  if any card drifts from its parts in either direction.

  This script covers the international cards only. The Ghana three are in
  cms/scripts/narrow-ghana-bundles.mjs. The two sets do not overlap, so neither
  can undo the other.

  Run:
    node cms/scripts/align-international-cards.mjs
    node cms/scripts/align-international-cards.mjs --confirm
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

const CARDS = {
    'Website build': {
        description:
            'One page, built to do one job. This is the Landing Page from the web design page, at the same price.',
        features: [
            'One custom designed page, written to convert',
            'Written for search, not just decorated',
            'Works properly on a phone',
            'Fixed price agreed before anything starts',
            'About a week from start to live',
            'One month of changes after launch',
        ],
        parts: [['Landing Page', 3000]],
    },
    'Video retainer': {
        description:
            'Four short videos a month, rolling monthly. This is the Starter plan from the video page, at the same price.',
        features: [
            'Four short videos a month',
            'Twelve branded posts a month',
            'One platform of your choice',
            'No shoot day, no crew, no studio',
            'You film a few clips on your phone once a month',
            'Rolling monthly, cancel with 30 days notice',
        ],
        parts: [['Video Starter', 1500]],
    },
    'Growth retainer': {
        /* The only price that moves. Everything else here is copy. */
        priceUSD: 3750,
        price: 'from $3,750 a month',
        priceLabel: 'from $3,750',
        description:
            'Video, SEO, content and site work combined. $5,500 if you bought the two separately.',
        features: [
            'Everything in the video retainer, plus two more videos a month',
            'Twenty branded posts a month',
            'Eight ad creatives for testing',
            'Search work every month: technical fixes, link building and four blog posts',
            'Ongoing changes to the site',
            'Direct line to me, not a queue',
            'Rolling monthly, cancel with 30 days notice',
        ],
        parts: [
            ['Video Growth', 2500],
            ['Growth SEO', 3000],
        ],
    },
}

const plans = (await (await fetch(`${BASE}/api/pricingPlans?limit=50&depth=0&sort=order`, { headers })).json()).docs || []
const missing = Object.keys(CARDS).filter((n) => !plans.some((p) => p.name === n && p.market === 'international'))
if (missing.length) {
    console.error(`No international card named: ${missing.join(', ')}`)
    process.exit(1)
}

let failed = 0
let changed = 0

for (const plan of plans) {
    const c = CARDS[plan.name]
    if (!c || plan.market !== 'international') continue

    const nextUsd = c.priceUSD ?? plan.priceUSD
    const partsTotal = c.parts.reduce((a, [, v]) => a + v, 0)
    const gap = ((partsTotal - nextUsd) / partsTotal) * 100

    console.log(`${plan.name}  $${plan.priceUSD.toLocaleString()}${c.priceUSD ? ` -> $${c.priceUSD.toLocaleString()}` : '  (price unchanged)'}`)
    console.log(`  was: ${(plan.features || []).map((f) => f.feature).join(' / ')}`)
    console.log(`  now: ${c.features.join(' / ')}`)
    console.log(`  parts: ${c.parts.map(([n, v]) => `${n} $${v.toLocaleString()}`).join(' + ')} = $${partsTotal.toLocaleString()}`)
    console.log(gap > 0.5 ? `  ${gap.toFixed(0)}% off, which is what a bundle should be` : '  same as its parts, so no discount is claimed and nothing contradicts')
    console.log('')

    if (!CONFIRM) continue

    const { parts, ...patch } = c
    patch.features = c.features.map((feature) => ({ feature }))
    const res = await fetch(`${BASE}/api/pricingPlans/${plan.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch),
    })
    const out = await res.json()
    if (!res.ok) {
        console.error(`  HTTP ${res.status}`)
        failed++
        continue
    }
    /* Read the write back. Payload strips fields its running config does not
       declare and answers 200 while doing it, so a partial write looks exactly
       like a successful one. */
    const got = out.doc || out
    const gotFeatures = (got.features || []).map((f) => f.feature)
    const wrong = []
    if (gotFeatures.join('|') !== c.features.join('|')) wrong.push(`${gotFeatures.length} features, wanted ${c.features.length}`)
    if (got.description !== c.description) wrong.push('description')
    if (c.priceUSD && got.priceUSD !== c.priceUSD) wrong.push(`priceUSD=${got.priceUSD}`)
    if (c.price && got.price !== c.price) wrong.push(`price=${got.price}`)
    if (c.priceLabel && got.priceLabel !== c.priceLabel) wrong.push(`priceLabel=${got.priceLabel}`)
    if (wrong.length) {
        console.error(`  came back wrong: ${wrong.join(', ')}`)
        failed++
        continue
    }
    changed++
    console.log('  written\n')
}

if (failed) {
    console.error(`${failed} card(s) did not take.`)
    process.exit(1)
}
if (!CONFIRM) {
    console.log('Dry run. Nothing was written. Re-run with --confirm.')
    console.log('One price moves: Growth retainer $2,500 to $3,750. The other two are copy only.')
    console.log('')
    console.log('The same strings live in three more places, which this does not touch:')
    console.log('  src/pages/global.astro            FALLBACK_PRICING and FALLBACK_SERVICES')
    console.log('  src/components/home/PricingSection.astro   the CMS-outage fallback')
    console.log('  cms/scripts/seed-international-pricing.mjs the seed these rows came from')
    process.exit(0)
}
console.log(`${changed} card(s) written. The edge cache holds public pages for 60 seconds.`)
