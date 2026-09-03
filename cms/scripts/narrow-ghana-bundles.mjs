#!/usr/bin/env node
/*
  Makes the three Ghana bundles claim what their price actually buys.

  Ernest's call, 2 September 2026: narrow what the bundles include rather than
  raise them. No price moves.

  THE PROBLEM

  Each bundle's feature list, priced as the services it names at what those
  services cost on their own pages:

      Starter   GH₵ 2,500   claimed parts GH₵ 7,000    64% cheaper
      Growth    GH₵ 5,500   claimed parts GH₵ 13,000   58% cheaper
      Premium   GH₵ 11,500  claimed parts GH₵ 8,800    31% dearer

  So the homepage undercut every service page. A Ghanaian read "standard 5-page
  website" plus branding for GH₵ 2,500 on the front page, clicked the new "What
  this covers" link, and found a landing page alone at GH₵ 2,500 and a Corporate
  Site at GH₵ 5,000.

  WHAT EACH ONE BECOMES, AND THE ARITHMETIC BEHIND IT

  Starter, GH₵ 2,500. At this price there is no bundle to be had: the cheapest
  website on the site is the Landing Page at exactly GH₵ 2,500, and the cheapest
  logo is GH₵ 2,000. Two of anything is GH₵ 4,500 and up. So Starter stops
  pretending to be a bundle and becomes the Landing Page, described in the
  Landing Page's own terms. Parts GH₵ 2,500 against a price of GH₵ 2,500: no
  discount claimed and no contradiction left.

  Growth, GH₵ 5,500. Corporate Site GH₵ 5,000 plus Logo Design GH₵ 2,000 is
  GH₵ 7,000, so GH₵ 5,500 is 21% off, which is what a bundle normally is. The
  "complete brand identity kit" goes, because that is the Brand Kit at GH₵ 3,500
  and it does not fit. The "3 months SEO & Marketing" goes, because that is
  GH₵ 4,500 on its own and was the largest single overclaim on the page.

  Premium, GH₵ 11,500 a month. Revised 3 September 2026, Ernest's call.

  On 2 September this card lost the untrue sentence "Every service included",
  and was left flagged: GH₵ 11,500 against Video Growth GH₵ 3,500 plus Growth
  SEO GH₵ 3,500 is GH₵ 4,500 unaccounted for, and the card did not say why that
  difference was worth paying.

  The flag was pointing at the wrong number. Video **Scale** is GH₵ 8,000 and
  Growth SEO is GH₵ 3,500, which is GH₵ 11,500 to the cedi. Premium's price was
  never the mistake; its feature list was written at the Growth tier while its
  price was set at the Scale tier. The giveaway was already sitting in the list:
  "Advanced analytics and reporting" is a Scale line, and Growth only promises a
  monthly performance report.

  So the volumes come up to Scale rather than the price coming down: 10 videos
  instead of 6, 30 posts instead of 20, 12 ad creatives instead of 8, and every
  platform instead of two or three. Parts GH₵ 11,500 against a price of
  GH₵ 11,500. No discount claimed, no markup, and nothing left unexplained.

  Two further facts the card was missing. The ad budget is separate from the
  fee, which src/pages/api/client-won.ts already tells a client at onboarding
  but which nobody was told before they bought. And the search half is now
  described by what it actually is, the Growth SEO tier, rather than as the
  vague "search and content work every month".

  Ernest chose this over cutting the price to about GH₵ 7,500, which would have
  been the same fix seen from the other end and would have cost GH₵ 4,000 a
  month per client.

  THE WORDING COMES FROM THE SERVICE PAGES

  Every feature line below is the same promise as the tier it is drawn from, in
  plainer words. Where the two pages describe the same thing they now agree, so
  a visitor following "What this covers" is not told something different when
  they arrive.

  KEEPING IT TRUE

  `scripts/pricing-audit.mjs` recomputes each bundle against its parts and fails
  if the gap drifts. Change a service price and it will tell you which bundle
  claim went stale, rather than leaving the homepage quietly wrong again.

  Run:
    node cms/scripts/narrow-ghana-bundles.mjs
    node cms/scripts/narrow-ghana-bundles.mjs --confirm
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

const BUNDLES = {
    Starter: {
        pageUrl: '/services/web-design/',
        description:
            'One page, built to do one job. This is the Landing Page from the web design page, at the same price.',
        features: [
            'One custom designed page, written to convert',
            'Works properly on a phone',
            'Contact form wired up and tested',
            'Basic search setup so it can be found',
            'Social links',
            'About a week from start to live',
        ],
        parts: [['Landing Page', 2500]],
    },
    Growth: {
        pageUrl: '/services/web-design/',
        description:
            'A five page site and the logo that goes on it. GH₵ 7,000 if you bought the two separately.',
        features: [
            'Up to 5 custom pages, with a blog you can update yourself',
            'A content manager, so you are not calling me to change a price',
            '3 logo concepts, 3 rounds of changes, and every file you need',
            'Advanced search setup and Google Analytics',
            'Performance tuning so it loads fast',
            '30 days of support after launch',
        ],
        parts: [
            ['Corporate Site', 5000],
            ['Logo Design', 2000],
        ],
    },
    Premium: {
        pageUrl: '/services/',
        description:
            'The top video plan and the growth search plan, run together every month. The same price as buying both separately. Your ad budget is on top, and the website and branding are one off jobs priced above.',
        /* Every line below is a promise already made by Video Scale or Growth
           SEO on their own pages, in plainer words. Nothing new is invented and
           nothing is quietly larger here than it is there. */
        features: [
            '10 short-form videos a month',
            '30 branded posts a month',
            '12 ad creatives, and I run the ads for you',
            'Every platform covered, not just one',
            'Search work every month: technical fixes, link building and 4 blog posts',
            'Advanced analytics and reporting',
            'Direct line to me, not a queue',
            'Rolling monthly, cancel with 30 days notice',
        ],
        parts: [
            ['Video Scale', 8000],
            ['Growth SEO', 3500],
        ],
    },
}

const plans = (await (await fetch(`${BASE}/api/pricingPlans?limit=50&depth=0&sort=order`, { headers })).json()).docs || []
const missing = Object.keys(BUNDLES).filter((n) => !plans.some((p) => p.name === n && p.market === 'ghana'))
if (missing.length) {
    console.error(`No Ghana card named: ${missing.join(', ')}`)
    process.exit(1)
}

let failed = 0
let changed = 0

for (const plan of plans) {
    const b = BUNDLES[plan.name]
    if (!b || plan.market !== 'ghana') continue

    const price = Number(String(plan.priceGHS || plan.price).replace(/[^0-9]/g, ''))
    const partsTotal = b.parts.reduce((a, [, v]) => a + v, 0)
    const gap = ((partsTotal - price) / partsTotal) * 100

    console.log(`${plan.name}  GH₵ ${price.toLocaleString()}`)
    console.log(`  was: ${(plan.features || []).map((f) => f.feature).join(' / ')}`)
    console.log(`  now: ${b.features.join(' / ')}`)
    console.log(`  parts: ${b.parts.map(([n, v]) => `${n} GH₵ ${v.toLocaleString()}`).join(' + ')} = GH₵ ${partsTotal.toLocaleString()}`)
    if (b.partsAreIncomplete) {
        console.log(`  that is the priced portion only. The ad running, the weekly content and`)
        console.log(`  the direct line are not sold as tiers anywhere, so GH₵ ${(price - partsTotal).toLocaleString()} of this`)
        console.log(`  price covers work with no list price. Worth a look, not changed here.`)
    } else if (gap > 0) {
        console.log(`  ${gap.toFixed(0)}% cheaper than its parts, which is what a bundle should be`)
    } else {
        console.log(`  same as its parts, so no discount is claimed and nothing contradicts`)
    }
    console.log('')

    if (!CONFIRM) continue

    const patch = {
        description: b.description,
        pageUrl: b.pageUrl,
        features: b.features.map((feature) => ({ feature })),
    }
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
    if (gotFeatures.join('|') !== b.features.join('|') || got.description !== b.description || got.pageUrl !== b.pageUrl) {
        console.error(`  came back with ${gotFeatures.length} feature(s), expected ${b.features.length}`)
        failed++
        continue
    }
    changed++
    console.log('  written\n')
}

if (failed) {
    console.error(`${failed} bundle(s) did not take.`)
    process.exit(1)
}
if (!CONFIRM) {
    console.log('Dry run. Nothing was written. Re-run with --confirm.')
    console.log('No price is changed by this script, only what each bundle says it includes.')
    process.exit(0)
}
console.log(`${changed} bundle(s) rewritten. No price changed. The edge cache holds public pages for 60 seconds.`)
