#!/usr/bin/env node
/*
  The AI automation card, approved by Ernest on 24 October 2026, for the new
  home page prices section.

  Dry run by default: it prints the planned before and after for both markets
  and writes nothing. --apply writes.

  WHAT IT CHANGES

  1. The homepage bundle "WhatsApp assistant" becomes "AI automation" in both
     markets. The WhatsApp assistant is one example of it.
       - Main price, one automation: from $3,000 (unchanged) and GH₵3,500
         (was GH₵3,000).
       - Features: "Answers on WhatsApp, day or night", "Asks the questions you
         always ask", "Hands the customer to you with the details filled in".
       - Extra prices on the card (the new addOns field), each converted into
         the visitor's money like the main price:
           Automation system, up to 3 connected workflows: from $6,500 / GH₵7,500
           Monthly care: from $350 / GH₵600 a month
           Monthly care for a system: from $650 / GH₵900 a month
       - Card note (the new cardNote field): WhatsApp's own message fees are
         paid directly to Meta.
       - Description: "within a minute" was never true (the measured first
         reply is 64 seconds), so a description saying it becomes "A first
         reply in 64 seconds, day or night, then the enquiry is handed to you
         with the details filled in."

  2. Kept in step, so the home page, the AI automation page and the estimator
     quote the same Africa price and `npm run check:prices` stays clean (it
     measures the bundle against the AI automation page's WhatsApp assistant
     tier, and the estimator row against that tier):
       - the AI automation page's "WhatsApp assistant" tier: GH₵ 3,000 to
         GH₵ 3,500, and the same description fix;
       - the estimator row "AI Automation": GH₵ 3,000 to GH₵ 3,500.
     --bundles-only leaves these two alone and changes only step 1.

  3. The team price list (founder, 26 Oct 2026: yes, the packages move to the
     new prices): the cedi "WhatsApp assistant" package goes from GH₵3,000 to
     GH₵3,500; the dollar one is already $3,000. Their name stays: a WhatsApp
     assistant is one automation, and package names print into client
     documents. --bundles-only leaves these alone too.

  BEFORE --apply, IN THIS ORDER

  1. The CMS is deployed with cms/src/lib/pricingRules.ts allowing the rename
     (BUNDLE_RENAMES). Before that, the save hook refuses a new name on a
     homepage bundle and the first write fails, with nothing written.
  2. The migration adding pricingPlans.addOns and pricingPlans.cardNote has
     run on the live database. Payload drops fields its running config does
     not know and still answers 200, so this script checks the fields exist
     before writing and reads every document back afterwards.

  HOW IT WRITES

  Every update sends the whole document back with the changes laid over it.
  payload.update reapplies a field's defaultValue for anything the data does
  not name (cms/CLAUDE.md), and pricingPlans has fields with defaults (market,
  kind, custom, active, calculatorFrom). A service row is sent without `slug`,
  which would regenerate from the title. Everything it reads is saved to
  ai-automation-prices-2026-10-backup.json beside it first (gitignored, and
  only on --apply), and it stops at the first failed write.

  Run:
    node cms/scripts/ai-automation-prices-2026-10.mjs
    node cms/scripts/ai-automation-prices-2026-10.mjs --bundles-only
    node cms/scripts/ai-automation-prices-2026-10.mjs --apply
*/

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const APPLY = process.argv.includes('--apply')
const BUNDLES_ONLY = process.argv.includes('--bundles-only')

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
const BASE = (env.PUBLIC_PAYLOAD_URL || '').replace(/\/$/, '')
const KEY = env.PAYLOAD_API_KEY
/* The three collections it reads are public, so a dry run needs only the
   address; writing needs the key. */
if (!BASE || (APPLY && !KEY)) {
    console.error(`Need PUBLIC_PAYLOAD_URL${APPLY ? ' and PAYLOAD_API_KEY' : ''} in the repo root .env.`)
    process.exit(2)
}
const headers = { 'Content-Type': 'application/json', ...(KEY ? { Authorization: `users API-Key ${KEY}` } : {}) }

async function api(method, path, body) {
    const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    const text = await res.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch { json = { raw: text.slice(0, 300) } }
    if (!res.ok) {
        const why = json?.errors?.map((e) => e.message + (e.data?.errors ? ` ${JSON.stringify(e.data.errors)}` : '')).join('; ') || json?.message || text.slice(0, 300)
        throw new Error(`${method} ${path}: HTTP ${res.status} ${why}`)
    }
    return json
}

const fail = (msg, code = 1) => {
    console.error(`STOPPED: ${msg}`)
    process.exit(code)
}

/* ------------------------------------------------------------- the target */

const AFRICA = 'ghana' // stored value of the cedi list, see CMS_AFRICA_MARKET in src/lib/markets.js
const INTL = 'international'
const OLD_NAME = 'WhatsApp assistant'
const NEW_NAME = 'AI automation'
const NEW_DESCRIPTION = 'A first reply in 64 seconds, day or night, then the enquiry is handed to you with the details filled in.'
const FEATURES = ['Answers on WhatsApp, day or night', 'Asks the questions you always ask', 'Hands the customer to you with the details filled in']
const CARD_NOTE = "WhatsApp's own message fees are paid directly to Meta."
const TARGET = {
    [INTL]: { price: 3000, addOns: [6500, 350, 650] },
    [AFRICA]: { price: 3500, addOns: [7500, 600, 900] },
}
const ADD_ON_ROWS = [
    ['Automation system, up to 3 connected workflows', 'once'],
    ['Monthly care', 'monthly'],
    ['Monthly care for a system', 'monthly'],
]
const addOnsFor = (market) => ADD_ON_ROWS.map(([label, cadence], i) => ({ label, amount: TARGET[market].addOns[i], cadence }))

const fmt = (n) => Number(n).toLocaleString('en-US')
const label = (market) => (market === INTL ? 'international' : 'africa')
const money = (market, n) => (n === null || n === undefined ? '(none)' : market === INTL ? `$${fmt(n)}` : `GH₵${fmt(n)}`)
const fixDescription = (d) => (typeof d === 'string' && /within a minute/i.test(d) ? NEW_DESCRIPTION : d)

/*
  The price text in the style it already has, as cms/src/lib/pricingRules.ts
  writes it when the portal changes a price: a bare "5500" stays bare, "from "
  stays, and the symbol is the market's.
*/
function priceText(old, n, market) {
    if (old && /^\d+(\.\d+)?$/.test(old.trim())) return String(n)
    const from = old && /^from\b/i.test(old.trim()) ? 'from ' : ''
    return `${from}${market === INTL ? '$' : 'GH₵'}${fmt(n)}`
}
/* The service page tiers write cedis as "GH₵ 3,000", with a space. */
const tierPriceText = (old, n) => (/^GH₵\s/.test(String(old || '')) ? `GH₵ ${fmt(n)}` : `GH₵${fmt(n)}`)

/* -------------------------------------------------------------------- read */

console.log(APPLY ? 'APPLY: changes will be written.\n' : 'DRY RUN: nothing will be written. Add --apply to write.\n')
console.log(`CMS: ${BASE}${BUNDLES_ONLY ? '   (--bundles-only: the AI automation page and estimator are left alone)' : ''}\n`)

const [plansRes, servicesRes, calcRes] = await Promise.all([
    api('GET', '/api/pricingPlans?limit=200&depth=0&sort=order'),
    api('GET', '/api/services?limit=50&depth=0'),
    api('GET', '/api/calculatorServices?limit=50&depth=0'),
])
const plans = plansRes.docs || []
const services = servicesRes.docs || []
const calc = calcRes.docs || []
if (!plans.length) fail('the CMS returned no pricing plans. Nothing done.', 2)

const bundles = plans.filter((p) => p.kind !== 'package')

/* ------------------------------------------------------------- the changes */

const changes = [] // { what, method, path, body, verify }
const STRIP = ['id', 'createdAt', 'updatedAt']
const whole = (docIn, over, extraStrip = []) => {
    const out = { ...docIn }
    for (const k of [...STRIP, ...extraStrip]) delete out[k]
    return { ...out, ...over }
}
const row = (field, before, after) => {
    const same = JSON.stringify(before) === JSON.stringify(after)
    const show = (v) => (Array.isArray(v) ? (v.length ? `\n${v.map((x) => `        - ${x}`).join('\n')}` : ' (none)') : ` ${v === null || v === undefined || v === '' ? '(none)' : JSON.stringify(v)}`)
    return same ? `    ${field}: unchanged,${show(after)}` : `    ${field}:\n      before:${show(before)}\n      after: ${show(after)}`
}

let fieldsReady = true

/* 1. The homepage bundles, both markets */
for (const market of [INTL, AFRICA]) {
    const renamed = bundles.filter((p) => p.name === NEW_NAME && p.market === market)
    const old = bundles.filter((p) => p.name === OLD_NAME && p.market === market && p.active !== false)
    if (renamed.length > 1) fail(`there are ${renamed.length} ${label(market)} bundles called "${NEW_NAME}". Expected one.`)
    if (renamed.length && old.length) fail(`the ${label(market)} list has both a "${OLD_NAME}" and an "${NEW_NAME}" bundle. Switch one off first.`)
    if (old.length > 1) fail(`there are ${old.length} active ${label(market)} bundles called "${OLD_NAME}". Expected one.`)
    const doc = renamed[0] || old[0]
    if (!doc) fail(`no ${label(market)} bundle called "${OLD_NAME}" or "${NEW_NAME}".`)

    // An array field comes back as [] once the running config has it, so its absence means not deployed.
    if (!Array.isArray(doc.addOns)) fieldsReady = false

    const field = market === INTL ? 'priceUSD' : 'priceGHS'
    const target = TARGET[market]
    const over = {
        name: NEW_NAME,
        [field]: target.price,
        price: Number(doc[field]) === target.price ? doc.price : priceText(doc.price, target.price, market),
        description: fixDescription(doc.description),
        features: FEATURES.map((feature) => ({ feature })),
        addOns: addOnsFor(market),
        cardNote: CARD_NOTE,
    }
    // A label quoting the old figure quotes the new one (the international one says "from $3,000").
    if (doc.priceLabel && Number(doc[field]) !== target.price) over.priceLabel = String(doc.priceLabel).split(money(market, doc[field])).join(money(market, target.price))

    const featuresBefore = (doc.features || []).map((f) => f.feature)
    const addOnsBefore = (doc.addOns || []).map((a) => `${a.label}: from ${money(market, a.amount)}${a.cadence === 'monthly' ? ' a month' : ''}`)
    const addOnsAfter = over.addOns.map((a) => `${a.label}: from ${money(market, a.amount)}${a.cadence === 'monthly' ? ' a month' : ''}`)
    const lines = [
        row('name', doc.name, over.name),
        row(field, doc[field], over[field]),
        row('price text', doc.price, over.price),
        ...(over.priceLabel !== undefined ? [row('price label', doc.priceLabel, over.priceLabel)] : []),
        row('description', doc.description, over.description),
        row('features', featuresBefore, FEATURES),
        row('extra prices (addOns)', addOnsBefore, addOnsAfter),
        row('card note (cardNote)', doc.cardNote ?? null, over.cardNote),
    ]
    const nothing = doc.name === NEW_NAME && Number(doc[field]) === target.price && doc.description === over.description
        && JSON.stringify(featuresBefore) === JSON.stringify(FEATURES) && JSON.stringify(addOnsBefore) === JSON.stringify(addOnsAfter) && doc.cardNote === CARD_NOTE
    console.log(`${label(market).toUpperCase()} bundle #${doc.id} (${market === INTL ? 'everyone outside Africa, from dollars' : 'Africa, from cedis'})${nothing ? ': already done' : ''}`)
    console.log(lines.join('\n') + '\n')
    if (!nothing) {
        changes.push({
            what: `${label(market)} bundle #${doc.id}: "${doc.name}" to "${NEW_NAME}", ${Number(doc[field]) === target.price ? `price stays ${money(market, target.price)}` : `${money(market, doc[field])} to ${money(market, target.price)}`}, features, extra prices, card note`,
            method: 'PATCH',
            path: `/api/pricingPlans/${doc.id}`,
            body: whole(doc, over),
            verify: (after) => {
                const bad = []
                if (after.name !== NEW_NAME) bad.push('name')
                if (Number(after[field]) !== target.price) bad.push(field)
                if (JSON.stringify((after.features || []).map((f) => f.feature)) !== JSON.stringify(FEATURES)) bad.push('features')
                if (JSON.stringify((after.addOns || []).map((a) => [a.label, Number(a.amount), a.cadence])) !== JSON.stringify(over.addOns.map((a) => [a.label, a.amount, a.cadence]))) bad.push('addOns')
                if (after.cardNote !== CARD_NOTE) bad.push('cardNote')
                return bad
            },
        })
    }
}

/* 2. Kept in step: the AI automation page tier and the estimator row */
if (!BUNDLES_ONLY) {
    const svc = services.find((s) => s.slug === 'ai-automation')
    if (!svc) fail('no service with slug ai-automation.')
    const ps = (typeof svc.pricingSection === 'string' ? JSON.parse(svc.pricingSection) : svc.pricingSection) || {}
    const tiers = ps.plans || []
    const tier = tiers.find((t) => t.name === OLD_NAME)
    if (!tier) fail(`the AI automation page has no "${OLD_NAME}" tier. scripts/pricing-audit.mjs measures the bundle against it; fix that mapping first.`)
    const nextTier = { ...tier, price: tierPriceText(tier.price, TARGET[AFRICA].price), description: fixDescription(tier.description) }
    const tierSame = nextTier.price === tier.price && nextTier.description === tier.description
    console.log(`AI AUTOMATION PAGE, tier "${tier.name}" (services #${svc.id})${tierSame ? ': already done' : ''}`)
    console.log([row('price (Africa)', tier.price, nextTier.price), row('price (everyone else)', tier.priceUsd, tier.priceUsd), row('description', tier.description, nextTier.description)].join('\n') + '\n')
    if (!tierSame) {
        changes.push({
            what: `AI automation page: "${tier.name}" tier ${tier.price} to ${nextTier.price}${nextTier.description !== tier.description ? ', description' : ''}`,
            method: 'PATCH',
            path: `/api/services/${svc.id}`,
            body: whole(svc, { pricingSection: { ...ps, plans: tiers.map((t) => (t === tier ? nextTier : t)) } }, ['slug']),
            verify: (after) => {
                const t = ((typeof after.pricingSection === 'string' ? JSON.parse(after.pricingSection) : after.pricingSection)?.plans || []).find((x) => x.name === OLD_NAME)
                return t && t.price === nextTier.price && t.description === nextTier.description ? [] : ['pricingSection.plans']
            },
        })
    }

    const est = calc.find((c) => /Matches WhatsApp assistant on the AI automation page/i.test(String(c.description || '')))
    if (!est) {
        console.log('ESTIMATOR: no row names the WhatsApp assistant tier; nothing to keep in step.\n')
    } else {
        const same = Number(est.priceGHS) === TARGET[AFRICA].price
        console.log(`ESTIMATOR row "${est.name}" (calculatorServices #${est.id})${same ? ': already done' : ''}`)
        console.log([row('priceGHS', est.priceGHS, TARGET[AFRICA].price), row('priceUSD', est.priceUSD, est.priceUSD)].join('\n') + '\n')
        if (!same) {
            changes.push({
                what: `estimator row "${est.name}": ${money(AFRICA, est.priceGHS)} to ${money(AFRICA, TARGET[AFRICA].price)}`,
                method: 'PATCH',
                path: `/api/calculatorServices/${est.id}`,
                body: whole(est, { priceGHS: TARGET[AFRICA].price }),
                verify: (after) => (Number(after.priceGHS) === TARGET[AFRICA].price ? [] : ['priceGHS']),
            })
        }
    }
}

/* 3. The team price list packages: the price moves, the name stays. */
const PACKAGE_PRICE = { [AFRICA]: 'GH₵3,500', [INTL]: '$3,000' }
const packages = plans.filter((p) => p.kind === 'package' && p.name === OLD_NAME)
if (!BUNDLES_ONLY) {
    for (const p of packages) {
        const to = PACKAGE_PRICE[p.market]
        if (!to || p.price === to) {
            console.log(`Package #${p.id} (${label(p.market)}) "${p.name}" is already ${p.price}: left as it is.`)
            continue
        }
        changes.push({
            what: `team price list package #${p.id} (${label(p.market)}) "${p.name}": ${p.price} to ${to}`,
            method: 'PATCH',
            path: `/api/pricingPlans/${p.id}`,
            body: whole(p, { price: to }),
            verify: (after) => (after.price === to && after.name === p.name && after.kind === 'package' ? [] : ['price']),
        })
    }
    if (!packages.length) console.log(`No "${OLD_NAME}" packages on the team price list: nothing to move there.`)
}

/* ------------------------------------------------------------------ report */

console.log(`${changes.length} change(s):`)
for (const [i, c] of changes.entries()) console.log(`  ${i + 1}. ${c.what}`)
console.log('')
if (!fieldsReady) {
    console.log('The live CMS does not have the addOns and cardNote fields yet. Deploy the CMS with the')
    console.log('migration that adds them before --apply; until then Payload would drop them and answer 200.\n')
}

if (!APPLY) {
    console.log('Dry run. Nothing written. Run with --apply to write these.')
    process.exit(0)
}
if (!changes.length) {
    console.log('Nothing to do.')
    process.exit(0)
}
if (!fieldsReady) fail('the addOns and cardNote fields are not live. Nothing written.', 2)

const backupFile = join(HERE, 'ai-automation-prices-2026-10-backup.json')
writeFileSync(backupFile, JSON.stringify({ takenAt: new Date().toISOString(), plans, services: services.filter((s) => s.slug === 'ai-automation'), calc }, null, 2))
console.log(`Backup of everything read: ${backupFile}\n`)

for (const [i, c] of changes.entries()) {
    try {
        const res = await api(c.method, c.path, c.body)
        const after = res?.doc ?? res
        const dropped = c.verify(after)
        if (dropped.length) throw new Error(`answered ${res ? 'OK' : 'nothing'} but did not keep ${dropped.join(', ')}. Is the CMS deploy and migration live?`)
        console.log(`  done ${i + 1}/${changes.length}  ${c.what}`)
    } catch (err) {
        console.error(`\nFAILED at ${i + 1}/${changes.length}: ${c.what}\n  ${err.message}`)
        console.error(`\n${i} change(s) before it were written. The backup is ${backupFile}.`)
        process.exit(1)
    }
}
console.log(`\nAll ${changes.length} changes written. Allow a minute for the site's cache, then run npm run check:prices and npm run check:markets.`)
