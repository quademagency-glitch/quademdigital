#!/usr/bin/env node
/*
  Puts the 23 October 2026 performance score on the Quajo Speaks case study.

  Asked for by Ernest on 26 October 2026 ("yes" to correcting 94 to 90). Dry
  run by default.

  WHY

  The case study still said 94, a figure with no device or date behind it.
  Ernest ran PageSpeed on the phone setting on 23 October 2026 at 23:11 GMT
  (https://pagespeed.web.dev/analysis/https-quajospeaks-com/i4roeb4s3c?form_factor=mobile):
  performance 90, accessibility 100, best practices 100, SEO 100. The other
  three already match what the case study says, so only the 94 moves.

  WHAT CHANGES

  The 94 in its three places: the headline number (resultMetric), the short
  description, and one sentence of the write-up.

  WHAT IT DOES NOT TOUCH

  Every other field. The whole document is sent back, not just the changed
  fields, because a REST update reapplies the default of any field it does
  not name (cms/CLAUDE.md), and published defaults to false: a partial update
  would unpublish the case study. Every expected old value is checked before
  anything is written, and the document is read back afterwards and compared
  field by field.

  Run:
    node cms/scripts/update-quajo-performance-figure.mjs
    node cms/scripts/update-quajo-performance-figure.mjs --confirm
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

const SLUG = 'quajo-speaks'
const METRIC = { from: '94', to: '90' }
const DESCRIPTION = { from: 'It scores 94 for performance and 100 for SEO.', to: 'It scores 90 for performance and 100 for SEO.' }
const SENTENCE = {
    from: 'It scores 94 for performance and 100 for search readiness.',
    to: 'It scores 90 for performance and 100 for search readiness.',
}

/* ------------------------------------------------------------------ read */

const found = await fetch(`${BASE}/api/caseStudies?where[slug][equals]=${SLUG}&depth=0&limit=1`, { headers })
if (!found.ok) {
    console.error(`Could not read caseStudies: HTTP ${found.status}`)
    process.exit(2)
}
const doc = (await found.json()).docs?.[0]
if (!doc) {
    console.error(`No case study with slug ${SLUG}. Nothing done.`)
    process.exit(2)
}

const backup = join(HERE, 'quajo-speaks-before-90-backup.json')
writeFileSync(backup, JSON.stringify(doc, null, 2))
console.log(`Backup of case study ${doc.id}: ${backup}\n`)

/* ----------------------------------------------- check, then build the new doc */

const problems = []
const next = structuredClone(doc)

if (String(doc.resultMetric) !== METRIC.from) problems.push(`headline number is "${doc.resultMetric}", expected "${METRIC.from}"`)
next.resultMetric = typeof doc.resultMetric === 'number' ? Number(METRIC.to) : METRIC.to
console.log(`Headline number    ${METRIC.from} -> ${METRIC.to} (${doc.resultText || 'no label'})`)

const inDescription = (doc.description || '').split(DESCRIPTION.from).length - 1
if (inDescription !== 1) problems.push(`found the description sentence ${inDescription} times, expected once`)
next.description = (doc.description || '').replace(DESCRIPTION.from, DESCRIPTION.to)
console.log(`Description        "${DESCRIPTION.from}" -> 90`)

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
if (sentences !== 1) problems.push(`found the write-up sentence ${sentences} times, expected once`)
console.log(`Write-up           "${SENTENCE.from}" -> 90`)

if (JSON.stringify(next).includes('94 for')) problems.push('a "94 for" is still in the document after the changes')

if (problems.length) {
    console.error(`\nThe live document is not what this script expects, so nothing was written:\n  ${problems.join('\n  ')}`)
    process.exit(1)
}

if (!CONFIRM) {
    console.log('\nDry run. Nothing was written. Add --confirm to write.')
    process.exit(0)
}

/* ----------------------------------------------------------------- write */

const { id, createdAt, updatedAt, ...body } = next
const wrote = await fetch(`${BASE}/api/caseStudies/${doc.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
if (!wrote.ok) {
    console.error(`\nHTTP ${wrote.status}: ${(await wrote.text()).slice(0, 300)}`)
    process.exit(1)
}

/* Read it back rather than trusting the response, and compare every field:
   only the three named fields may differ from what was there before. */
const after = await (await fetch(`${BASE}/api/caseStudies/${doc.id}?depth=0`, { headers })).json()
const CHANGED = ['resultMetric', 'description', 'body', 'updatedAt']
const moved = Object.keys({ ...doc, ...after }).filter(
    (k) => !CHANGED.includes(k) && JSON.stringify(doc[k]) !== JSON.stringify(after[k]),
)
const wrong = ['resultMetric', 'description', 'body'].filter(
    (k) => JSON.stringify(stripIds(after[k])) !== JSON.stringify(stripIds(next[k])),
)
if (moved.length || wrong.length) {
    if (moved.length) console.error(`\nSomething else changed: ${moved.join(', ')}.`)
    if (wrong.length) console.error(`\nDid not land as written: ${wrong.join(', ')}.`)
    console.error(`Restore from ${backup}.`)
    process.exit(1)
}
console.log(`\nWritten and read back. Only the 94 changed, in its three places; still published: ${after.published}.`)

function stripIds(v) {
    if (Array.isArray(v)) return v.map(stripIds)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'id').map(([k, x]) => [k, stripIds(x)]))
    return v
}
