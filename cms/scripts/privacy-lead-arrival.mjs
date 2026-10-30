#!/usr/bin/env node
/*
  Tells visitors that an enquiry now records how they reached the site.

  Asked for by Ernest on 30 October 2026, with the feature itself: each lead now
  saves the site that sent the person, the first page they saw and the page the
  form was on (src/lib/leadArrival.ts). The policy already listed "referral
  source" under what analytics collects, but not that it is kept with an enquiry.
  It also said the site's own cookies were only sign-in and theme, which missed
  the 30-day campaign cookie that has been there all along, so this adds that too.

  It changes the wording of three text nodes and nothing else. Each is matched on
  its exact old text, so a policy edited since this was written stops the script
  rather than being overwritten. The new lines say "I" because the sections they
  sit in do.

  Sends `_status: "published"` and leaves out content_html, for the reasons in
  add-prospect-privacy-section.mjs: the page has drafts, and the CMS writes that
  HTML on save, which is what the website shows. The read-back checks it did.

  Run from the repo root (it reads .env there):
    node cms/scripts/privacy-lead-arrival.mjs
    node cms/scripts/privacy-lead-arrival.mjs --confirm
*/

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
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
const BASE = env.PUBLIC_PAYLOAD_URL?.replace(/\/$/, '')
const KEY = env.PAYLOAD_API_KEY
if (!BASE || !KEY) {
    console.error('Need PUBLIC_PAYLOAD_URL and PAYLOAD_API_KEY in the repo root .env.')
    process.exit(2)
}
if (new URL(BASE).hostname !== 'cms.quademdigital.com') {
    console.error(`Refusing to run against ${BASE}: this script is for the live CMS only.`)
    process.exit(2)
}
const headers = { 'Content-Type': 'application/json', Authorization: `users API-Key ${KEY}` }

const fail = (message) => {
    console.error(`\nStopped: ${message}`)
    process.exit(1)
}

const COOKIE_START =
    'This site sets a small number of its own cookies, which it needs to work: one that keeps you signed in to the client portal, and one that remembers whether you chose the light or dark theme.'
const COOKIE_END =
    ' The analytics, chat and booking services listed above set their own. You can turn cookies off in your browser settings, though some features, the client portal included, will stop working.'
const AUTOMATIC =
    ' IP address, browser type, device information, pages visited and referral source, collected through the analytics services listed below.'
const ENQUIRY_NOTE =
    ' When you send a form, I also keep with your enquiry a note of how you reached this site (for example a Google search, a social media link, an ad or a campaign link), the first page you landed on and the page the form was on, so I can tell which pages and offers bring enquiries.'
const COOKIE_NOTE =
    ' Two more note how you reached this site, for the enquiry note described above: one lasts only for your visit, and one keeps the campaign link you arrived on, if there was one, for 30 days.'

const CHANGES = [
    ['Last updated: 24 August 2026', 'Last updated: 30 October 2026'],
    [AUTOMATIC, AUTOMATIC + ENQUIRY_NOTE],
    [COOKIE_START + COOKIE_END, COOKIE_START + COOKIE_NOTE + COOKIE_END],
]

const canon = (value) =>
    JSON.stringify(value, (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v))

/* ------------------------------------------------------------------ read */

const res = await fetch(`${BASE}/api/pages?where[slug][equals]=privacy-policy&depth=0&limit=1`, { headers })
if (!res.ok) fail(`could not read the privacy policy: HTTP ${res.status}`)
const doc = (await res.json()).docs?.[0]
if (!doc) fail('no page with slug "privacy-policy".')

const blocks = doc.pageBuilder ?? []
if (blocks.length !== 1 || blocks[0].blockType !== 'textBlock') fail(`expected one textBlock, found: ${blocks.map((b) => b.blockType).join(', ')}`)

/* Rewrites the matching text nodes in a copy of the tree, counting each match. */
const counts = new Map(CHANGES.map(([from]) => [from, 0]))
const swap = (node) => {
    if (Array.isArray(node)) return node.map(swap)
    if (!node || typeof node !== 'object') return node
    const out = Object.fromEntries(Object.entries(node).map(([k, v]) => [k, swap(v)]))
    if (typeof node.text === 'string' && counts.has(node.text)) {
        counts.set(node.text, counts.get(node.text) + 1)
        out.text = CHANGES.find(([from]) => from === node.text)[1]
    }
    return out
}
const content = swap(blocks[0].content)

const alreadyDone = JSON.stringify(blocks[0].content).includes(ENQUIRY_NOTE.trim())
if (alreadyDone) {
    console.log('The policy already says this. Nothing to do.')
    process.exit(0)
}
for (const [from, count] of counts) {
    if (count !== 1) fail(`expected this text once and found it ${count} times, so the policy has changed since this was written:\n  ${from}`)
}

console.log(`Page id ${doc.id}, _status ${doc._status}. Three wordings change:\n`)
for (const [from, to] of CHANGES) {
    console.log(`  WAS: ${from.trim()}`)
    console.log(`  NOW: ${to.trim()}\n`)
}

if (!CONFIRM) {
    console.log('Dry run. Nothing written. Add --confirm to write.')
    process.exit(0)
}

/* ----------------------------------------------------------------- write */

const backup = join(HERE, 'privacy-lead-arrival-backup.json')
writeFileSync(backup, JSON.stringify({ savedAt: new Date().toISOString(), id: doc.id, pageBuilder: blocks }, null, 2))
console.log(`Backed up the current page to ${backup}`)

const { content_html: _stale, ...block } = blocks[0]
const put = await fetch(`${BASE}/api/pages/${doc.id}`, {
    method: 'PATCH',
    headers,
    // Mandatory. Without it the change can land as an invisible draft.
    body: JSON.stringify({ pageBuilder: [{ ...block, content }], _status: 'published' }),
})
if (!put.ok) fail(`HTTP ${put.status}\n${(await put.text()).slice(0, 1500)}`)

/* Read it back rather than trusting the response. */
const again = await fetch(`${BASE}/api/pages/${doc.id}?depth=0`, { headers })
if (!again.ok) fail(`could not read the page back: HTTP ${again.status}`)
const after = await again.json()
if (after._status !== 'published') fail(`it saved as ${after._status}, so the live page still has the old words.`)
if (canon(after.pageBuilder?.[0]?.content) !== canon(content)) fail('the text came back different from what was sent.')
for (const k of ['title', 'slug', 'meta']) {
    if (canon(after[k]) !== canon(doc[k])) fail(`${k} moved, and this script did not ask it to.`)
}
const html = after.pageBuilder?.[0]?.content_html || ''
for (const wanted of ['30 October 2026', 'the first page you landed on', 'one lasts only for your visit']) {
    if (!html.includes(wanted)) fail(`the HTML the website shows does not say "${wanted}", so the CMS did not rewrite it.`)
}
console.log('  read back: published, the three wordings changed, title, slug and meta as they were, HTML rewritten.')
console.log('\nDone. https://quademdigital.com/privacy-policy/ (allow a minute for the cache).')
