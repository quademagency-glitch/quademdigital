#!/usr/bin/env node
/*
  Puts the international pricing tiers into the CMS, labels the existing three as
  the Ghana tiers, and corrects the homepage calculator's dollar prices.

  RUN THIS AFTER THE MIGRATION, NOT BEFORE. It writes `market`, a column that
  20260827_093000_add_pricing_plan_market adds. Against a database without it,
  Payload drops the unknown field silently and every plan stays on the default,
  which would put the Ghana packages in front of international visitors and the
  international tiers in front of nobody.

  Why these numbers and not converted cedis. The site used to show GHS 2,500 in
  Ghana and its conversion, $425, everywhere else, while the international
  landing page sold the same website "from $1,200". Both were live, so a buyer
  in London who read the landing page and clicked through to the homepage found
  the same work at a third of the price.

  The three tiers below come from section 5 of docs/global-page-spec.md, with one
  price changed on Ernest's call on 29 August 2026: the website build starts at
  $3,000 rather than the spec's $1,200.

  The spec's number put the biggest job at the bottom of its own ladder. Setting
  up Fieldwork is from $2,500 for two to three weeks; a whole website was from
  $1,200 for three to five weeks, so the longer job cost half as much, and a
  single month of the video retainer cost more than an entire site. Across
  fifteen to twenty-five working days, $1,200 is $48 to $80 a day for design,
  build, search-ready copy, a fixed price and a month of changes afterwards.

  It also contradicted the page carrying it. Section 04 says "I charge less than
  a London or New York agency because my costs are lower, not because the work
  is." $1,200 does not read as the same work with lower overheads, it reads as
  lesser work, and it selects for the buyer who shops on price.

  Ghana and the international market do not share a tier structure, which is
  why this creates rows rather than editing the three that exist. Ghana buys
  packages (Starter, Growth, Premium). The international market buys service
  lines (a build, a video retainer, a growth retainer). There is no honest
  mapping between them: "Video retainer" has no Ghana equivalent at all, since
  the Premium package explicitly excludes video production.

  It also fixes billingCycle on the Premium plan. It reads "month", and the
  Ghana price switch in src/scripts/main.js concatenates the value straight on
  to the number, so a visitor in Ghana was shown "GH₵ 8,000month". The field's
  own admin description says to write "/mo".

  And it folds video into the Ghana Premium package, which Ernest asked for on
  28 August 2026. Premium sold itself as "everything I do, on retainer" while
  its own feature list said "All services included except video production",
  which is a carve-out at the top of the range around the service the business
  leads with everywhere else.

  The new price is GH₵ 11,500: the GH₵ 8,000 package plus the GH₵ 3,500 Growth
  video tier from src/pages/services/video-production.astro, added rather than
  discounted. Both halves are already published prices, so nothing here is a
  number anyone made up. The video allowance that comes with it, six reels and
  twenty branded posts a month, is that tier's own allowance.

  The USD figure moves with it only to keep the admin honest. Premium is a Ghana
  plan, so its dollar price is never displayed; leaving $1,350 beside GH₵ 11,500
  would just be a trap for whoever reads the record next. 5.882 is the rate the
  other two Ghana plans already imply (2,500/425).

  The calculator was the last place still quoting converted cedis. It priced Web
  Design at $425 while the pricing card directly below it says a website build
  starts at $3,000: seven times apart, on one screen, to one visitor. Its cedi
  column was always right and is left alone.

  Web design becomes $3,000, matching the build tier. Branding and SEO have no
  international price anywhere on the site, so Ernest set them on 29 August 2026
  at the ratio his cedi prices already use (2,500 / 2,500 / 2,000): $3,000 and
  $2,400.

  Run:
    node cms/scripts/seed-international-pricing.mjs --dry-run
    node cms/scripts/seed-international-pricing.mjs
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

// Section 5 of docs/global-page-spec.md, with the build price raised. See above.
const INTERNATIONAL = [
    {
        name: 'Website build',
        market: 'international',
        price: 'from $3,000',
        priceLabel: 'from $3,000',
        priceUSD: 3000,
        billingCycle: '',
        description: 'Three to five weeks, fixed price, everything included.',
        features: [
            'Design and build, start to finish',
            'Written for search, not just decorated',
            'Fixed price agreed before anything starts',
            'One month of changes after launch',
        ],
        buttonText: 'Book a call',
        order: 1,
    },
    {
        name: 'Video retainer',
        market: 'international',
        price: 'from $1,500 a month',
        priceLabel: 'from $1,500',
        priceUSD: 1500,
        billingCycle: '/mo',
        description: 'Eight to twelve videos a month, rolling monthly.',
        features: [
            'Eight to twelve short videos a month',
            'No shoot day, no crew, no studio',
            'You film a few clips on your phone once a month',
            'Rolling monthly, cancel with 30 days notice',
        ],
        buttonText: 'Book a call',
        order: 2,
    },
    {
        name: 'Growth retainer',
        market: 'international',
        price: 'from $2,500 a month',
        priceLabel: 'from $2,500',
        priceUSD: 2500,
        billingCycle: '/mo',
        description: 'Video, SEO, content and site work combined.',
        /*
          The one marked out of the three. The Ghana set highlights its middle
          tier and the international set highlighted nothing, so all three read
          as equally weighted and the card a stranger should look at first was
          whichever one their eye landed on.

          This one rather than the cheapest, because it is the only tier that
          contains another ("everything in the video retainer"), it is the
          relationship the campaign is actually trying to start, and marking the
          dearest option makes the two beside it read as the reasonable ones.
          Moving it is one checkbox in the admin.
        */
        isPopular: true,
        features: [
            'Everything in the video retainer',
            'Search and content work every month',
            'Ongoing changes to the site',
            'Direct line to me, not a queue',
            'Rolling monthly, cancel with 30 days notice',
        ],
        buttonText: 'Book a call',
        order: 3,
    },
]

/*
  The calculator's dollar prices. Keyed by name; the cedi column is untouched.
*/
const CALCULATOR_USD = {
    'Web Design & Development': 3000,
    'Branding & Identity': 3000,
    'SEO & Content': 2400,
}

const res = await fetch(`${BASE}/api/pricingPlans?depth=0&limit=100&sort=order`, { headers })
if (!res.ok) {
    console.error(`Could not read pricingPlans: HTTP ${res.status}`)
    process.exit(1)
}
const existing = (await res.json()).docs || []

const planned = []

/*
  Premium, with video folded in. Keyed by name because these rows have no slug.
  Everything not named here is left exactly as it is.
*/
const GHANA_EDITS = {
    Premium: {
        price: '11500',
        priceGHS: 11500,
        priceUSD: 1955,
        description: 'Your ongoing growth partner. Everything I do, on retainer, month to month.',
        features: [
            'Every service included, video production among them',
            '6 short-form videos a month',
            '20 branded posts a month',
            'Continuous ad management',
            'Weekly content creation',
            'Advanced analytics & reporting',
            'Direct line to me, not a queue',
            'No long-term contract, cancel with 30 days notice',
        ],
    },
}

// 1. Label the existing plans as the Ghana tiers, fix the billing cycle, and
//    apply any edits above.
for (const plan of existing) {
    if (INTERNATIONAL.some((p) => p.name === plan.name)) continue
    const patch = {}
    if (plan.market !== 'ghana') patch.market = 'ghana'
    if (plan.billingCycle === 'month') patch.billingCycle = '/mo'

    const edit = GHANA_EDITS[plan.name]
    if (edit) {
        for (const [key, value] of Object.entries(edit)) {
            if (key === 'features') {
                const current = (plan.features || []).map((f) => (typeof f === 'string' ? f : f.feature))
                if (JSON.stringify(current) !== JSON.stringify(value)) {
                    patch.features = value.map((feature) => ({ feature }))
                }
                continue
            }
            if (plan[key] !== value) patch[key] = value
        }
    }

    if (Object.keys(patch).length) planned.push({ kind: 'UPDATE', id: plan.id, name: plan.name, patch })
}

// 2. Create the international tiers, or update them if they are already there.
for (const plan of INTERNATIONAL) {
    const match = existing.find((d) => d.name === plan.name)
    planned.push({
        kind: match ? 'UPDATE' : 'CREATE',
        id: match?.id,
        name: plan.name,
        patch: { ...plan, features: plan.features.map((feature) => ({ feature })) },
    })
}

// 3. The homepage calculator's dollar prices.
const calcRes = await fetch(`${BASE}/api/calculatorServices?depth=0&limit=100`, { headers })
if (!calcRes.ok) {
    console.error(`Could not read calculatorServices: HTTP ${calcRes.status}`)
    process.exit(1)
}
for (const svc of (await calcRes.json()).docs || []) {
    const usd = CALCULATOR_USD[svc.name]
    if (!usd || svc.priceUSD === usd) continue
    planned.push({
        kind: 'UPDATE',
        collection: 'calculatorServices',
        id: svc.id,
        name: `${svc.name} (calculator)`,
        patch: { priceUSD: usd },
    })
}

if (planned.length === 0) {
    console.log('Nothing to change. Both markets are already set up.')
    process.exit(0)
}

for (const p of planned) {
    console.log(`${p.kind}  ${p.name}`)
    for (const [k, v] of Object.entries(p.patch)) {
        if (k === 'features') {
            console.log(`    features: ${v.length} bullet(s)`)
            continue
        }
        console.log(`    ${k}: ${JSON.stringify(v)}`)
    }
}

if (DRY) {
    console.log(`\nDry run. ${planned.length} plan(s) would change. Nothing was written.`)
    process.exit(0)
}

for (const p of planned) {
    const collection = p.collection || 'pricingPlans'
    const r =
        p.kind === 'UPDATE'
            ? await fetch(`${BASE}/api/${collection}/${p.id}`, { method: 'PATCH', headers, body: JSON.stringify(p.patch) })
            : await fetch(`${BASE}/api/${collection}`, { method: 'POST', headers, body: JSON.stringify(p.patch) })
    const out = await r.json()
    if (!r.ok) {
        console.error(`\nHTTP ${r.status} on ${p.name}`)
        console.error(JSON.stringify(out, null, 2).slice(0, 1200))
        process.exit(1)
    }
    console.log(`${p.kind === 'UPDATE' ? 'Updated' : 'Created'} ${p.name}`)
}

console.log('\nNow check both markets render:')
console.log('  curl -s https://quademdigital.com/ | grep -c \'data-market="international"\'   # 3')
console.log('  curl -s https://quademdigital.com/ | grep -c \'data-market="ghana"\'           # 3')
