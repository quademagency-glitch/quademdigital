#!/usr/bin/env node
/*
  Takes the Quadem Digital brand identity case study off the site.

  Asked for by Ernest on 26 October 2026 ("remove brand identity"): branding
  was retired as a service on 19 October 2026, and the case study still
  showed on the Work page. Dry run by default.

  WHAT CHANGES

  Its `published` box is unticked. That is the CMS's own way to take a case
  study down, and it can be ticked again: the Work page, the projects lists,
  the previous and next links and the sitemap all leave it out, and its page
  stays reachable by its link only, marked not published and kept out of
  search (src/pages/projects/[slug].astro). Nothing is deleted.

  WHAT IT DOES NOT TOUCH

  Every other field. The whole document is sent back, because a REST update
  reapplies the default of any field it does not name (cms/CLAUDE.md). The
  document is read back afterwards and compared field by field.

  Run:
    node cms/scripts/unpublish-brand-identity-case-study.mjs
    node cms/scripts/unpublish-brand-identity-case-study.mjs --confirm
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

const SLUG = 'quadem-brand-identity'

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

const backup = join(HERE, 'quadem-brand-identity-before-unpublish-backup.json')
writeFileSync(backup, JSON.stringify(doc, null, 2))
console.log(`Backup of case study ${doc.id}: ${backup}\n`)
console.log(`"${doc.title}" (#${doc.id}): published ${doc.published} -> false`)

if (doc.published === false) {
    console.log('\nAlready unpublished. Nothing to do.')
    process.exit(0)
}
if (!CONFIRM) {
    console.log('\nDry run. Nothing was written. Add --confirm to write.')
    process.exit(0)
}

const { id, createdAt, updatedAt, ...body } = { ...doc, published: false }
const wrote = await fetch(`${BASE}/api/caseStudies/${doc.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
if (!wrote.ok) {
    console.error(`\nHTTP ${wrote.status}: ${(await wrote.text()).slice(0, 300)}`)
    process.exit(1)
}
const after = await (await fetch(`${BASE}/api/caseStudies/${doc.id}?depth=0`, { headers })).json()
const moved = Object.keys({ ...doc, ...after }).filter(
    (k) => !['published', 'updatedAt'].includes(k) && JSON.stringify(doc[k]) !== JSON.stringify(after[k]),
)
if (after.published !== false || moved.length) {
    if (after.published !== false) console.error('\nIt did not stay unpublished.')
    if (moved.length) console.error(`\nSomething else changed: ${moved.join(', ')}.`)
    console.error(`Restore from ${backup}.`)
    process.exit(1)
}
console.log('\nWritten and read back. Unpublished; nothing else changed.')
