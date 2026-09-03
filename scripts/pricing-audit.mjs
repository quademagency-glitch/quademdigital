#!/usr/bin/env node
/*
  Every price on the site, read from the five places they actually live, and
  printed side by side.

  WHY THIS EXISTS

  On 2 September 2026 Ernest noticed that the Fieldwork page and the homepage
  cards disagreed. They did, and so did four other things nobody had compared,
  because the prices are spread across five sources that no single page reads
  together:

      pricingPlans           the cards on the homepage and /global
      calculatorServices     the estimator under those cards
      webDesignPage          }
      seoPage                } four CMS globals, one per hand-built page
      brandIdentityPage      }
      videoProductionPage    }
      fieldwork.astro        typed into the page file, not in the CMS at all

  That last one is the trap. A script that reads the CMS sees six of the seven
  services and reports everything as consistent. The floor Ernest set was applied
  by exactly such a script, which is how Fieldwork ended up under it.

      services collection    tiers for anything rendered by [slug].astro, added
                             2 September 2026 so AI Automation and Digital
                             Marketing could hold a price at all. Until then
                             they showed none.

  Six sources now, and the sixth is read rather than assumed: a service is only
  reported as unpriced if it genuinely has no tiers, never because a hardcoded
  list of slugs went stale.

  WHAT IT DOES NOT DO

  It changes nothing and it recommends nothing. Prices are Ernest's call. This
  prints what is true so a decision can be made against real numbers.

  Run:
    node scripts/pricing-audit.mjs
    node scripts/pricing-audit.mjs --markdown     tables for docs/
*/

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MD = process.argv.includes('--markdown')

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
    // 2, not 1. Exit 1 means a real inconsistency was found. Exit 2 means the
    // audit could not run, which is not the same as a clean bill of health.
    process.exit(2)
}

const headers = { Authorization: `users API-Key ${KEY}` }
const get = async (path) => {
    const res = await fetch(`${BASE}${path}`, { headers })
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
    return res.json()
}

// "from $1,500 a month" -> 1500. Custom and blank come back null on purpose, so
// a Custom tier is never mistaken for a zero.
const num = (v) => {
    if (v === null || v === undefined) return null
    const m = String(v).match(/([0-9][0-9,]*)/)
    return m ? Number(m[1].replace(/,/g, '')) : null
}

const rows = []

/* The four hand-built service pages. Their tier array is `plans`; reading
   `tiers` first and writing back to it is how the floor script silently wrote
   nothing on its first run, so the key is taken once and reused. */
const GLOBALS = [
    ['webDesignPage', 'Web design'],
    ['seoPage', 'SEO'],
    ['brandIdentityPage', 'Brand identity'],
    ['videoProductionPage', 'Video'],
]
for (const [slug, label] of GLOBALS) {
    const section = (await get(`/api/globals/${slug}?depth=0`)).pricingSection || {}
    const tiers = section.plans || section.tiers || []
    for (const t of tiers) {
        rows.push({
            service: label,
            tier: t.name,
            usd: num(t.priceUsd),
            ghs: num(t.price),
            usdRaw: t.priceUsd,
            ghsRaw: t.price,
            period: t.period || '',
            source: `globals/${slug}`,
        })
    }
}

/* Fieldwork. Parsed out of the page file because that is where it lives. If
   this stops matching, it is because someone moved the prices, and a loud
   failure is correct: silently reporting six of seven services as consistent is
   the exact bug this script exists to catch. */
const fwPath = join(ROOT, 'src', 'pages', 'services', 'fieldwork.astro')
const fwSrc = readFileSync(fwPath, 'utf8')
const fwBlock = fwSrc.slice(fwSrc.indexOf('const tiers = ['), fwSrc.indexOf('const notList'))
const fwRe = /name:\s*"([^"]+)",\s*\n\s*price:\s*"([^"]+)",\s*\n\s*priceGhs:\s*"([^"]+)",[\s\S]*?cadence:\s*"([^"]+)"/g
let fwFound = 0
for (const m of fwBlock.matchAll(fwRe)) {
    fwFound++
    rows.push({
        service: 'Fieldwork',
        tier: m[1],
        usd: num(m[2]),
        ghs: num(m[3]),
        usdRaw: m[2],
        ghsRaw: m[3],
        period: m[4],
        source: 'fieldwork.astro',
    })
}
if (fwFound === 0) {
    console.error('Could not read any tier out of src/pages/services/fieldwork.astro.')
    console.error('The prices moved or the shape changed. Fix this parser rather than')
    console.error('letting the audit quietly report on six services out of seven.')
    process.exit(2)
}

/* Services that keep their tiers in the collection rather than in a global.
   Read rather than assumed from a hardcoded list of slugs: a list would have to
   be edited every time a service is priced, and would go on reporting a priced
   service as unpriced until somebody noticed. */
const services = (await get('/api/services?limit=50&depth=0')).docs || []
const GLOBAL_BACKED = new Set(['web-design-development', 'seo-paid-ads', 'branding-graphic-design', 'video-production', 'fieldwork'])
for (const svc of services) {
    if (GLOBAL_BACKED.has(svc.slug)) continue
    for (const t of svc.pricingSection?.plans || []) {
        rows.push({
            service: svc.title,
            tier: t.name,
            usd: num(t.priceUsd),
            ghs: num(t.price),
            usdRaw: t.priceUsd,
            ghsRaw: t.price,
            period: t.period || '',
            source: `services/${svc.slug}`,
        })
    }
}

/* Anything still carrying no price at all. This is the finding most likely to
   be missed, because nothing looks wrong on the page. */
const unpriced = services.filter((s) => !GLOBAL_BACKED.has(s.slug) && !(s.pricingSection?.plans || []).length)

const plans = (await get('/api/pricingPlans?limit=50&depth=0&sort=order')).docs || []

/*
  The Ghana bundles against the services they are made of.

  Each bundle on the homepage was narrowed on 2 September 2026 so that what it
  claims matches what its price buys. Before that, Starter advertised a five page
  website plus branding for GH₵ 2,500 while the web design page sold a landing
  page alone for the same money, so the homepage undercut every service page.

  This recomputes the gap from live prices. A bundle only holds together while
  the services inside it cost what they cost today, and the failure mode is
  silent: change a service price and the homepage goes back to contradicting
  itself with nobody told. Exit 1 if one drifts.

  Premium was skipped here until 3 September 2026, on the reasoning that part of
  what it includes was not sold as a tier anywhere so there was no honest parts
  total. That reasoning was wrong, and skipping it is what let it sit 64% above
  its parts for as long as it did. It is Video Scale plus Growth SEO, which is
  GH₵ 11,500 to the cedi, and it is checked like the other two now.

  TWO WAYS A BUNDLE GOES WRONG, AND THIS ONLY USED TO CATCH ONE

  maxDiscount catches a bundle that undercuts the service pages, which is what
  Starter and Growth were doing. It cannot catch the opposite, and the opposite
  is exactly what Premium was doing: costing GH₵ 4,500 a month MORE than buying
  the same things one at a time, which gives anyone who checks a reason not to
  buy the bundle at all. maxMarkup catches that.

  A bundle should never cost more than its parts. The small tolerance is for
  rounding to a tidy number, not for a margin.

  THE INTERNATIONAL ROW WAS NOT CHECKED AT ALL UNTIL 3 SEPTEMBER 2026

  Everything above was written about the three Ghana cards, and the three
  international cards were left out for no reason other than that the Ghana ones
  were what had been asked about. They turned out to be worse.

  The Video retainer card sells "eight to twelve short videos a month" for
  $1,500. The video production page sells four videos for $1,500, and asks
  $6,000 for ten. So the homepage undercuts its own service page by 75%, and the
  "What this covers" link added on 2 September now walks the buyer straight from
  one number to the other.

  This is the same failure as Starter on the Ghana side, on the row that /global
  shows and that the cold email campaign points at.

  RESOLVED THE SAME DAY, AND THE MAPPING BELOW FOLLOWS THE RESOLUTION

  Ernest's call: fix the claim, move one price. Video retainer keeps $1,500 and
  now says four videos, which is the Starter plan it was always priced as.
  Growth retainer went $2,500 to $3,750, a 32% discount on Video Growth plus
  Growth SEO. Website build keeps $3,000 and now describes the Landing Page
  rather than the Corporate Site.

  So the parts below are Starter and Growth, not Scale. If a card's promise
  changes again, change the mapping here in the same commit or this check
  quietly starts measuring the wrong thing.
*/
const BUNDLE_PARTS = {
    Starter: { market: 'ghana', cur: 'ghs', parts: [['Landing Page', 'webDesignPage']], maxDiscount: 10, maxMarkup: 5 },
    Growth: { market: 'ghana', cur: 'ghs', parts: [['Corporate Site', 'webDesignPage'], ['Logo Design', 'brandIdentityPage']], maxDiscount: 35, maxMarkup: 5 },
    Premium: { market: 'ghana', cur: 'ghs', parts: [['Scale', 'videoProductionPage'], ['Growth SEO', 'seoPage']], maxDiscount: 10, maxMarkup: 5 },

    'Website build': { market: 'international', cur: 'usd', parts: [['Landing Page', 'webDesignPage']], maxDiscount: 10, maxMarkup: 5 },
    'Video retainer': { market: 'international', cur: 'usd', parts: [['Starter', 'videoProductionPage']], maxDiscount: 10, maxMarkup: 5 },
    'Growth retainer': { market: 'international', cur: 'usd', parts: [['Growth', 'videoProductionPage'], ['Growth SEO', 'seoPage']], maxDiscount: 35, maxMarkup: 5 },
}
const tierPrice = (name, globalSlug, cur) => {
    const r = rows.find((x) => x.tier === name && x.source === `globals/${globalSlug}`)
    return r ? r[cur] : null
}
const bundleChecks = []
for (const [bundleName, spec] of Object.entries(BUNDLE_PARTS)) {
    const plan = plans.find((p) => p.name === bundleName && p.market === spec.market)
    if (!plan) { bundleChecks.push({ bundleName, problem: `no such ${spec.market} card` }); continue }
    const price = spec.cur === 'usd' ? num(plan.priceUSD) : num(plan.priceGHS || plan.price)
    const priced = spec.parts.map(([t, g]) => [t, tierPrice(t, g, spec.cur)])
    if (priced.some(([, v]) => !v)) {
        bundleChecks.push({ bundleName, problem: `a tier it is made of is gone: ${priced.filter(([, v]) => !v).map(([t]) => t).join(', ')}` })
        continue
    }
    const total = priced.reduce((a, [, v]) => a + v, 0)
    const discount = ((total - price) / total) * 100
    bundleChecks.push({
        bundleName, price, total, discount,
        cur: spec.cur,
        sym: spec.cur === 'usd' ? '$' : 'GH₵ ',
        parts: priced.map(([t, v]) => `${t} ${spec.cur === 'usd' ? '$' : 'GH₵ '}${v.toLocaleString()}`).join(' + '),
        problem:
            discount > spec.maxDiscount
                ? `claims ${discount.toFixed(0)}% off, over the ${spec.maxDiscount}% a bundle should be`
                : -discount > spec.maxMarkup
                  ? `costs ${(-discount).toFixed(0)}% MORE than buying its parts one at a time, so there is no reason to buy the bundle`
                  : null,
    })
}
const calc = (await get('/api/calculatorServices?limit=50&depth=0')).docs || []

// ---------------------------------------------------------------------------

const withBoth = rows.filter((r) => r.usd && r.ghs).sort((a, b) => a.ghs / a.usd - b.ghs / b.usd)

if (MD) {
    console.log('| Service | Tier | USD | GH₵ | Period |')
    console.log('| --- | --- | --- | --- | --- |')
    for (const r of rows) console.log(`| ${r.service} | ${r.tier} | ${r.usdRaw} | ${r.ghsRaw} | ${r.period} |`)
    console.log('')
    console.log('| Service | Tier | USD | GH₵ | GH₵ per $1 |')
    console.log('| --- | --- | --- | --- | --- |')
    for (const r of withBoth) console.log(`| ${r.service} | ${r.tier} | ${r.usd.toLocaleString()} | ${r.ghs.toLocaleString()} | ${(r.ghs / r.usd).toFixed(2)} |`)
} else {
    console.log('THE CARDS ON THE HOMEPAGE AND /global')
    for (const p of plans) console.log(`  [${String(p.market).padEnd(13)}] ${String(p.name).padEnd(18)} ${p.price}`)

    console.log('\nTHE SERVICE PAGES')
    console.log(`  ${'Service'.padEnd(15)} ${'Tier'.padEnd(22)} ${'USD'.padStart(8)} ${'GH₵'.padStart(8)}   ${'per $1'.padStart(6)}  source`)
    console.log('  ' + '-'.repeat(84))
    for (const r of withBoth) {
        console.log(`  ${r.service.padEnd(15)} ${String(r.tier).padEnd(22)} ${r.usd.toLocaleString().padStart(8)} ${r.ghs.toLocaleString().padStart(8)}   ${(r.ghs / r.usd).toFixed(2).padStart(6)}  ${r.source}`)
    }
    const customs = rows.filter((r) => !r.usd || !r.ghs)
    for (const r of customs) console.log(`  ${r.service.padEnd(15)} ${String(r.tier).padEnd(22)} ${String(r.usdRaw).padStart(8)} ${String(r.ghsRaw).padStart(8)}       .  ${r.source}`)

    console.log('\nTHE ESTIMATOR ON THE HOMEPAGE')
    for (const c of calc) console.log(`  ${String(c.name).padEnd(28)} $${c.priceUSD}   GH₵ ${c.priceGHS}`)

    console.log('\nEVERY HOMEPAGE CARD AGAINST WHAT IT IS MADE OF')
    for (const b of bundleChecks) {
        if (b.problem && !b.total) { console.log(`  ${b.bundleName}: ${b.problem}`); continue }
        const verdict = b.problem ? `  <-- ${b.problem}` : ''
        const gap = b.discount >= 0 ? `${b.discount.toFixed(0)}% off` : `${(-b.discount).toFixed(0)}% MORE`
        console.log(`  ${b.bundleName.padEnd(16)} ${b.sym}${String(b.price.toLocaleString()).padStart(7)}   parts ${b.parts} = ${b.sym}${b.total.toLocaleString()}   ${gap}${verdict}`)
    }

    console.log('\nSERVICES WITH NO PRICE ANYWHERE')
    if (unpriced.length === 0) console.log('  none')
    for (const s of unpriced) console.log(`  ${s.slug}  (${s.title})`)

    if (withBoth.length > 1) {
        const lo = withBoth[0]
        const hi = withBoth[withBoth.length - 1]
        const spread = (hi.ghs / hi.usd) / (lo.ghs / lo.usd)
        console.log('\nHOW FAR THE TWO LADDERS DIVERGE')
        console.log(`  ${(lo.ghs / lo.usd).toFixed(2)} on ${lo.service} ${lo.tier}, up to ${(hi.ghs / hi.usd).toFixed(2)} on ${hi.service} ${hi.tier}.`)
        console.log(`  A ${spread.toFixed(1)} fold spread. Flat would mean the two ladders agree on which`)
        console.log('  service is dearer. They do not, and that is what a buyer notices.')
    }
    console.log('\nNothing was changed. See docs/pricing-audit-2026-09-02.md for the reading.')
}

/* Exit 1 on a real finding, so this can be run as a check rather than only read.
   Exit 2 earlier means the audit could not run, which is not the same thing. */
const drifted = bundleChecks.filter((b) => b.problem)
if (drifted.length) {
    console.error('')
    console.error(`${drifted.length} bundle claim(s) no longer match the services they are made of:`)
    for (const b of drifted) console.error(`  ${b.bundleName}: ${b.problem}`)
    console.error('')
    console.error('Either the bundle price moved or a service price under it did. The homepage')
    console.error('is undercutting its own service pages again. Fix one or the other.')
    process.exit(1)
}
