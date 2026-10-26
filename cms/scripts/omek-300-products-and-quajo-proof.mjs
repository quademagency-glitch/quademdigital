#!/usr/bin/env node
/*
  Omek's product count, and Quajo Speaks in place of SAN Collection as the
  website proof.

  Asked for by Ernest on 26 October 2026: "omek has 300 plus product live. use
  quajospeaks instead of SAN collection for websites proof". Dry run by
  default.

  WHAT CHANGES

  1. The Omek case study said 151 products were live (of the 267 the old shop
     carried). Now more than 300 are:
       - headline number (resultMetric): "151" becomes "300+";
       - description and one sentence of the write-up: "151 of their/the 267
         products are live so far." becomes "More than 300 products are live
         so far."
     "carrying 267 products" stays: it describes the old shop on 3 July 2026.
  2. A service page shows its first three case studies by `order`
     (SvcProjects.astro, ServiceProjects.astro), which for web design were
     Omek, QuadERP and SAN Collection. Quajo Speaks (4) and SAN Collection (3)
     swap orders, so Quajo Speaks is the third. SAN Collection stays published
     and listed on /projects/, one place lower.

  WHAT IT DOES NOT TOUCH

  Every other field. Each document is sent back whole, because a REST update
  reapplies the default of any field it does not name (cms/CLAUDE.md), and
  published defaults to false: a partial update would unpublish a case study.
  Every expected old value is checked before anything is written, and each
  document is read back afterwards and compared field by field.

  Run:
    node cms/scripts/omek-300-products-and-quajo-proof.mjs
    node cms/scripts/omek-300-products-and-quajo-proof.mjs --confirm
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

const METRIC = { from: '151', to: '300+' }
const DESCRIPTION = { from: '151 of their 267 products are live so far.', to: 'More than 300 products are live so far.' }
const SENTENCE = { from: '151 of the 267 products are live so far.', to: 'More than 300 products are live so far.' }
const ORDER = { 'san-collection': { from: 3, to: 4 }, 'quajo-speaks': { from: 4, to: 3 } }

/* ------------------------------------------------------------------ read */

const res = await fetch(`${BASE}/api/caseStudies?limit=100&depth=0`, { headers })
if (!res.ok) {
    console.error(`Could not read caseStudies: HTTP ${res.status}`)
    process.exit(2)
}
const docs = (await res.json()).docs || []
const bySlug = (slug) => docs.find((d) => d.slug === slug)
const omek = bySlug('omek-storefront')
if (!omek) { console.error('No case study omek-storefront. Nothing done.'); process.exit(2) }
for (const slug of Object.keys(ORDER)) if (!bySlug(slug)) { console.error(`No case study ${slug}. Nothing done.`); process.exit(2) }

const backup = join(HERE, 'omek-300-quajo-proof-before-backup.json')
writeFileSync(backup, JSON.stringify(docs.filter((d) => ['omek-storefront', ...Object.keys(ORDER)].includes(d.slug)), null, 2))
console.log(`Backup of the three case studies: ${backup}\n`)

/* ----------------------------------------------- check, then build the new docs */

const problems = []
const plans = [] // { doc, next, changed: [fields] }

{
    const next = structuredClone(omek)
    if (String(omek.resultMetric) !== METRIC.from) problems.push(`Omek headline number is "${omek.resultMetric}", expected "${METRIC.from}"`)
    next.resultMetric = METRIC.to
    const inDescription = (omek.description || '').split(DESCRIPTION.from).length - 1
    if (inDescription !== 1) problems.push(`found the Omek description sentence ${inDescription} times, expected once`)
    next.description = (omek.description || '').replace(DESCRIPTION.from, DESCRIPTION.to)
    let sentences = 0
    const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk)
        if (!node || typeof node !== 'object') return
        if (node.type === 'text' && typeof node.text === 'string' && node.text.includes(SENTENCE.from)) {
            node.text = node.text.replace(SENTENCE.from, SENTENCE.to)
            sentences++
        }
        Object.values(node).forEach(walk)
    }
    walk(next.body)
    if (sentences !== 1) problems.push(`found the Omek write-up sentence ${sentences} times, expected once`)
    console.log(`OMEK STOREFRONT (#${omek.id})`)
    console.log(`  headline number   "${METRIC.from}" -> "${METRIC.to}" (${omek.resultText || 'no label'})`)
    console.log(`  description       "${DESCRIPTION.from}" -> "${DESCRIPTION.to}"`)
    console.log(`  write-up          "${SENTENCE.from}" -> "${SENTENCE.to}"\n`)
    plans.push({ doc: omek, next, changed: ['resultMetric', 'description', 'body'] })
}

for (const [slug, { from, to }] of Object.entries(ORDER)) {
    const doc = bySlug(slug)
    if (Number(doc.order) !== from) problems.push(`${slug} order is ${doc.order}, expected ${from}`)
    console.log(`${doc.title} (#${doc.id}): order ${from} -> ${to}`)
    plans.push({ doc, next: { ...doc, order: to }, changed: ['order'] })
}

if (problems.length) {
    console.error(`\nThe live documents are not what this script expects, so nothing was written:\n  ${problems.join('\n  ')}`)
    process.exit(1)
}

if (!CONFIRM) {
    console.log('\nDry run. Nothing was written. Add --confirm to write.')
    process.exit(0)
}

/* ----------------------------------------------------------------- write */

for (const { doc, next, changed } of plans) {
    const { id, createdAt, updatedAt, ...body } = next
    const wrote = await fetch(`${BASE}/api/caseStudies/${doc.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
    if (!wrote.ok) {
        console.error(`\n${doc.slug}: HTTP ${wrote.status}: ${(await wrote.text()).slice(0, 300)}\nRestore from ${backup}.`)
        process.exit(1)
    }
    /* Read it back rather than trusting the response: only the named fields may move. */
    const after = await (await fetch(`${BASE}/api/caseStudies/${doc.id}?depth=0`, { headers })).json()
    const moved = Object.keys({ ...doc, ...after }).filter(
        (k) => ![...changed, 'updatedAt'].includes(k) && JSON.stringify(doc[k]) !== JSON.stringify(after[k]),
    )
    const wrong = changed.filter((k) => JSON.stringify(stripIds(after[k])) !== JSON.stringify(stripIds(next[k])))
    if (moved.length || wrong.length) {
        if (moved.length) console.error(`\n${doc.slug}: something else changed: ${moved.join(', ')}.`)
        if (wrong.length) console.error(`\n${doc.slug}: did not land as written: ${wrong.join(', ')}.`)
        console.error(`Restore from ${backup}.`)
        process.exit(1)
    }
    console.log(`  written and read back: ${doc.slug} (${changed.join(', ')}); still published: ${after.published}`)
}
console.log('\nDone. Allow a minute for the site cache.')

function stripIds(v) {
    if (Array.isArray(v)) return v.map(stripIds)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'id').map(([k, x]) => [k, stripIds(x)]))
    return v
}
