#!/usr/bin/env node
/*
  Puts the 18 September 2026 mobile figures on the Omek case study.

  Asked for by Ernest on 9 October 2026 ("work on them everywhere"). Dry run by
  default.

  WHY

  The case study table still showed the 21 August run: score 88, first paint
  1.7s, main picture 3.5s. Omek was measured again on 18 September and Ernest
  gave a prospect the new figures in writing on 29 September (score 95, main
  picture 2.9s, first paint 1.1s). work.quademdigital.com was corrected the
  same day as this script. The source for every new value is the CV Ernest
  sent with them (Downloads/Ernest-Avorwlanu-CV.pdf, 30 September), which
  lists the full September mobile run: 95, 2.9s, 1.1s, Speed Index 2.7s,
  20ms frozen, layout shift 0, accessibility 93, best practices 100, SEO 100.

  WHAT CHANGES

  Mobile, after column: four values move (88 to 95, 1.7s to 1.1s, 3.5s to
  2.9s, 4.6s to 2.7s). The other five were the same in both runs.
  The after date becomes 18 September 2026, so the headline lines read
  "Now 1.1s on 18 September 2026".
  Desktop was not re-run in September, so its rows keep their 21 August
  values and their section heading now says so, and the source note names
  both dates. The table has one date per column (MetricsComparison.astro),
  which is why the desktop date goes in the heading rather than the column.
  One sentence of the write-up said "three and a half seconds".

  WHAT IT DOES NOT TOUCH

  Every other field. The whole document is sent back, not just the changed
  fields, because a REST update reapplies the default of any field it does
  not name (cms/CLAUDE.md), and published defaults to false and projectType
  to concept: a partial update would unpublish the case study. Every expected
  old value is checked before anything is written, and the document is read
  back afterwards and compared field by field.

  Run:
    node cms/scripts/update-omek-case-study-figures.mjs
    node cms/scripts/update-omek-case-study-figures.mjs --confirm
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

const SLUG = 'omek-storefront'
const AFTER_LABEL = { from: '21 August 2026', to: '18 September 2026' }
const DESKTOP_SECTION = { from: 'Desktop', to: 'Desktop, after figures from 21 August 2026' }

// Mobile rows: [label, after now, after from 18 September]
const MOBILE = [
    ['Performance score', '88', '95'],
    ['Time until anything appears', '1.7s', '1.1s'],
    ['Time until the main picture loads', '3.5s', '2.9s'],
    ['Time until the page looks finished', '4.6s', '2.7s'],
    ['Time the page spends frozen', '20ms', '20ms'],
    ['Layout shifting as it loads', '0', '0'],
    ['Accessibility score', '93', '93'],
    ['Best practices score', '100', '100'],
    ['SEO score', '100', '100'],
]

const SOURCE = [
    'Every run was taken with pagespeed.web.dev against https://omekgh.com/, which resolves to https://www.omekgh.com/. Mobile runs use its emulated Moto G Power.',
    'After, mobile: 18 September 2026.',
    'After, desktop: 21 August 2026, 4:27 PM GMT, Lighthouse 13.4.1. Desktop was not re-run in September.',
    'Before: 6 July 2026. That report was not saved, but pagespeed.web.dev exposes no throttling control and applies the same Slow 4G emulation to every mobile run, so the runs are measured the same way.',
].join('\n')

const SENTENCE = {
    from: 'The line worth pointing at is the main picture: three and a half seconds instead of nineteen and a third.',
    to: 'The line worth pointing at is the main picture: just under three seconds instead of nineteen and a third.',
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

const backup = join(HERE, 'omek-storefront-before-sept-figures-backup.json')
writeFileSync(backup, JSON.stringify(doc, null, 2))
console.log(`Backup of case study ${doc.id}: ${backup}\n`)

/* ----------------------------------------------- check, then build the new doc */

const problems = []
const next = structuredClone(doc)

if (doc.metricsAfterLabel !== AFTER_LABEL.from) problems.push(`after date is "${doc.metricsAfterLabel}", expected "${AFTER_LABEL.from}"`)
next.metricsAfterLabel = AFTER_LABEL.to
next.metricsSource = SOURCE

for (const [label, was, now] of MOBILE) {
    const row = next.metrics.find((m) => m.section === 'Mobile' && m.label === label)
    if (!row) { problems.push(`no Mobile row "${label}"`); continue }
    if (row.after !== was) { problems.push(`Mobile "${label}" after is "${row.after}", expected "${was}"`); continue }
    if (was !== now) console.log(`Mobile   ${label.padEnd(36)} ${was.padStart(5)} -> ${now}`)
    row.after = now
}

const desktop = next.metrics.filter((m) => m.section === DESKTOP_SECTION.from)
if (desktop.length !== 6) problems.push(`expected 6 Desktop rows, found ${desktop.length}`)
for (const row of desktop) row.section = DESKTOP_SECTION.to
console.log(`Desktop  section heading -> "${DESKTOP_SECTION.to}" on ${desktop.length} rows, values unchanged`)

let sentences = 0
for (const block of next.body?.root?.children || []) {
    for (const child of block.children || []) {
        if (child.type === 'text' && child.text.includes(SENTENCE.from)) {
            child.text = child.text.replace(SENTENCE.from, SENTENCE.to)
            sentences++
        }
    }
}
if (sentences !== 1) problems.push(`found the "three and a half" sentence ${sentences} times, expected once`)
console.log(`Write-up "three and a half seconds" -> "just under three seconds"`)
console.log(`After date "${AFTER_LABEL.from}" -> "${AFTER_LABEL.to}"; source note rewritten for both dates`)

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
   only the four named fields may differ from what was there before. */
const after = await (await fetch(`${BASE}/api/caseStudies/${doc.id}?depth=0`, { headers })).json()
const CHANGED = ['metricsAfterLabel', 'metricsSource', 'metrics', 'body', 'updatedAt']
const moved = Object.keys({ ...doc, ...after }).filter(
    (k) => !CHANGED.includes(k) && JSON.stringify(doc[k]) !== JSON.stringify(after[k]),
)
const wrong = ['metricsAfterLabel', 'metricsSource', 'metrics', 'body'].filter(
    (k) => JSON.stringify(stripIds(after[k])) !== JSON.stringify(stripIds(next[k])),
)
if (moved.length || wrong.length) {
    if (moved.length) console.error(`\nSomething else changed: ${moved.join(', ')}.`)
    if (wrong.length) console.error(`\nDid not land as written: ${wrong.join(', ')}.`)
    console.error(`Restore from ${backup}.`)
    process.exit(1)
}
console.log(`\nWritten and read back. Only the table, its dates and one sentence changed; still published: ${after.published}.`)

function stripIds(v) {
    if (Array.isArray(v)) return v.map(stripIds)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'id').map(([k, x]) => [k, stripIds(x)]))
    return v
}
