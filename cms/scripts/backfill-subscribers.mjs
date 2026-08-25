#!/usr/bin/env node
/**
 * Bring the Resend audience into the subscribers collection.
 *
 * Until the collection existed, Resend held the only list. These are real
 * people who signed up before there was anywhere here to record them, so they
 * are imported rather than left behind, with their original signup date kept as
 * the consent date: the point of that field is when they actually asked, not
 * when this script ran.
 *
 * Idempotent, and prints what it would do unless told to write:
 *
 *   node scripts/backfill-subscribers.mjs            # show the plan
 *   node scripts/backfill-subscribers.mjs --apply    # do it
 *
 * Reads RESEND_API_KEY, PAYLOAD_API_KEY and PUBLIC_PAYLOAD_URL from the repo
 * root .env. The audience id is deliberately not configurable: see below.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const rootEnv = path.resolve(here, '../../.env')

const env = (() => {
  const out = {}
  for (const file of [rootEnv, path.resolve(here, '../.env')]) {
    if (!fs.existsSync(file)) continue
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#') || !t.includes('=')) continue
      const k = t.slice(0, t.indexOf('=')).trim()
      if (out[k]) continue // the root .env wins, it is the site's own config
      out[k] = t.slice(t.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
    }
  }
  return out
})()

const APPLY = process.argv.includes('--apply')
/*
  Not read from RESEND_AUDIENCE_ID. That variable holds
  `5e4d5e4d-5e4d-5e4d-5e4d-5e4d5e4d5e4d`, a placeholder that is not a real
  audience, and Resend answers 200 with an empty list for an id that does not
  exist rather than 404. Reading it here made this script report "0 contacts"
  and do nothing, which is exactly how the same variable made the Monday report
  claim zero subscribers. Kept in step with NEWSLETTER_AUDIENCE_ID in
  src/lib/subscribers.ts.
*/
const AUDIENCE = '6f7f906d-e7ff-4217-b425-1e15eb61e099'
const CMS = (env.PUBLIC_PAYLOAD_URL || 'https://cms.quademdigital.com').replace(/\/$/, '')

for (const required of ['RESEND_API_KEY', 'PAYLOAD_API_KEY']) {
  if (!env[required]) {
    console.error(`Missing ${required}. Nothing done.`)
    process.exit(1)
  }
}

const cmsHeaders = {
  'Content-Type': 'application/json',
  Authorization: `users API-Key ${env.PAYLOAD_API_KEY}`,
}

/** Resend's unsubscribed flag is the only status it keeps, so it maps to two of ours. */
const statusFor = (contact) => (contact.unsubscribed ? 'unsubscribed' : 'subscribed')

const contacts = await (async () => {
  const res = await fetch(`https://api.resend.com/audiences/${AUDIENCE}/contacts`, {
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
  })
  if (!res.ok) {
    console.error('Could not read the Resend audience:', res.status, await res.text())
    process.exit(1)
  }
  return (await res.json()).data || []
})()

console.log(`${contacts.length} contacts in the Resend audience`)
console.log(APPLY ? 'Writing.\n' : 'Dry run. Add --apply to write.\n')

let created = 0
let updated = 0
let unchanged = 0

for (const c of contacts) {
  const email = String(c.email || '').trim().toLowerCase()
  if (!email) continue

  const found = await fetch(
    `${CMS}/api/subscribers?where[email][equals]=${encodeURIComponent(email)}&limit=1&depth=0`,
    { headers: cmsHeaders },
  )
  if (!found.ok) {
    console.log(`  ${email}: lookup failed (${found.status}), skipped`)
    continue
  }
  const existing = (await found.json()).docs?.[0]

  if (existing) {
    // Only fill gaps. Anything already recorded here was recorded on purpose
    // and is more trustworthy than the mirror.
    const patch = {}
    if (!existing.resendContactId && c.id) patch.resendContactId = c.id
    if (!existing.consentAt && c.created_at) patch.consentAt = new Date(c.created_at).toISOString()

    if (!Object.keys(patch).length) {
      unchanged += 1
      console.log(`  ${email}: already here, nothing to add`)
      continue
    }
    console.log(`  ${email}: filling in ${Object.keys(patch).join(', ')}`)
    if (APPLY) {
      const res = await fetch(`${CMS}/api/subscribers/${existing.id}`, {
        method: 'PATCH',
        headers: cmsHeaders,
        body: JSON.stringify(patch),
      })
      if (!res.ok) console.log(`    update failed: ${res.status} ${await res.text()}`)
    }
    updated += 1
    continue
  }

  const body = {
    email,
    name: [c.first_name, c.last_name].filter(Boolean).join(' ') || null,
    status: statusFor(c),
    source: 'import',
    sourceDetail: 'Resend audience, imported when the list moved into Payload',
    consentAt: c.created_at ? new Date(c.created_at).toISOString() : null,
    resendContactId: c.id || null,
    unsubscribedAt: c.unsubscribed && c.created_at ? new Date(c.created_at).toISOString() : null,
  }
  console.log(`  ${email}: new, ${body.status}, consent ${body.consentAt || 'unknown'}`)
  if (APPLY) {
    const res = await fetch(`${CMS}/api/subscribers`, {
      method: 'POST',
      headers: cmsHeaders,
      body: JSON.stringify(body),
    })
    if (!res.ok) console.log(`    create failed: ${res.status} ${await res.text()}`)
  }
  created += 1
}

console.log(`\n${created} to create, ${updated} to fill in, ${unchanged} already complete`)
if (!APPLY) console.log('Nothing was written. Run again with --apply.')
