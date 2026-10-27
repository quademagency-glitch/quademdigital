#!/usr/bin/env node
/*
  The case studies and the Work page speak as "we", like the rest of the site.

  Asked for by Ernest on 26 October 2026: the site has said "we" since 19
  October, and the Work page intro and the case study write-ups still said
  "I" ("We everywhere"). Dry run by default.

  WHAT CHANGES

  Exactly the sentences listed in CHANGES below, each found once where it is
  expected or nothing is written. Quajo Speaks is Ernest's own platform, so
  where its write-up spoke for the person who writes there, it now says
  "Quajo", as its description already does ("Quajo writes and speaks...").
  The brand identity case study is unpublished and left alone.

  HOW IT WRITES

  Every document goes back whole (a REST update reapplies the default of any
  field it does not name, cms/CLAUDE.md), and is read back and compared field
  by field: only the description, body or subheading named may differ.

  Run:
    node cms/scripts/case-studies-we-voice.mjs
    node cms/scripts/case-studies-we-voice.mjs --confirm
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

// [slug, field, from, to]; field is 'description' or 'body' (a text node in the write-up).
const CHANGES = [
    ['omek-storefront', 'description', 'I audited and fixed the live site first,', 'We audited and fixed the live site first,'],
    ['omek-storefront', 'body', 'Some of what I found was costing money directly.', 'Some of what we found was costing money directly.'],
    ['omek-storefront', 'body', 'On the same day I renamed the category', 'On the same day we renamed the category'],
    ['omek-storefront', 'body', 'because I do not have one I could stand behind.', 'because we do not have one we could stand behind.'],
    ['quaderp-landing', 'description', 'I built a marketing site that scores 100', 'We built a marketing site that scores 100'],
    ['quajo-speaks', 'description', 'I built a six-section site around a writing archive', 'We built a six-section site around a writing archive'],
    ['quajo-speaks', 'body', 'QuajoSpeaks is mine rather than a client project', 'QuajoSpeaks is ours rather than a client project'],
    ['quajo-speaks', 'body', 'It is where I write and talk about relationships', 'It is where Quajo writes and talks about relationships'],
    ['quajo-speaks', 'body', 'I wanted somewhere a person could sit with an idea', 'Quajo wanted somewhere a person could sit with an idea'],
    ['quajo-speaks', 'body', 'a visitor sees an error and my direct address', "a visitor sees an error and Quajo's direct address"],
    ['san-collection', 'description', "I'm building it around three collections", "We're building it around three collections"],
    ['quadbrand', 'body', 'This one is mine, like QuadERP,', 'This one is ours, like QuadERP,'],
    ['quadbrand', 'body', 'I show it because building the thing I sell is the most honest demonstration I have.', 'We show it because building the thing we sell is the most honest demonstration we have.'],
]
const PAGE = { field: 'subheading', from: "See how I've helped my clients grow.", to: "See how we've helped our clients grow." }

const problems = []
const plans = [] // { kind, doc, next, fields }
const count = (text, part) => String(text || '').split(part).length - 1

const res = await fetch(`${BASE}/api/caseStudies?limit=100&depth=0`, { headers })
if (!res.ok) { console.error(`Could not read caseStudies: HTTP ${res.status}`); process.exit(2) }
const docs = (await res.json()).docs || []

for (const slug of [...new Set(CHANGES.map((c) => c[0]))]) {
    const doc = docs.find((d) => d.slug === slug)
    if (!doc) { problems.push(`no case study ${slug}`); continue }
    const next = structuredClone(doc)
    const fields = new Set()
    console.log(`${doc.title} (#${doc.id})`)
    for (const [, field, from, to] of CHANGES.filter((c) => c[0] === slug)) {
        if (field === 'description') {
            const n = count(next.description, from)
            if (n !== 1) { problems.push(`${slug} description: found "${from}" ${n} times`); continue }
            next.description = next.description.replace(from, to)
        } else {
            let n = 0
            const walk = (node) => {
                if (Array.isArray(node)) return node.forEach(walk)
                if (!node || typeof node !== 'object') return
                if (node.type === 'text' && typeof node.text === 'string' && node.text.includes(from)) { n += count(node.text, from); node.text = node.text.replace(from, to) }
                Object.values(node).forEach(walk)
            }
            walk(next.body)
            if (n !== 1) { problems.push(`${slug} body: found "${from}" ${n} times`); continue }
        }
        fields.add(field)
        console.log(`  ${field.padEnd(11)} "${from}"\n  ${''.padEnd(11)} -> "${to}"`)
    }
    plans.push({ kind: 'caseStudies', doc, next, fields: [...fields] })
}

const page = await (await fetch(`${BASE}/api/globals/projectsPage?depth=0`, { headers })).json()
if (count(page[PAGE.field], PAGE.from) !== 1) problems.push(`projectsPage ${PAGE.field}: found "${PAGE.from}" ${count(page[PAGE.field], PAGE.from)} times`)
else {
    plans.push({ kind: 'global', doc: page, next: { ...page, [PAGE.field]: page[PAGE.field].replace(PAGE.from, PAGE.to) }, fields: [PAGE.field] })
    console.log(`Work page (projectsPage)\n  ${PAGE.field.padEnd(11)} "${PAGE.from}"\n  ${''.padEnd(11)} -> "${PAGE.to}"`)
}

const backup = join(HERE, 'case-studies-we-voice-before-backup.json')
writeFileSync(backup, JSON.stringify({ caseStudies: docs.filter((d) => CHANGES.some((c) => c[0] === d.slug)), projectsPage: page }, null, 2))
console.log(`\nBackup: ${backup}`)

if (problems.length) {
    console.error(`\nThe live words are not what this script expects, so nothing was written:\n  ${problems.join('\n  ')}`)
    process.exit(1)
}
if (!CONFIRM) { console.log('\nDry run. Nothing was written. Add --confirm to write.'); process.exit(0) }

for (const { kind, doc, next, fields } of plans) {
    const { id, createdAt, updatedAt, globalType, ...body } = next
    const url = kind === 'global' ? `${BASE}/api/globals/projectsPage` : `${BASE}/api/caseStudies/${doc.id}`
    const wrote = await fetch(url, { method: kind === 'global' ? 'POST' : 'PATCH', headers, body: JSON.stringify(body) })
    if (!wrote.ok) { console.error(`\n${doc.slug || 'projectsPage'}: HTTP ${wrote.status}: ${(await wrote.text()).slice(0, 300)}\nRestore from ${backup}.`); process.exit(1) }
    const after = await (await fetch(kind === 'global' ? `${BASE}/api/globals/projectsPage?depth=0` : `${BASE}/api/caseStudies/${doc.id}?depth=0`, { headers })).json()
    const moved = Object.keys({ ...doc, ...after }).filter((k) => ![...fields, 'updatedAt'].includes(k) && JSON.stringify(doc[k]) !== JSON.stringify(after[k]))
    const wrong = fields.filter((k) => JSON.stringify(after[k]) !== JSON.stringify(next[k]))
    if (moved.length || wrong.length) {
        if (moved.length) console.error(`\n${doc.slug || 'projectsPage'}: something else changed: ${moved.join(', ')}.`)
        if (wrong.length) console.error(`\n${doc.slug || 'projectsPage'}: did not land as written: ${wrong.join(', ')}.`)
        console.error(`Restore from ${backup}.`)
        process.exit(1)
    }
    console.log(`  written and read back: ${doc.slug || 'projectsPage'} (${fields.join(', ')})`)
}
console.log('\nDone. Allow a minute for the site cache.')
