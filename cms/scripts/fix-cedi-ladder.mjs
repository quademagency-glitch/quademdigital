#!/usr/bin/env node
/*
  Brings the cedi prices into line with the dollar ones.

  Approved by Ernest on 2 September 2026. Dry run by default.

  THE PROBLEM THIS FIXES

  The site holds two price ladders, cedis for Ghana and dollars for everyone
  else, and they are not conversions of each other. That is right: converted at
  any real rate a logo would cost a Ghanaian several times what the market
  bears.

  What was wrong is that the two ladders **ranked the same services in opposite
  orders**, which is what a buyer notices:

      in dollars a logo ($3,000) cost more than a Fieldwork setup ($2,500)
      in cedis a Fieldwork setup (GH₵ 6,000) cost six times a logo (GH₵ 1,000)

  Measured as cedis per dollar, the site ran from 0.33 to 3.00, a nine fold
  spread. Eight of the thirteen tiers already sat between 0.67 and 1.40. Only
  two services were outliers, so this moves those two and leaves the rest alone.

  WHAT MOVES, AND WHY EACH ONE

  Branding was too cheap in cedis. A logo was the third dearest thing on the site
  in dollars and the cheapest in cedis.

      Logo Design   GH₵ 1,000 -> GH₵ 2,000   ratio 0.33 -> 0.67
      Brand Kit     GH₵ 2,500 -> GH₵ 3,500   ratio 0.50 -> 0.70

  GH₵ 2,000 is deliberately below the GH₵ 2,500 Starter bundle on the homepage,
  which includes branding AND a five page website. A logo alone cannot cost the
  same as that bundle.

  Fieldwork was the other way round, and the fix is mostly in dollars rather than
  cedis, because the cedi price was the sane one:

      Leads only      $300/mo   -> $1,200/mo   ratio 3.00 -> 0.75
      Done for you    $1,500/mo -> $3,000/mo   ratio 2.67 -> 1.33
      Setting it up   GH₵ 6,000 -> GH₵ 3,000   ratio 2.40 -> 1.20

  The Fieldwork page says a lead takes about twenty minutes and that 20 to 30
  ship a month, so a month is 8 to 10 hours of hand research. $300 for that is
  about $33 an hour. The GH₵ 900 is near GH₵ 100 an hour, which is the defensible
  one, so the dollar prices rise rather than the cedi price falling.

  The setup fee is the exception: Ernest kept it at $2,500, so the cedi side
  moves instead. GH₵ 6,000 also put a setup fee above the entire GH₵ 5,500
  Growth bundle, which contains a custom website, a full brand identity kit and
  three months of search work.

  Result: the band tightens from 0.33-3.00 to 0.67-1.40, a 2.1x spread, and every
  tier lands inside the range web design, SEO and video already occupied.

  WHAT THIS SCRIPT DOES NOT TOUCH

  Fieldwork's prices are typed into src/pages/services/fieldwork.astro, not held
  in the CMS, so the three Fieldwork changes above are made in that file and ship
  with a deploy. This script covers the CMS half: branding and the homepage
  estimator.

  THE ESTIMATOR

  calculatorServices is a separate collection from everything else and two of its
  three lines disagreed with the service pages:

      Branding & Identity   dollars from Logo Design, cedis from Brand Kit, so
                            switching currency silently switched which product
                            was being quoted. Cedis now follow Logo Design.
      SEO & Content         $2,400 / GH₵ 2,000 appeared nowhere else on the site,
                            and was presented as a one-off while the SEO page
                            sells a monthly. Now matches Local SEO.

  Run:
    node cms/scripts/fix-cedi-ladder.mjs
    node cms/scripts/fix-cedi-ladder.mjs --confirm
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

/* Keyed on the tier name exactly as it reads in the CMS. A name that stops
   matching is reported rather than skipped, because a silent skip leaves a
   price wrong and nobody finds out. */
const CEDI_FIXES = {
    brandIdentityPage: {
        'Logo Design': 'GH₵ 2,000',
        'Brand Kit': 'GH₵ 3,500',
    },
}

const CALCULATOR_FIXES = {
    'Branding & Identity': { priceGHS: 2000, basePrice: 2000 },
    'SEO & Content': { priceUSD: 1500, priceGHS: 1500, basePrice: 1500 },
}

let failed = 0
let changed = 0

for (const [slug, byName] of Object.entries(CEDI_FIXES)) {
    const read = await fetch(`${BASE}/api/globals/${slug}?depth=0`, { headers })
    if (!read.ok) {
        console.error(`${slug}: could not read, HTTP ${read.status}`)
        failed++
        continue
    }
    const section = (await read.json()).pricingSection || {}
    /* The array is `plans`. Reading `tiers || plans` and writing back to `tiers`
       is how an earlier pricing script wrote nothing at all: Payload answered
       200, ignored the key it does not declare, and left every price unset. */
    const ARRAY_KEY = Array.isArray(section.plans) ? 'plans' : 'tiers'
    const tiers = section[ARRAY_KEY] || []
    if (!tiers.length) {
        console.error(`${slug}: no tiers found.`)
        failed++
        continue
    }

    console.log(slug)
    const unknown = Object.keys(byName).filter((n) => !tiers.some((t) => t.name === n))
    if (unknown.length) {
        console.error(`  tier name(s) not on the page: ${unknown.join(', ')}`)
        console.error('  A tier was renamed in the CMS. Fix the key here rather than leaving it wrong.')
        failed++
        continue
    }

    // Strip Payload's row ids so it writes fresh ones rather than reusing.
    const nextTiers = tiers.map(({ id, ...tier }) => {
        const next = byName[tier.name]
        if (next === undefined) return tier
        console.log(`  ${String(tier.name).padEnd(22)} ${String(tier.price).padEnd(12)} -> ${next}   (USD ${tier.priceUsd} unchanged)`)
        return { ...tier, price: next }
    })

    if (CONFIRM) {
        // Send the whole group back, not just the array: posting a partial group
        // drops the headings around the table.
        const res = await fetch(`${BASE}/api/globals/${slug}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ pricingSection: { ...section, [ARRAY_KEY]: nextTiers } }),
        })
        const out = await res.json()
        if (!res.ok) {
            console.error(`  HTTP ${res.status}`)
            failed++
            continue
        }
        const got = (out.result || out.doc || out).pricingSection?.[ARRAY_KEY] || []
        const bad = got.filter((t) => byName[t.name] && t.price !== byName[t.name])
        if (bad.length) {
            console.error(`  came back wrong: ${bad.map((t) => `${t.name}=${t.price}`).join(', ')}`)
            failed++
            continue
        }
        changed += Object.keys(byName).length
        console.log('  written')
    }
}

console.log('\ncalculatorServices')
const calcRes = await fetch(`${BASE}/api/calculatorServices?limit=50&depth=0`, { headers })
const calc = (await calcRes.json()).docs || []
for (const [name, patch] of Object.entries(CALCULATOR_FIXES)) {
    const doc = calc.find((c) => c.name === name)
    if (!doc) {
        console.error(`  "${name}" not found in calculatorServices.`)
        failed++
        continue
    }
    const before = `$${doc.priceUSD} / GH₵ ${doc.priceGHS}`
    const after = `$${patch.priceUSD ?? doc.priceUSD} / GH₵ ${patch.priceGHS ?? doc.priceGHS}`
    console.log(`  ${name.padEnd(26)} ${before.padEnd(22)} -> ${after}`)
    if (!CONFIRM) continue

    const res = await fetch(`${BASE}/api/calculatorServices/${doc.id}`, {
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
    const got = out.doc || out
    const wrong = Object.entries(patch).filter(([k, v]) => got[k] !== v)
    if (wrong.length) {
        console.error(`    came back wrong: ${wrong.map(([k, v]) => `${k}=${got[k]} wanted ${v}`).join(', ')}`)
        failed++
        continue
    }
    changed += 1
    console.log('    written')
}

console.log('')
if (failed) {
    console.error(`${failed} change(s) did not take.`)
    process.exit(1)
}
if (!CONFIRM) {
    console.log('Dry run. Nothing was written. Re-run with --confirm.')
    console.log('')
    console.log('Fieldwork is not in here: its prices are typed into')
    console.log('src/pages/services/fieldwork.astro and ship with a deploy.')
    process.exit(0)
}
console.log(`${changed} price(s) written. The edge cache holds public pages for 60 seconds.`)
