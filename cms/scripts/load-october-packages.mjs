#!/usr/bin/env node
/*
  Loads the October 2026 service packages into the price list (pricingPlans),
  from the build spec's Appendix A. Approved by Ernest on 4 October 2026
  ("Yes, add them"). Dry run by default.

  WHAT IT ADDS

  21 packages, each twice: once on the cedi list (market 'ghana', priceGHS),
  once on the dollar list (market 'international', priceUSD). A package marked
  Custom carries no price and has `custom` ticked. Each is `kind: 'package'`,
  tied to its service, in use, and ordered after the six bundles. The packages
  Appendix A names as the calculator's "from" price have `calculatorFrom`
  ticked; nothing reads that flag yet.

  WHY THE SITE DOES NOT CHANGE

  The homepage grid and /global used to draw every plan. Commit 7cf61a23 made
  both draw bundles only, and it was live before this ran. The packages are for
  the team portal's price list and Quotes to price.

  WHAT IT DOES NOT TOUCH

  The six bundles. A package already on the list (same name, market and
  service) is skipped, so running it twice adds nothing.

  Every plan is read and written to a backup beside this file first. Each new
  plan is read back and compared field by field.

  Run:
    node cms/scripts/load-october-packages.mjs
    node cms/scripts/load-october-packages.mjs --confirm
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

/* The service records on the live CMS, by the slug that does not change. */
const SERVICE_SLUGS = {
    web: 'web-design-development',
    marketing: 'digital-marketing-social-media',
    branding: 'branding-graphic-design',
    video: 'video-production',
    seo: 'seo-paid-ads',
    automation: 'ai-automation',
    fieldwork: 'fieldwork',
}

/* Appendix A, October 2026. ghs and usd are whole units; null with custom. */
const MONTHLY = '/mo'
const PACKAGES = [
    { s: 'web', name: 'Landing Page', billing: '', ghs: 2500, usd: 3000, from: true },
    { s: 'web', name: 'Corporate Site (up to 5 pages)', billing: '', ghs: 5000, usd: 7500 },
    { s: 'web', name: 'E-Commerce', billing: '', custom: true },
    { s: 'marketing', name: 'Buyer profiles', billing: '', ghs: 2500, usd: 3000 },
    { s: 'marketing', name: 'Calendar and page management', billing: MONTHLY, ghs: 1800, usd: 1500, from: true },
    { s: 'marketing', name: 'Ads on top (ad budget extra)', billing: MONTHLY, custom: true },
    { s: 'branding', name: 'Logo Design', billing: '', ghs: 2000, usd: 3000, from: true },
    { s: 'branding', name: 'Brand Kit', billing: '', ghs: 3500, usd: 5000 },
    { s: 'branding', name: 'Full Visual Identity', billing: '', custom: true },
    { s: 'video', name: 'Reel Pack (3 reels)', billing: '', ghs: 1500, usd: 1250 },
    { s: 'video', name: 'Starter', billing: MONTHLY, ghs: 1800, usd: 1500, from: true },
    { s: 'video', name: 'Growth', billing: MONTHLY, ghs: 3500, usd: 2500 },
    { s: 'video', name: 'Scale', billing: MONTHLY, ghs: 8000, usd: 6000 },
    { s: 'seo', name: 'Local SEO', billing: MONTHLY, ghs: 1500, usd: 1500, from: true },
    { s: 'seo', name: 'Growth SEO', billing: MONTHLY, ghs: 3500, usd: 3000 },
    { s: 'seo', name: 'Enterprise', billing: MONTHLY, custom: true },
    { s: 'automation', name: 'The build', billing: '', ghs: 3000, usd: 3000, from: true },
    { s: 'automation', name: 'Beyond the standard build', billing: '', custom: true },
    { s: 'fieldwork', name: 'Setting it up', billing: '', ghs: 3000, usd: 2500, from: true },
    { s: 'fieldwork', name: 'Leads only', billing: MONTHLY, ghs: 900, usd: 1200 },
    { s: 'fieldwork', name: 'Done for you', billing: MONTHLY, ghs: 4000, usd: 3000 },
]

const get = async (path) => {
    const res = await fetch(`${BASE}/api/${path}`, { headers })
    if (!res.ok) throw new Error(`GET ${path}: HTTP ${res.status}`)
    return res.json()
}

const services = (await get('services?limit=100&depth=0')).docs || []
const serviceId = {}
for (const [k, slug] of Object.entries(SERVICE_SLUGS)) {
    const s = services.find((x) => x.slug === slug)
    if (!s) {
        console.error(`No service with the slug ${slug}. Nothing done.`)
        process.exit(2)
    }
    serviceId[k] = s.id
}

const plans = (await get('pricingPlans?limit=500&depth=0&sort=order')).docs || []
const backup = join(HERE, 'october-packages-backup.json')
writeFileSync(backup, JSON.stringify(plans, null, 2))
console.log(`Backup of all ${plans.length} plans: ${backup}\n`)

const money = (n, cur) => (cur === 'GHS' ? `GH₵${n.toLocaleString('en-GB')}` : `$${n.toLocaleString('en-GB')}`)

const rows = []
let order = 100
for (const p of PACKAGES) {
    for (const market of ['ghana', 'international']) {
        order += 1
        const amount = market === 'ghana' ? p.ghs : p.usd
        rows.push({
            name: p.name,
            market,
            kind: 'package',
            service: serviceId[p.s],
            custom: Boolean(p.custom),
            active: true,
            calculatorFrom: Boolean(p.from),
            price: p.custom ? 'Custom' : `${money(amount, market === 'ghana' ? 'GHS' : 'USD')}${p.billing ? ' a month' : ''}`,
            priceGHS: market === 'ghana' && !p.custom ? p.ghs : null,
            priceUSD: market === 'international' && !p.custom ? p.usd : null,
            billingCycle: p.billing,
            isPopular: false,
            order,
        })
    }
}

const exists = (r) => plans.some((x) => x.name === r.name && x.market === r.market && String(x.service ?? '') === String(r.service) && x.kind === 'package')
const todo = rows.filter((r) => !exists(r))
console.log(`${rows.length} package rows in Appendix A; ${rows.length - todo.length} already on the list; ${todo.length} to add.\n`)
for (const r of todo) console.log(`${r.market.padEnd(13)} ${String(r.name).padEnd(34)} ${r.price}${r.calculatorFrom ? '   (calculator "from")' : ''}`)

if (!CONFIRM) {
    console.log('\nDry run. Nothing was written. Add --confirm to write.')
    process.exit(0)
}

let failed = 0
for (const r of todo) {
    const res = await fetch(`${BASE}/api/pricingPlans`, { method: 'POST', headers, body: JSON.stringify(r) })
    if (!res.ok) {
        console.error(`${r.name} (${r.market}): HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
        failed++
        continue
    }
    const { doc } = await res.json()
    /* Read it back rather than trusting the response: a field the running CMS
       does not declare is dropped with no error at all. */
    const after = await get(`pricingPlans/${doc.id}?depth=0`)
    const wrong = Object.keys(r).filter((k) => JSON.stringify(r[k] ?? null) !== JSON.stringify(after[k] ?? null) && !(k === 'billingCycle' && !r[k] && !after[k]))
    if (wrong.length) {
        console.error(`${r.name} (${r.market}): came back different in ${wrong.join(', ')}`)
        failed++
    }
}

const final = (await get('pricingPlans?limit=500&depth=0')).docs || []
const bundles = final.filter((x) => x.kind !== 'package')
console.log(`\nNow ${final.length} plans: ${bundles.length} bundles (were ${plans.filter((x) => x.kind !== 'package').length}) and ${final.length - bundles.length} packages.`)
if (failed) {
    console.error(`${failed} row(s) did not come out right. The backup is ${backup}.`)
    process.exit(1)
}
console.log('All added and read back. The bundles are untouched.')
