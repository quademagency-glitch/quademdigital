#!/usr/bin/env node
/*
  Three copy fixes on the homepage global, all named in docs/global-page-spec.md.

  1. The hero tagline is two sentences fused into one. It reads:

       "...You work directly with the person building your brand fast
        turnarounds, honest pricing, and work designed to make you money..."

     There is nothing between "brand" and "fast turnarounds". The replacement is
     the spec's own wording, which fixes the punctuation and is better copy: it
     names what is actually sold instead of "Full Digital Marketing Agency".
     Note the site's own code fallback for this field was already correct, so
     only the CMS value was ever wrong.

  2. The AI Video promo card ends "...from GHS 1,500." while the pricing section
     directly below it shows dollars to everyone outside Ghana. That is the
     mixed-currency problem the spec opens with, and it is the one thing on the
     homepage the geo switch cannot reach, because the price is prose rather
     than a number in a field.

     The cedi figure comes out rather than being converted. There is no verified
     USD price for the video service anywhere in the CMS or the repo, and
     inventing one is exactly what this project's rules forbid. The card links
     to the service page, which carries the full pricing.

  3. Spec fix 1.3, the hero. The spec quotes the current headline as "Premium
     Websites that convert and help you grow!" and says to replace it outright.
     That quote is a frame of an animation, not the stored value.

     The stored value is "Premium | for businesses ready to grow." The pipe
     splits it around a rotating service word, so the live H1 reads
     "Premium / Websites / for businesses ready to grow." and cycles through five
     services. Two of the spec's three objections are therefore already moot:
     there is no exclamation mark, and it does not lead with websites, it
     rotates. What stands is "Premium", a claim anyone can make.

     Dropping that one word leaves "| for businesses ready to grow.", which
     renders as "Websites / for businesses ready to grow." An empty first
     segment is falsy in HeroHeadline.tsx, so line 1 is simply not drawn.

     The pipe has to stay. src/pages/index.astro discards any headline without
     one and substitutes a hardcoded fallback, so a pipe-free value would
     silently replace the CMS copy with "I design ... that grow your business."
     That is also why the spec's own replacement cannot be pasted into this
     field: it has no pipe, and a service word would land in the middle of the
     sentence if it did.

     So the founder line goes in heroTagline instead, the prominent paragraph
     directly under the H1, which is where the spec wanted the differentiator to
     sit. The services and terms sentence moves down into heroSubheadline, a
     field HeroSection has always rendered and nothing has ever filled. Its
     "built by the person you actually talk to" clause comes out, because the
     tagline now makes that point one line above it and saying it twice in
     adjacent paragraphs weakens both.

     One more piece of the same fix, and it is the reason the spec's quote looked
     wrong at first. The exclamation mark is real, it just is not in
     heroHeadline. It is the `suffix` on the first heroServices entry, so slide
     one renders "Premium / Websites / that convert and help you grow!" while the
     other three fall back to the shared closing phrase. Slide one is the frame
     the page loads on, so that is the headline most visitors read and the one
     the spec quoted. Any rotation suffix ending in an exclamation mark is
     cleared here, which drops that slide onto the same closing line as the other
     three and makes the rotation read consistently.

  Run:
    node cms/scripts/fix-homepage-copy.mjs --dry-run
    node cms/scripts/fix-homepage-copy.mjs
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

// The leading pipe is load bearing. See fix 3 in the header.
const NEW_HEADLINE = '| for businesses ready to grow.'

const NEW_TAGLINE = 'You work with the founder. Not an account manager.'

const NEW_SUBHEADLINE =
    'Websites, brand, AI video and automation. Fast turnarounds, honest pricing, and work designed to make you money rather than just look good.'

const TEXT_FIELDS = [
    ['heroHeadline', NEW_HEADLINE],
    ['heroTagline', NEW_TAGLINE],
    ['heroSubheadline', NEW_SUBHEADLINE],
]

const headers = { 'Content-Type': 'application/json', Authorization: `users API-Key ${KEY}` }

const res = await fetch(`${BASE}/api/globals/homepage?depth=0`, { headers })
if (!res.ok) {
    console.error(`Could not read the homepage global: HTTP ${res.status}`)
    process.exit(1)
}
const doc = await res.json()

const changes = []
const patch = {}

for (const [field, after] of TEXT_FIELDS) {
    if (doc[field] === after) continue
    changes.push({ field, before: doc[field], after })
    patch[field] = after
}

/*
  Clear any rotation suffix that ends in an exclamation mark. Clearing it rather
  than rewording it is what drops the slide onto parts[1] of heroHeadline, the
  closing phrase the other three slides already share, so all four read alike.
*/
const services = Array.isArray(doc.heroServices) ? doc.heroServices : []
const fixedServices = services.map((w) => {
    if (typeof w.suffix === 'string' && w.suffix.trim().endsWith('!')) {
        changes.push({ field: `heroServices[${w.service}].suffix`, before: w.suffix, after: null })
        return { ...w, suffix: null }
    }
    return w
})
if (changes.some((c) => c.field.startsWith('heroServices'))) {
    patch.heroServices = fixedServices
}

const promos = Array.isArray(doc.promoSections) ? doc.promoSections : []
// Match the cedi price wherever it sits in the sentence, so a reworded card
// still gets cleaned rather than silently skipped.
const CEDI = /,?\s*from\s+(?:GHS|GH₵)\s?[\d,]+\.?/i
const fixedPromos = promos.map((p) => {
    if (typeof p.body === 'string' && CEDI.test(p.body)) {
        const after = p.body.replace(CEDI, '.').replace(/\.\.+$/, '.')
        changes.push({ field: `promoSections[${p.badge || p.visual}].body`, before: p.body, after })
        return { ...p, body: after }
    }
    return p
})
if (changes.some((c) => c.field.startsWith('promoSections'))) {
    patch.promoSections = fixedPromos
}

if (changes.length === 0) {
    console.log('Nothing to change. Both fixes are already in place.')
    process.exit(0)
}

for (const c of changes) {
    console.log(`\n${c.field}`)
    console.log(`  before: ${JSON.stringify(c.before)}`)
    console.log(`  after:  ${JSON.stringify(c.after)}`)
}

if (DRY) {
    console.log(`\nDry run. ${changes.length} field(s) would change. Nothing was written.`)
    process.exit(0)
}

const put = await fetch(`${BASE}/api/globals/homepage`, { method: 'POST', headers, body: JSON.stringify(patch) })
const out = await put.json()
if (!put.ok) {
    console.error(`\nHTTP ${put.status}`)
    console.error(JSON.stringify(out, null, 2).slice(0, 1500))
    process.exit(1)
}
console.log(`\nUpdated ${changes.length} field(s) on the homepage global.`)
console.log('The edge cache holds public pages for 60 seconds, so give it a minute.')
