#!/usr/bin/env node
/*
  Fills in the dollar price on every service page tier.

  The four service page globals each hold a cedi price per tier. `priceUsd` was
  added beside it on 31 August 2026 so the page could show cedis in Ghana and
  dollars everywhere else, but it was left empty, so every visitor outside Ghana
  saw "Get a quote" on all thirteen tiers.

  WHERE THESE NUMBERS COME FROM
  -----------------------------
  Three international prices were already published and sold at, in the
  pricingPlans collection and on /global :

      Website build     $3,000
      Video retainer    $1,500 /mo
      Growth retainer   $2,500 /mo

  Video Starter and Video Growth ARE those last two, so they are copied across
  rather than derived.

  For the rest, Ernest chose the rule on 2 September 2026: nothing one-off under
  $3,000. The reasoning is that /global sells a build from $3,000 and roughly a
  thousand cold emails point at that page, so a cheaper one-off tier sitting on
  another page undercuts the thing being advertised. Monthly plans are not
  covered by the floor and keep their own ladder.

  THE ONE EXCEPTION TO THE FLOOR, AND WHY
  ---------------------------------------
  Video "Reel Pack" is the try-once tier: three reels, no subscription, no
  commitment. The floor first put it at $3,000, which made the trial cost double
  the $1,500 monthly Starter beside it. Nobody buys an on-ramp at twice the price
  of the thing it ramps on to, so the whole ladder read as a mistake.

  Ernest's call on 2 September 2026: break the floor for this one tier and price
  it below Starter. The number is not picked, it is his own ratio moved across.
  In Ghana Reel Pack is GH₵ 1,500 against a GH₵ 1,800 Starter, which is 0.833.
  Applied to the published $1,500 Starter that is $1,250.

  It reads correctly on the page now. Three reels for $1,250, or for $250 more a
  month of four reels plus twelve branded posts plus a content calendar. The
  trial is cheaper and the upgrade is obviously better value, which is what an
  on-ramp is supposed to do.

  Custom stays Custom. Those three tiers have no cedi figure either.

  Run:
    node cms/scripts/set-service-page-usd-prices.mjs --dry-run
    node cms/scripts/set-service-page-usd-prices.mjs
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

/* Keyed on the tier name exactly as it reads in the CMS. A name that stops
   matching is reported rather than skipped quietly, because a silent skip here
   means a tier goes on showing "Get a quote" and nobody finds out. */
const PRICES = {
    webDesignPage: {
        'Landing Page': '$3,000',
        'Corporate Site': '$7,500',
        'E-Commerce': 'Custom',
    },
    seoPage: {
        'Local SEO': '$1,500',
        'Growth SEO': '$3,000',
        Enterprise: 'Custom',
    },
    brandIdentityPage: {
        'Logo Design': '$3,000',
        'Brand Kit': '$5,000',
        'Full Visual Identity': 'Custom',
    },
    videoProductionPage: {
        // Deliberately below the $3,000 floor. See "the one exception" above.
        'Reel Pack': '$1,250',
        Starter: '$1,500',
        Growth: '$2,500',
        Scale: '$6,000',
    },
}

let failed = 0
let wrote = 0

for (const [slug, byName] of Object.entries(PRICES)) {
    const read = await fetch(`${BASE}/api/globals/${slug}?depth=0`, { headers })
    if (!read.ok) {
        console.error(`${slug}: could not read, HTTP ${read.status}`)
        failed++
        continue
    }
    const doc = await read.json()
    const section = doc.pricingSection || {}
    /* The array is `plans`. Reading `tiers || plans` and then writing back to
       `tiers` is how the first run of this script failed: Payload accepted the
       200, ignored the key it does not declare, and left every price unset. The
       key is read once and reused for the write so the two cannot drift. */
    const ARRAY_KEY = Array.isArray(section.plans) ? 'plans' : 'tiers'
    const tiers = section[ARRAY_KEY] || []
    if (!tiers.length) {
        console.error(`${slug}: no tiers found.`)
        failed++
        continue
    }

    console.log(slug)
    const unknown = []
    // Strip Payload's row ids so it writes fresh ones rather than reusing.
    const nextTiers = tiers.map(({ id, ...tier }) => {
        const usd = byName[tier.name]
        if (usd === undefined) {
            unknown.push(tier.name)
            return tier
        }
        const period = tier.period ? `  (${tier.period})` : ''
        console.log(`  ${String(tier.name).padEnd(22)} ${String(tier.price).padEnd(10)} -> ${usd}${period}`)
        return { ...tier, priceUsd: usd }
    })

    if (unknown.length) {
        console.error(`  tier name(s) with no price in this script: ${unknown.join(', ')}`)
        console.error('  A tier was renamed in the CMS. Fix the key here rather than leaving it blank.')
        failed++
        continue
    }

    if (DRY) continue

    // Send the whole pricingSection back, not just the array: this is a group,
    // and posting a partial group drops the headings around the table.
    const res = await fetch(`${BASE}/api/globals/${slug}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pricingSection: { ...section, [ARRAY_KEY]: nextTiers } }),
    })
    const out = await res.json()
    if (!res.ok) {
        console.error(`  HTTP ${res.status}`)
        console.error(JSON.stringify(out, null, 2).slice(0, 700))
        failed++
        continue
    }

    // Payload drops fields the running app does not declare, without erroring,
    // so compare what came back rather than trusting the 200.
    const got = (out.result || out.doc || out).pricingSection?.[ARRAY_KEY] || []
    const bad = got.filter((t) => t.priceUsd !== byName[t.name])
    if (bad.length || got.length !== nextTiers.length) {
        console.error(`  came back wrong: ${got.map((t) => `${t.name}=${t.priceUsd}`).join(', ')}`)
        failed++
        continue
    }
    wrote += got.length
    console.log('  written')
}

console.log('')
if (failed) {
    console.error(`${failed} page(s) did not take.`)
    process.exit(1)
}
console.log(DRY ? 'Dry run. Nothing was written.' : `${wrote} tier prices written. The edge cache holds public pages for 60 seconds.`)
