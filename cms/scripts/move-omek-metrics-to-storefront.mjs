#!/usr/bin/env node
/*
  Puts the measured before-and-after table onto the Omek case study that is
  actually published, and leaves its writing alone.

  There are two Omek case studies and they are the same client. "Omek
  Storefront" is published, has a cover image, has an indexed URL, and already
  tells the speed story in prose: it names 19.3s and 3.5s. "Omek Gigs Appliance"
  was created on 25 August to carry the fifteen measured rows, and it is
  unpublished, has no cover image and no gallery.

  Publishing the second one would put a second card for one client on a grid of
  seven, with a hole where every other card has a picture. What the live page is
  missing is not a page, it is the table.

  So this copies the five metrics fields across and touches nothing else. The
  prose, the cover image, the gallery and the URL on the published study all
  stay exactly as they are.

  /global links to /projects/omek-storefront/ and leads that link with
  "19.3s to 3.5s", so the table lands on the page the campaign already points
  at, which is where a stranger checking the claim will look for it.

  The source document is left unpublished rather than deleted. Deleting is
  Ernest's call and this script does not need it gone to be correct.

  Run:
    node cms/scripts/move-omek-metrics-to-storefront.mjs --dry-run
    node cms/scripts/move-omek-metrics-to-storefront.mjs
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

const FROM = 'omek-gigs-performance'
const TO = 'omek-storefront'

async function bySlug(slug) {
    const r = await fetch(`${BASE}/api/caseStudies?where[slug][equals]=${slug}&depth=0&limit=1`, { headers })
    if (!r.ok) {
        console.error(`Could not read caseStudies: HTTP ${r.status}`)
        process.exit(1)
    }
    return (await r.json()).docs?.[0] || null
}

const source = await bySlug(FROM)
const target = await bySlug(TO)

if (!source) {
    console.error(`No case study with slug "${FROM}". Run seed-omek-case-study.mjs first.`)
    process.exit(1)
}
if (!target) {
    console.error(`No case study with slug "${TO}". Nothing to copy onto.`)
    process.exit(1)
}

const rows = Array.isArray(source.metrics) ? source.metrics : []
if (rows.length === 0) {
    console.error(`"${FROM}" has no metric rows. Re-run seed-omek-case-study.mjs, and check the`)
    console.error('CMS app has been deployed with the metrics fields before you do, or Payload')
    console.error('will accept the write and drop the table without erroring.')
    process.exit(1)
}

// Strip the row ids so Payload writes fresh ones on the target rather than
// trying to reuse another document's.
const patch = {
    metricsTitle: source.metricsTitle,
    metricsBeforeLabel: source.metricsBeforeLabel,
    metricsAfterLabel: source.metricsAfterLabel,
    metricsSource: source.metricsSource,
    metrics: rows.map(({ id, ...row }) => row),
}

const already = Array.isArray(target.metrics) ? target.metrics.length : 0

console.log(`Copying the measured table from "${source.title}" onto "${target.title}".`)
console.log(`  target /projects/${TO}/  published: ${target.published}`)
console.log(`  rows on the target now: ${already}   after this: ${patch.metrics.length}`)
console.log(`  title:  ${JSON.stringify(patch.metricsTitle)}`)
console.log(`  labels: ${JSON.stringify(patch.metricsBeforeLabel)} / ${JSON.stringify(patch.metricsAfterLabel)}`)
console.log('  highlighted rows:')
patch.metrics.filter((r) => r.highlight).forEach((r) => console.log(`     ${r.label}: ${r.before} -> ${r.after}`))
console.log('  nothing else on the target is touched: prose, cover image, gallery and URL all stay.')

if (DRY) {
    console.log('\nDry run. Nothing was written.')
    process.exit(0)
}

const res = await fetch(`${BASE}/api/caseStudies/${target.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patch),
})
const out = await res.json()
if (!res.ok) {
    console.error(`\nHTTP ${res.status}`)
    console.error(JSON.stringify(out, null, 2).slice(0, 1200))
    process.exit(1)
}

const written = Array.isArray(out.doc?.metrics) ? out.doc.metrics.length : 0
console.log(`\nWrote ${written} row(s) to /projects/${TO}/.`)
if (written !== patch.metrics.length) {
    console.error('That is not the number sent. Payload drops fields the running app does not')
    console.error('declare, so check the CMS has been deployed with the metrics fields.')
    process.exit(1)
}
console.log('The edge cache holds public pages for 60 seconds, so give it a minute.')
