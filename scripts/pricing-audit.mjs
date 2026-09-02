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
