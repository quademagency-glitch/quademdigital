#!/usr/bin/env node
/*
  Gives AI Automation and Fieldwork the icon and the highlights every other
  service already has.

  Both were created without an `iconSvg` and without `tags`. Two things follow
  from that on /services/ , and neither is obvious from the CMS:

    1. The card renders `service.iconSvg || <a plain circle>`. So those two
       services show an empty outlined circle where the other five show their
       own mark. It does not look like missing content, it looks like a bug.

    2. The "Highlights:" list is wrapped in `tags && tags.length > 0`, so it is
       absent entirely rather than empty. Five services list three things they
       do; these two list nothing.

  The icons are drawn in the same 24x24 stroke style as the existing five, so
  they inherit `currentColor` and the theme rather than carrying a colour.

  The highlights are taken from what the services already say about themselves,
  not invented:

    AI Automation  - its body describes replying on WhatsApp, asking three
                     questions to qualify, and its description names quotes,
                     bookings and follow-ups.
    Fieldwork      - section 02 of /services/fieldwork/ is titled "What
                     arrives" and its three subheadings are "The list", "The
                     reason" and "The clean-up".

  This does not touch the images. Those are still missing and cannot be written
  from here.

  Run:
    node cms/scripts/add-service-icons-and-highlights.mjs --dry-run
    node cms/scripts/add-service-icons-and-highlights.mjs
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

/* Feather-weight marks, matching the five already in the CMS: 24x24, no fill,
   stroke-width 2, currentColor. No text inside, so nothing to translate and
   nothing to go stale. */
const CPU =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>' +
    '<rect x="9" y="9" width="6" height="6"></rect>' +
    '<line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line>' +
    '<line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line>' +
    '<line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line>' +
    '<line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line>' +
    '</svg>'

const CHECKED_CLIPBOARD =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>' +
    '<rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>' +
    '<polyline points="9 14 11 16 15 12"></polyline>' +
    '</svg>'

const WORK = [
    {
        slug: 'ai-automation',
        iconSvg: CPU,
        tags: ['WhatsApp Replies', 'Lead Qualifying', 'Bookings & Follow-ups'],
    },
    {
        slug: 'fieldwork',
        iconSvg: CHECKED_CLIPBOARD,
        tags: ['Matched Business Lists', 'Checked Contacts', 'A Reason to Call'],
    },
]

async function bySlug(slug) {
    const r = await fetch(`${BASE}/api/services?where[slug][equals]=${slug}&depth=0&limit=1`, { headers })
    if (!r.ok) {
        console.error(`Could not read services: HTTP ${r.status}`)
        process.exit(1)
    }
    return (await r.json()).docs?.[0] || null
}

let failed = 0

for (const item of WORK) {
    const doc = await bySlug(item.slug)
    if (!doc) {
        console.error(`No service with slug "${item.slug}". Skipping.`)
        failed++
        continue
    }

    const hadIcon = Boolean(doc.iconSvg)
    const hadTags = Array.isArray(doc.tags) ? doc.tags.length : 0
    console.log(item.slug)
    console.log(`  icon:       ${hadIcon ? 'already set, leaving it' : 'none, adding one'}`)
    console.log(`  highlights: ${hadTags} now, ${item.tags.length} after`)
    item.tags.forEach((t) => console.log(`     ${t}`))

    if (DRY) continue

    // Leave an icon somebody has already chosen alone. Highlights are written
    // whole, because a partial list reads worse than none.
    const patch = { tags: item.tags.map((tag) => ({ tag })) }
    if (!hadIcon) patch.iconSvg = item.iconSvg

    const res = await fetch(`${BASE}/api/services/${doc.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch),
    })
    const out = await res.json()
    if (!res.ok) {
        console.error(`  HTTP ${res.status}`)
        console.error(JSON.stringify(out, null, 2).slice(0, 800))
        failed++
        continue
    }

    // Payload drops fields the running app does not declare and does not error
    // when it does, so read the write back rather than trusting the 200.
    const wroteTags = Array.isArray(out.doc?.tags) ? out.doc.tags.length : 0
    const wroteIcon = Boolean(out.doc?.iconSvg)
    if (wroteTags !== item.tags.length || !wroteIcon) {
        console.error(`  wrote ${wroteTags} highlight(s), icon ${wroteIcon ? 'set' : 'MISSING'}. That is not what was sent.`)
        failed++
        continue
    }
    console.log('  written')
}

console.log('')
if (failed) {
    console.error(`${failed} service(s) did not take. Nothing else was changed.`)
    process.exit(1)
}
console.log(DRY ? 'Dry run. Nothing was written.' : 'Done. The edge cache holds public pages for 60 seconds.')
