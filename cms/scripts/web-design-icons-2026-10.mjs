#!/usr/bin/env node
/*
  The four icons in "What we build" on the web design page, part of the phone
  layout Ernest asked for on 20 October 2026.

  Three of them were left over from an older list of services and did not
  match the card they sat on: a Twitter bird on "Online shops", a video camera
  on "One-page websites" and a photo camera on "Web apps and dashboards". On a
  phone the icon is the first thing in each row, so the mismatch showed.
  These are the same line style as the SEO page icons (look-proof-2026-10.mjs).

  Dry run by default. --live writes. --plan=<file> writes the planned changes
  as JSON for the mock CMS used in mockups.

  Writes the whole global with the change laid over it (cms/CLAUDE.md:
  payload.update reapplies defaults for fields a write leaves out) and backs
  up what it reads to web-design-icons-2026-10-backup.json first (gitignored).

  Run:
    node cms/scripts/web-design-icons-2026-10.mjs
    node cms/scripts/web-design-icons-2026-10.mjs --live
*/

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const LIVE = process.argv.includes('--live')
const PLAN_OUT = (process.argv.find((x) => x.startsWith('--plan=')) || '').slice('--plan='.length)

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

async function api(method, path, body) {
    const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    const text = await res.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch { json = { raw: text.slice(0, 300) } }
    if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${json?.errors?.map((e) => e.message).join('; ') || text.slice(0, 300)}`)
    return json
}

console.log(LIVE ? 'LIVE RUN: changes will be written.\n' : 'DRY RUN: nothing will be written. Add --live to write.\n')

const page = await api('GET', '/api/globals/webDesignPage?depth=0')
const backupFile = join(HERE, 'web-design-icons-2026-10-backup.json')
if (LIVE || !existsSync(backupFile)) writeFileSync(backupFile, JSON.stringify({ takenAt: new Date().toISOString(), webDesignPage: page }, null, 2))

const SVG = (inner) => `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
// By card title, so a reordered or renamed card is reported, not mislabelled.
const ICONS = {
    'Business websites': SVG('<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),
    'Online shops': SVG('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
    'One-page websites': SVG('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),
    'Web apps and dashboards': SVG('<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>'),
}

const cards = page.servicesSection?.services || []
const unknown = cards.filter((c) => !ICONS[c.title]).map((c) => c.title)
if (unknown.length) {
    console.error(`STOPPED: no icon chosen for ${unknown.map((t) => `"${t}"`).join(', ')}. The cards have changed since this was written.`)
    process.exit(1)
}

const changes = []
if (cards.some((c) => c.iconSvg !== ICONS[c.title])) {
    const doc = { ...page }
    for (const k of ['id', 'createdAt', 'updatedAt', 'globalType']) delete doc[k]
    changes.push({
        what: `web design page: icons for ${cards.filter((c) => c.iconSvg !== ICONS[c.title]).map((c) => c.title).join(', ')}`,
        method: 'POST',
        path: '/api/globals/webDesignPage',
        body: { ...doc, servicesSection: { ...page.servicesSection, services: cards.map((c) => ({ ...c, iconSvg: ICONS[c.title] })) } },
    })
}

console.log(`${changes.length} changes:\n`)
for (const [i, c] of changes.entries()) console.log(`${String(i + 1).padStart(2)}. ${c.what}`)
console.log('')
if (PLAN_OUT) { writeFileSync(PLAN_OUT, JSON.stringify(changes, null, 2)); console.log(`Plan written to ${PLAN_OUT}.`) }
if (!LIVE) { console.log('Dry run. Nothing written. Run with --live to write these.'); process.exit(0) }
for (const [i, c] of changes.entries()) {
    try {
        await api(c.method, c.path, c.body)
        console.log(`  done ${i + 1}/${changes.length}  ${c.what}`)
    } catch (err) {
        console.error(`\nFAILED at ${i + 1}/${changes.length}: ${c.what}\n  ${err.message}\nThe backup is ${backupFile}.`)
        process.exit(1)
    }
}
console.log(`\nAll ${changes.length} changes written.`)
