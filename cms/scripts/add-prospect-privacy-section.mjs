#!/usr/bin/env node
/*
  Adds the prospect-data section to the privacy policy.

  The campaign sends unsolicited email to businesses in the UK, the EU, the US
  and the Gulf, using contact details gathered from public listings. The policy
  described none of that: 444 words, one mention of "unsubscribe", nothing about
  prospect data, public sources, legitimate interest or the right to object.

  Copy is verbatim from docs/outreach-legal-copy.md and must stay that way. It is
  written plainly on purpose. A recipient who cannot understand it has not
  actually been informed, which is the whole point of the section.

  Three things this script does deliberately.

  1. It appends to the existing textBlock's lexical tree rather than adding a
     second block. TextBlockBlock.astro wraps each block in its own padded
     section, so a second block would split one continuous policy into two
     slabs with a gap in the middle.
  2. It is a script, not a migration. Pages has drafts enabled, so raw SQL would
     update `pages` and leave `_pages_v` describing the old copy, and the next
     time anyone opened the page in the admin and saved, the section would
     vanish.
  3. It sends `_status: "published"` explicitly. Without it the update can land
     as a draft and the live page keeps the old copy with nothing reporting an
     error, which is the same trap as an unpublished Resend template.

  The heading level is h2, not the h3 in the source document, because every
  other section on this page is an h2 and heading levels must not skip.

  Run:
    node cms/scripts/add-prospect-privacy-section.mjs --dry-run
    node cms/scripts/add-prospect-privacy-section.mjs
*/

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
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

const HEADING = 'Businesses we contact who have not contacted us'
// Insert above this heading, so the policy's own closing sections stay last.
const INSERT_BEFORE = 'Changes to This Policy'

const t = (text, format = 0) => ({ type: 'text', version: 1, format, detail: 0, mode: 'normal', style: '', text })
const para = (...children) => ({ type: 'paragraph', version: 1, format: '', indent: 0, direction: 'ltr', children })
const heading = (text, tag = 'h2') => ({ type: 'heading', tag, version: 1, format: '', indent: 0, direction: 'ltr', children: [t(text)] })
/** A paragraph that opens with a bold lead-in, which is how this copy is written. */
const lead = (bold, rest) => para(t(bold, 1), t(rest))

const NEW_NODES = [
    heading(HEADING),
    para(
        t(
            'We approach businesses directly to offer our services. If you have had an email from us and never asked for one, this section explains why.'
        )
    ),
    lead(
        'What we hold.',
        " The business name, a business email address, a business phone number, the website address, the town, and notes about the website itself, such as whether it uses a secure connection or links to social media accounts."
    ),
    lead(
        'Where it came from.',
        " Public sources only. Business listings, directories, and the businesses' own websites. We do not buy contact lists and we do not use personal email addresses where we can tell them apart from business ones."
    ),
    lead(
        'Why we are allowed to hold it.',
        ' We rely on legitimate interests: offering services that are relevant to a business we believe could use them. We have weighed that against the interruption of an unexpected email, which is why we contact businesses rather than individuals, keep the messages short, and stop immediately when asked.'
    ),
    lead(
        'How long we keep it.',
        ' Up to twelve months from collection, or until you ask us to remove it, whichever comes first. If you tell us to stop, we keep only enough information to make sure we never contact you again.'
    ),
    lead(
        'How to stop it.',
        ' Reply to any email from us and say so, or write to ernest@quademdigital.com. We will remove you and not write again. You do not have to give a reason, and there is nothing to click.'
    ),
    lead(
        'Your other rights.',
        ' You can ask what we hold about you, ask us to correct it, ask us to delete it, and object to us holding it at all. Write to ernest@quademdigital.com and we will answer within thirty days.'
    ),
    para(t('Quadem Digital, 18th Ahmadiyyah Avenue, Lakeside, Accra, Ghana.')),
]

/* ------------------------------------------------------------------- run */

const headers = { 'Content-Type': 'application/json', Authorization: `users API-Key ${KEY}` }

const res = await fetch(`${BASE}/api/pages?where[slug][equals]=privacy-policy&depth=0&limit=1`, { headers })
if (!res.ok) {
    console.error(`Could not read the privacy policy: HTTP ${res.status}`)
    process.exit(1)
}
const doc = (await res.json()).docs?.[0]
if (!doc) {
    console.error('No page with slug "privacy-policy". Nothing to do.')
    process.exit(1)
}

const blocks = doc.pageBuilder ?? []
const block = blocks.find((b) => b.blockType === 'textBlock' && b.content?.root?.children?.length)
if (!block) {
    console.error('The privacy policy has no textBlock to append to. Look at it before running this again.')
    process.exit(1)
}

const children = block.content.root.children
const textOf = (node) => (node.children ?? []).map((c) => c.text ?? '').join('')

if (children.some((c) => c.type === 'heading' && textOf(c).trim() === HEADING)) {
    console.log('The prospect-data section is already there. Nothing to do.')
    process.exit(0)
}

let at = children.findIndex((c) => c.type === 'heading' && textOf(c).trim() === INSERT_BEFORE)
if (at === -1) {
    console.log(`Could not find the "${INSERT_BEFORE}" heading, so the section goes at the end instead.`)
    at = children.length
}

const updated = [...children.slice(0, at), ...NEW_NODES, ...children.slice(at)]

// Keep a copy of what was there, because this rewrites a live legal page.
const backup = join(ROOT, 'cms', 'scripts', 'privacy-policy-backup.json')

if (DRY) {
    console.log(`Page id ${doc.id}, _status ${doc._status}, ${blocks.length} block(s).`)
    console.log(`Lexical children: ${children.length} -> ${updated.length} (adding ${NEW_NODES.length}).`)
    console.log(`Inserting before "${INSERT_BEFORE}" at index ${at}.`)
    console.log(`Backup would be written to ${backup}`)
    console.log('\nNew section, as it will read:\n')
    for (const node of NEW_NODES) {
        const text = (node.children ?? []).map((c) => c.text ?? '').join('')
        console.log(node.type === 'heading' ? `  ## ${text}` : `  ${text}`)
    }
    process.exit(0)
}

writeFileSync(backup, JSON.stringify({ savedAt: new Date().toISOString(), id: doc.id, pageBuilder: blocks }, null, 2))
console.log(`Backed up the current page to ${backup}`)

const payload = {
    pageBuilder: blocks.map((b) =>
        b.id === block.id
            ? { ...b, content: { ...b.content, root: { ...b.content.root, children: updated } } }
            : b
    ),
    // Mandatory. Without it the change can land as an invisible draft.
    _status: 'published',
}

const put = await fetch(`${BASE}/api/pages/${doc.id}`, { method: 'PATCH', headers, body: JSON.stringify(payload) })
const out = await put.json()
if (!put.ok) {
    console.error(`HTTP ${put.status}`)
    console.error(JSON.stringify(out, null, 2).slice(0, 2000))
    process.exit(1)
}
const after = out.doc?.pageBuilder?.[0]?.content?.root?.children?.length
console.log(`Updated. _status ${out.doc?._status}, lexical children now ${after}.`)
console.log('Check https://quademdigital.com/privacy-policy/ once the edge cache expires, 60 seconds.')
