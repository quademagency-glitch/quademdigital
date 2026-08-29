#!/usr/bin/env node
/*
  Adds the two services that exist on the site but never existed in the CMS.

  Why it is missing in the first place. It is sold on /global, it is named in the
  homepage tagline ("Websites, brand, AI video and automation"), and it is one of
  the three service lines in the international pricing. It has never existed in
  the CMS. That did not show while /global carried its own hardcoded list of
  three services, and it showed the moment that page started reading the
  collection: the service dropped off the page that sells it hardest.

  Adding it here puts it in four places at once, which is the point of the
  collection being the single list: the services index, the contact form's
  checkboxes, /global, and its own page at /services/ai-automation/.

  Two things to know before running it.

  It publishes immediately. Services has no published flag and
  src/pages/sitemap.xml.ts maps every services document into the sitemap
  unfiltered, so this page is public and advertised for indexing the moment the
  document exists. There is no draft state to hide behind.

  It ships with no body. `body` is null on the live Digital Marketing service
  too, so a service page carrying only its title and description is existing
  practice rather than something new, and src/pages/services/[slug].astro
  renders it without complaint. It is still the thinnest page on the site, and
  the copy below is the only writing behind it. Worth an hour of Ernest's
  writing before it earns much.

  The description is taken verbatim from the /global services list, which is the
  spec's own wording. Nothing here is invented.

  Fieldwork is the second. It was built deliberately hidden, gated on winning
  clients with it before selling it, and Ernest lifted that gate on 28 August
  2026: it is a service like the others. Its page keeps its own bespoke route,
  because Astro sorts static route segments ahead of dynamic ones, so
  src/pages/services/fieldwork.astro serves /services/fieldwork/ and
  services/[slug].astro never does. This document exists only to put Fieldwork
  into the lists that read the collection, which is why its body is empty.

  Run:
    node cms/scripts/seed-services.mjs --dry-run
    node cms/scripts/seed-services.mjs
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

// Ordered after the five that exist, so nothing already on the services index
// moves and the contact form's existing checkboxes keep their positions.
const SERVICES = [
    {
        title: 'AI Automation',
        slug: 'ai-automation',
        description:
            'Your enquiries answered in sixty seconds, day or night. Quotes, bookings and follow-ups handled without anyone typing.',
        order: 6,
    },
    {
        title: 'Fieldwork',
        slug: 'fieldwork',
        // The standfirst from docs/fieldwork-page-copy.md, trimmed to one
        // sentence for a card. Verbatim wording, nothing rewritten.
        description:
            'Every month, a list of businesses that match your exact description, each with a checked email address, a phone number, and one line explaining why they need calling now.',
        order: 7,
    },
]

const planned = []

for (const service of SERVICES) {
    const res = await fetch(`${BASE}/api/services?where[slug][equals]=${service.slug}&depth=0&limit=1`, { headers })
    if (!res.ok) {
        console.error(`Could not read services: HTTP ${res.status}`)
        process.exit(1)
    }
    const existing = (await res.json()).docs?.[0] || null
    planned.push({ kind: existing ? 'UPDATE' : 'CREATE', id: existing?.id, service })
}

for (const p of planned) {
    console.log(`${p.kind}  /services/${p.service.slug}/`)
    for (const [k, v] of Object.entries(p.service)) console.log(`    ${k}: ${JSON.stringify(v)}`)
}

if (DRY) {
    console.log('\nDry run. Nothing was written.')
    console.log('Note: creating these publishes both pages and adds them to the sitemap immediately.')
    process.exit(0)
}

for (const p of planned) {
    const res = p.id
        ? await fetch(`${BASE}/api/services/${p.id}`, { method: 'PATCH', headers, body: JSON.stringify(p.service) })
        : await fetch(`${BASE}/api/services`, { method: 'POST', headers, body: JSON.stringify(p.service) })
    const out = await res.json()
    if (!res.ok) {
        console.error(`HTTP ${res.status} on ${p.service.title}`)
        console.error(JSON.stringify(out, null, 2).slice(0, 1200))
        process.exit(1)
    }
    console.log(`${p.kind === 'UPDATE' ? 'Updated' : 'Created'} ${p.service.title}`)
}

console.log('\nBoth are now on the services index, the contact form, /global and the sitemap.')
