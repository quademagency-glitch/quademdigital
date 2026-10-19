#!/usr/bin/env node
/*
  Release 3 of the services restructure, the look, approved by Ernest on
  19 October 2026 from the mockups.

  Dry run by default. --live writes.

  WHAT IT CHANGES

  1. Three results for the bottom of the homepage hero, in the stats
     collection, which the hero reads (src/pages/index.astro). Every figure is
     real and already on the site: Omek's main picture on a phone, 2.9s from
     19.3s (the case study, measured with PageSpeed Insights); 64 seconds from
     a new WhatsApp enquiry to a full answer (the AI automation page, Quadem's
     own assistant); 40 checked businesses delivered in two weeks (the
     Fieldwork page, client unnamed). A stat that already exists with the same
     value is left alone.
  2. Line icons for the four areas on the SEO page instead of emoji, in the
     same stroke style as the web design page.

  The menu change is migration 20261019_130000_simpler_menu (siteSettings is
  admin-only).

  Writes whole documents with the changes laid over them (cms/CLAUDE.md:
  payload.update reapplies defaults for fields a write leaves out) and backs
  up what it reads to look-proof-2026-10-backup.json first (gitignored).

  Run:
    node cms/scripts/look-proof-2026-10.mjs
    node cms/scripts/look-proof-2026-10.mjs --live
*/

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const LIVE = process.argv.includes('--live')

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

const stats = (await api('GET', '/api/stats?limit=100&depth=0')).docs || []
const seoPage = await api('GET', '/api/globals/seoPage?depth=0')
const backupFile = join(HERE, 'look-proof-2026-10-backup.json')
if (LIVE || !existsSync(backupFile)) writeFileSync(backupFile, JSON.stringify({ takenAt: new Date().toISOString(), stats, seoPage }, null, 2))

const changes = []

const PROOFS = [
    { value: '2.9s', label: "Omek's page on a phone, was 19.3s", order: 1 },
    { value: '64s', label: 'To answer a new WhatsApp enquiry', order: 2 },
    { value: '40', label: 'Checked leads delivered in two weeks', order: 3 },
]
for (const proof of PROOFS) {
    if (stats.some((s) => s.value === proof.value)) { console.log(`  (a stat with value ${proof.value} exists; left alone)`); continue }
    changes.push({ what: `hero result "${proof.value}": ${proof.label}`, method: 'POST', path: '/api/stats', body: { ...proof, prefix: null, suffix: null, published: true } })
}

const SVG = (inner) => `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
const ICONS = [
    SVG('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
    SVG('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),
    SVG('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'),
    SVG('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>'),
]
const services = seoPage.servicesSection?.services || []
if (services.length !== ICONS.length) {
    console.error(`STOPPED: the SEO page has ${services.length} areas, the icons are for ${ICONS.length}.`)
    process.exit(1)
}
if (services.some((s, i) => s.iconSvg !== ICONS[i])) {
    const doc = { ...seoPage }
    for (const k of ['id', 'createdAt', 'updatedAt', 'globalType']) delete doc[k]
    changes.push({
        what: 'SEO page: line icons instead of emoji for the four areas',
        method: 'POST',
        path: '/api/globals/seoPage',
        body: { ...doc, servicesSection: { ...seoPage.servicesSection, services: services.map((s, i) => ({ ...s, iconSvg: ICONS[i] })) } },
    })
}

console.log(`${changes.length} changes:\n`)
for (const [i, c] of changes.entries()) console.log(`${String(i + 1).padStart(2)}. ${c.what}`)
console.log('')
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
