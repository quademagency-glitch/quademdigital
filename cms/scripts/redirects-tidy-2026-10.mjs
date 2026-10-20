#!/usr/bin/env node
/*
  Redirects tidied after the services restructure (Ernest, 20 October 2026:
  "tidy up").

  - The two old branding addresses went to /services/brand-identity/, which
    itself forwards to web design since branding was retired on 19 October:
    two hops. They now go straight to /services/web-design/.
  - The old double-dash address of the growth marketing page went to the SEO
    page, from before the page had its own address. It now goes to
    /services/digital-marketing-social-media/, where Growth & Performance
    Marketing lives (the slug did not change in the restructure).

  Each change is guarded on the current destination, so a redirect edited in
  the admin since is left alone. Dry run by default; --live writes, after a
  backup to redirects-tidy-2026-10-backup.json (gitignored).

  Run:
    node cms/scripts/redirects-tidy-2026-10.mjs
    node cms/scripts/redirects-tidy-2026-10.mjs --live
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

const PLAN = [
    { from: '/services/branding-graphic-design', was: '/services/brand-identity/', to: '/services/web-design/', note: 'The old Services collection slug for branding. Straight to web design since 20 October 2026: branding was retired on 19 October and /services/brand-identity/ forwards there too.' },
    { from: '/services/branding--graphic-design', was: '/services/brand-identity/', to: '/services/web-design/', note: 'Double-dash slug from the Sanity site. Straight to web design since 20 October 2026: branding was retired on 19 October.' },
    { from: '/services/digital-marketing--social-media', was: '/services/seo/', to: '/services/digital-marketing-social-media/', note: 'Double-dash slug from the Sanity site. To Growth & Performance Marketing (same slug since the 19 October restructure) from 20 October 2026; it used to go to SEO.' },
]

console.log(LIVE ? 'LIVE RUN: changes will be written.\n' : 'DRY RUN: nothing will be written. Add --live to write.\n')
const all = (await api('GET', '/api/redirects?limit=500&depth=0')).docs
const backupFile = join(HERE, 'redirects-tidy-2026-10-backup.json')
if (LIVE || !existsSync(backupFile)) writeFileSync(backupFile, JSON.stringify({ takenAt: new Date().toISOString(), redirects: all }, null, 2))

const changes = []
for (const p of PLAN) {
    const r = all.find((x) => x.fromPath === p.from)
    if (!r) { console.log(`  (no redirect from ${p.from}; nothing to do)`); continue }
    if (r.toPath === p.to) { console.log(`  (${p.from} already goes to ${p.to})`); continue }
    if (r.toPath !== p.was) { console.log(`  LEFT ALONE: ${p.from} now goes to ${r.toPath}, not ${p.was}; it was edited since.`); continue }
    const doc = { ...r }
    for (const k of ['id', 'createdAt', 'updatedAt']) delete doc[k]
    changes.push({ what: `${p.from}: ${p.was} -> ${p.to}`, path: `/api/redirects/${r.id}`, body: { ...doc, toPath: p.to, note: p.note } })
}
console.log(`${changes.length} changes:\n`)
for (const [i, c] of changes.entries()) console.log(`${String(i + 1).padStart(2)}. ${c.what}`)
console.log('')
if (!LIVE) { console.log('Dry run. Nothing written. Run with --live to write these.'); process.exit(0) }
for (const [i, c] of changes.entries()) {
    try {
        await api('PATCH', c.path, c.body)
        console.log(`  done ${i + 1}/${changes.length}  ${c.what}`)
    } catch (err) {
        console.error(`\nFAILED at ${i + 1}/${changes.length}: ${c.what}\n  ${err.message}\nThe backup is ${backupFile}.`)
        process.exit(1)
    }
}
console.log(`\nAll ${changes.length} changes written.`)
