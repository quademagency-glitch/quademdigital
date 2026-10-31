#!/usr/bin/env node
/*
  Puts the newest work first and brings the facts up to date.

  Asked for by Ernest on 31 October 2026 ("new portfolio projects should always
  get prominence, because they are the latest work"; "omek is done not in
  progress, san is in progress"; PageSpeed screenshots for Tannor; "add tannor
  logo to companies we working with"):

    1. Tannor Freight goes first and Omek Google Ads second in the Order.
    2. Tannor's story gets the PageSpeed figures it promised, from Ernest's run
       on pagespeed.web.dev, 31 October 2026, 12:40 AM GMT, Lighthouse 13.6.0.
       97 becomes the number on its card.
    3. Omek Storefront stops saying it is in progress, on its case study and on
       the home page's work section. SAN Collection stays as it is.
    4. Tannor's logo is uploaded for the Client Logos list. Only an admin can
       change Site Settings (it also holds the bank details), so the website key
       is refused there: this prints the media id to add in the admin.

  Each wording is matched on its exact old text, so copy edited since this was
  written stops the script rather than being overwritten. A second run changes
  nothing.

  Run from the repo root (it reads .env there):
    node cms/scripts/latest-work-first.mjs --logo=<path to tannor-lockup-navy-orange.png>
    node cms/scripts/latest-work-first.mjs --logo=<path> --confirm
*/

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const CONFIRM = process.argv.includes('--confirm')
const LOGO_PATH = process.argv.find((a) => a.startsWith('--logo='))?.slice('--logo='.length)

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
const BASE = env.PUBLIC_PAYLOAD_URL?.replace(/\/$/, '')
const KEY = env.PAYLOAD_API_KEY
if (!BASE || !KEY) {
    console.error('Need PUBLIC_PAYLOAD_URL and PAYLOAD_API_KEY in the repo root .env.')
    process.exit(2)
}
if (new URL(BASE).hostname !== 'cms.quademdigital.com') {
    console.error(`Refusing to run against ${BASE}: this script is for the live CMS only.`)
    process.exit(2)
}
const auth = { Authorization: `users API-Key ${KEY}` }

const fail = (message) => {
    console.error(`\nStopped: ${message}`)
    process.exit(1)
}
const api = async (path, options = {}) => {
    const isForm = options.body instanceof FormData
    const res = await fetch(`${BASE}/api/${path}`, { ...options, headers: { ...auth, ...(isForm ? {} : { 'Content-Type': 'application/json' }) } })
    if (!res.ok) fail(`${options.method || 'GET'} ${path}: HTTP ${res.status}\n${(await res.text()).slice(0, 1500)}`)
    return res.json()
}
const canon = (value) =>
    JSON.stringify(value, (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v))

const study = async (slug) => (await api(`caseStudies?where[slug][equals]=${slug}&depth=0&limit=1`)).docs?.[0] || fail(`no case study "${slug}".`)

/* Rewrites one text node in a copy of a rich text tree, or says it is already done. */
const swapText = (tree, from, to, what) => {
    let hits = 0
    const walk = (node) => {
        if (Array.isArray(node)) return node.map(walk)
        if (!node || typeof node !== 'object') return node
        const out = Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v)]))
        if (node.text === from) {
            hits++
            out.text = to
        }
        return out
    }
    const next = walk(tree)
    if (hits === 1) return next
    if (hits === 0 && JSON.stringify(tree).includes(JSON.stringify(to))) return tree
    return fail(`${what}: expected this text once and found it ${hits} times, so it has changed since this was written:\n  ${from}`)
}
const swapField = (value, from, to, what) => {
    if (value === to) return value
    if (value === from) return to
    return fail(`${what} has changed since this was written:\n  ${value}`)
}

/* ------------------------------------------------------------------ read */

const [tannor, ads, omek, home, settings] = await Promise.all([
    study('tannor-freight'),
    study('omek-google-ads'),
    study('omek-storefront'),
    api('globals/homepage?depth=0'),
    api('globals/siteSettings?depth=0'),
])

const LOGO_NAME = 'tannor-freight-logo'
const findLogo = async () => {
    for (const filename of [`${LOGO_NAME}.webp`, `${LOGO_NAME}.png`]) {
        const found = await api(`media?where[filename][equals]=${encodeURIComponent(filename)}&depth=0&limit=1`)
        if (found.docs?.[0]) return found.docs[0]
    }
    return null
}
const existingLogo = await findLogo()
if (!existingLogo && (!LOGO_PATH || !existsSync(LOGO_PATH))) fail('pass --logo=<path to tannor-lockup-navy-orange.png>.')

/* ------------------------------------------------------------- the changes */

const tannorChanges = {
    order: -2,
    resultMetric: swapField(tannor.resultMetric, '10', '97', 'Tannor result number'),
    resultText: swapField(
        tannor.resultText,
        "Pages live at tannorfreight.com, with an admin Tannor's team runs themselves",
        "Google PageSpeed on a phone, with an admin Tannor's team runs themselves",
        'Tannor result text',
    ),
    body: swapText(
        tannor.body,
        ' on 29 October 2026, with the admin from day one. We will add Google PageSpeed figures for the live site to this page.',
        ' on 29 October 2026, with the admin from day one. On 31 October 2026, Google PageSpeed Insights scored the home page 97 for performance on a phone and 100 on a desktop, with 100 for accessibility, best practices and SEO on both. In the phone test, on a simulated slow 4G connection, the first content appeared in 1.2 seconds and the largest in 2.4 seconds, and nothing on the page jumped as it loaded.',
        'Tannor story',
    ),
}
const adsChanges = { order: -1 }
const OMEK_OLD = 'More than 300 products are live so far.'
const OMEK_NEW = 'More than 300 products are live.'
if (!omek.description.includes(OMEK_OLD) && !omek.description.includes(OMEK_NEW)) fail('the Omek description has changed since this was written.')
const omekChanges = {
    description: omek.description.replace(OMEK_OLD, OMEK_NEW),
    resultText: swapField(omek.resultText, 'Products live, build in progress', 'Products live', 'Omek result text'),
    body: swapText(
        omek.body,
        'Checkout takes Paystack and Hubtel. The admin is custom and covers orders, stock, categories, coupons, reviews and enquiries, including flash deals priced against competitor listings rather than against an invented discount. More than 300 products are live so far.',
        'Checkout takes Paystack and Hubtel. The admin is custom and covers orders, stock, categories, coupons, reviews and enquiries, including flash deals priced against competitor listings rather than against an invented discount. More than 300 products are live.',
        'Omek story',
    ),
}

const dWork = structuredClone(home.dWork)
const omekStep = dWork.steps.find((s) => /Omek Storefront/.test(s.label || ''))
const omekChip = omekStep?.chips?.find((c) => c.kind === 'progress' || c.text === 'Finished')
const omekRow = dWork.projects.find((p) => p.name === 'Omek Storefront')
if (!omekChip || !omekRow) fail('could not find Omek in the home page work section.')
Object.assign(omekChip, { text: 'Finished', kind: 'live' })
Object.assign(omekRow, { status: 'Finished', kind: 'done' })

const logos = settings.clientLogos || []
const logoListed = existingLogo && logos.some((l) => l.logo === existingLogo.id)

/* ----------------------------------------------------------------- report */

const show = (label, was, now) => {
    if (canon(was) !== canon(now)) console.log(`  ${label}\n    WAS: ${typeof was === 'string' ? was : canon(was)}\n    NOW: ${typeof now === 'string' ? now : canon(now)}`)
}
console.log('Tannor Freight')
show('order', tannor.order, tannorChanges.order)
show('result', `${tannor.resultMetric} | ${tannor.resultText}`, `${tannorChanges.resultMetric} | ${tannorChanges.resultText}`)
console.log(`  story text ${canon(tannor.body) === canon(tannorChanges.body) ? 'already has the figures' : 'gets the PageSpeed figures'}`)
console.log('Omek Google Ads')
show('order', ads.order, adsChanges.order)
console.log('Omek Storefront')
show('result', omek.resultText, omekChanges.resultText)
show('description ends', omek.description.slice(-60), omekChanges.description.slice(-60))
console.log(`  story text ${canon(omek.body) === canon(omekChanges.body) ? 'already finished' : 'drops "so far"'}`)
console.log('Home page work section')
show('Omek chips', home.dWork.steps.find((s) => /Omek Storefront/.test(s.label || '')).chips.map((c) => c.text).join(', '), omekStep.chips.map((c) => c.text).join(', '))
show('Omek row', home.dWork.projects.find((p) => p.name === 'Omek Storefront').status, omekRow.status)
console.log('Client Logos')
console.log(`  ${logos.length} now. ${existingLogo ? `Logo already uploaded, media ${existingLogo.id}${logoListed ? ', and listed.' : ', to add to the list in the admin.'}` : `Upload ${LOGO_PATH}, to add to the list in the admin.`}`)

if (!CONFIRM) {
    console.log('\nDry run. Nothing written. Add --confirm to write.')
    process.exit(0)
}

/* ----------------------------------------------------------------- write */

const backup = join(HERE, 'latest-work-first-backup.json')
writeFileSync(
    backup,
    JSON.stringify({ savedAt: new Date().toISOString(), tannor, ads, omek, dWork: home.dWork, clientLogos: logos }, null, 2),
)
console.log(`\nBacked up what this changes to ${backup}`)

let logoId = existingLogo?.id
if (!logoId) {
    const form = new FormData()
    form.append('file', new Blob([readFileSync(LOGO_PATH)], { type: 'image/png' }), `${LOGO_NAME}${extname(LOGO_PATH)}`)
    form.append('_payload', JSON.stringify({ alt: 'Tannor Freight & Logistics logo', credit: 'Tannor Freight & Logistics Ltd.', kind: 'raw' }))
    const uploaded = await api('media', { method: 'POST', body: form })
    logoId = uploaded.doc?.id
    if (!logoId) fail('uploading the logo returned no id')
    console.log(`  uploaded the logo as media ${logoId} (${uploaded.doc.filename})`)
}

await api(`caseStudies/${tannor.id}`, { method: 'PATCH', body: JSON.stringify(tannorChanges) })
await api(`caseStudies/${ads.id}`, { method: 'PATCH', body: JSON.stringify(adsChanges) })
await api(`caseStudies/${omek.id}`, { method: 'PATCH', body: JSON.stringify(omekChanges) })
await api('globals/homepage', { method: 'POST', body: JSON.stringify({ dWork }) })

/* Read it all back rather than trusting the responses. */
const check = (what, now, want) => {
    if (canon(now) !== canon(want)) fail(`${what} came back different from what was sent.`)
}
const [tannorAfter, adsAfter, omekAfter, homeAfter] = await Promise.all([
    study('tannor-freight'),
    study('omek-google-ads'),
    study('omek-storefront'),
    api('globals/homepage?depth=0'),
])
for (const [name, after, before, changes] of [
    ['Tannor', tannorAfter, tannor, tannorChanges],
    ['Omek Google Ads', adsAfter, ads, adsChanges],
    ['Omek Storefront', omekAfter, omek, omekChanges],
]) {
    for (const k of Object.keys(changes)) check(`${name} ${k}`, after[k], changes[k])
    for (const k of ['title', 'slug', 'published', 'coverImage', 'imageGallery', 'metrics', 'tag', 'projectType', 'showUnderServices']) {
        check(`${name} ${k}, which this script did not ask to move,`, after[k], before[k])
    }
}
check('The home page work section', homeAfter.dWork, dWork)
for (const k of ['dHero', 'dProblem', 'dSolutions', 'dTestimonials', 'dProcess', 'dPrices', 'dFaq', 'dContact']) {
    check(`Home page ${k}, which this script did not ask to move,`, homeAfter[k], home[k])
}

console.log('  read back: all as sent, nothing else moved.')
if (!logos.some((l) => l.logo === logoId)) console.log(`  Still to do by hand: add media ${logoId} to Client Logos in Site Settings, in the admin.`)
console.log('\nDone. Allow a minute for the cache.')
