#!/usr/bin/env node
/*
  Clears the dead dollar figures off the three Africa packages.

  Approved by Ernest on 10 September 2026. Dry run by default.

  WHAT THEY WERE

  Starter, Growth and Premium are the Africa packages and are priced in cedis:
  GH₵ 2,500, GH₵ 5,500 and GH₵ 11,500. Each also carried a priceUSD, left over
  from before the market rule of 4 September: $425, $950 and $1,955, the cedi
  prices converted at a rate that was already old when it was written.

  WHY THEY ARE SAFE TO DELETE

  Nothing on the site reads them. PricingSection.astro prices an Africa plan
  from priceGHS and nothing else (see priceAmount there, which takes the field
  from the market and has no fallback across the two), and /global reads
  priceUSD from international plans only. Checked in a browser on 10 September
  with the country faked: the US, the UK and an unknown country are shown
  Website build, Video retainer and Growth retainer; Nigeria, Kenya and Ghana
  are shown the three packages from the cedi list, converted. No visitor
  anywhere is quoted $425.

  WHY THEY WERE WORTH DELETING ANYWAY

  The admin showed them under "Shown to visitors outside Ghana and used for
  live currency conversion", so the CMS stated that a buyer in London was being
  offered a website for $425. Commit be010da8 hides the box on Africa plans,
  which fixes what an editor sees; this removes the number underneath it, so a
  future script or report cannot pick it up and believe it.

  WHAT IT DOES NOT TOUCH

  priceGHS, price, the features, the badge, the market: nothing but priceUSD,
  and only on plans whose market is the cedi list. An international plan is
  skipped, loudly, because priceUSD is the only price those have.

  market and isPopular are sent back with their current values on purpose.
  payload.update reapplies a field's defaultValue for anything the incoming
  data does not name (see cms/CLAUDE.md), and isPopular defaults to false:
  Growth carries the "Most Popular" badge and would have lost it.

  Every plan is read and written to a backup beside this file before anything
  is written, so a mistake is one PATCH away from being undone.

  Run:
    node cms/scripts/clear-africa-plan-usd.mjs
    node cms/scripts/clear-africa-plan-usd.mjs --confirm
*/

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
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

/* The CMS still stores the cedi list as 'ghana'; the site calls it africa. The
   one translation lives in src/lib/markets.js as CMS_AFRICA_MARKET, and this is
   the stored value it translates. */
const AFRICA_MARKET = 'ghana'

const res = await fetch(`${BASE}/api/pricingPlans?limit=100&depth=0&sort=order`, { headers })
if (!res.ok) {
    console.error(`Could not read pricingPlans: HTTP ${res.status}`)
    process.exit(2)
}
const plans = (await res.json()).docs || []
if (!plans.length) {
    console.error('No pricing plans came back. Nothing done.')
    process.exit(2)
}

const backup = join(HERE, 'africa-plan-usd-backup.json')
writeFileSync(backup, JSON.stringify(plans, null, 2))
console.log(`Backup of all ${plans.length} plans: ${backup}\n`)

const targets = plans.filter((p) => p.market === AFRICA_MARKET && p.priceUSD != null)
if (!targets.length) {
    console.log('No Africa plan is carrying a dollar figure. Nothing to do.')
    process.exit(0)
}

let failed = 0
for (const plan of targets) {
    console.log(`${String(plan.name).padEnd(10)} $${plan.priceUSD} -> (none)    GH₵ ${plan.priceGHS} unchanged`)
    if (!CONFIRM) continue

    const patch = { priceUSD: null, market: plan.market, isPopular: plan.isPopular }
    const wrote = await fetch(`${BASE}/api/pricingPlans/${plan.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch),
    })
    if (!wrote.ok) {
        console.error(`  HTTP ${wrote.status}`)
        failed++
        continue
    }

    /* Read it back rather than trusting the response. A field the running CMS
       does not declare is dropped from a write with no error at all, which is
       how six plans were silently left on the wrong market on 29 August. */
    const after = await (await fetch(`${BASE}/api/pricingPlans/${plan.id}?depth=0`, { headers })).json()
    const moved = Object.keys({ ...plan, ...after }).filter(
        (k) => !['priceUSD', 'updatedAt'].includes(k) && JSON.stringify(plan[k]) !== JSON.stringify(after[k]),
    )
    if (after.priceUSD != null) {
        console.error(`  still $${after.priceUSD} after the write`)
        failed++
        continue
    }
    if (moved.length) {
        console.error(`  something else changed: ${moved.join(', ')}. Restore from ${backup}.`)
        failed++
        continue
    }
    console.log('  cleared, and nothing else moved')
}

if (!CONFIRM) {
    console.log('\nDry run. Nothing was written. Add --confirm to write.')
    process.exit(0)
}
if (failed) {
    console.error(`\n${failed} plan(s) did not come out right. The backup is ${backup}.`)
    process.exit(1)
}
console.log(`\n${targets.length} plan(s) cleared. The cedi prices and the badge are untouched.`)
