#!/usr/bin/env node
/*
  The live CMS words for the new home page (row D final, approved by Ernest on
  24 October 2026).

  Dry run by default: it prints the planned before and after and writes
  nothing. --apply writes. --verbose also lists every box it would fill.

  WHAT IT CHANGES

  1. Seeds the new home page boxes. For each group on the homepage global
     (dHero, dProof, dProblem, dSolutions, dWork, dProcess, dPrices, dFaq,
     dContact) it fills the boxes from src/lib/homeD/<section>.defaults.json,
     the approved words the site already shows when a box is empty. Only empty
     boxes are filled: a box an editor has typed in is kept, and a list that
     already has rows is kept whole.

  2. The words the new labels and the measured reply time replace, each only
     while it still reads exactly as it does today:
       - homepage promoSections badges: "Build it" becomes "One-off projects",
         "Grow it" becomes "Monthly plans";
       - homepage trustHighlights description and promoSections body that say
         "within a minute" take the 64-second wording (the measured first
         reply is 64 seconds, not under a minute);
       - the AI automation service's description, the same;
       - the Growth & Performance Marketing service page text: "...in our
         monthly Grow it plans and AI video." becomes "...in our monthly plans
         and AI video." (that one text node of the page's Lexical JSON, nothing
         else in it).
     The WhatsApp assistant prices and the AI automation page's price tier say
     "within a minute" too; cms/scripts/ai-automation-prices-2026-10.mjs
     already fixes those, so this script leaves them alone.

  3. Publishes the approved client quote: when no testimonial by Emmanuel
     Korsah exists, it creates one (authorName "Emmanuel Korsah", authorRole
     "CEO, Omek", the quote word for word from src/lib/homeD/proof.defaults.json,
     published). Ernest gave his OK and Emmanuel approved the wording. An
     existing one is left as it is.

  BEFORE --apply

  The CMS must be deployed with the dHero ... dContact groups and the
  migration 20261024_111030_home_d_sections must have run on the live
  database. Payload drops fields its running config does not know and still
  answers 200, so the script checks that the live homepage has all nine groups
  and refuses --apply otherwise. It also asks the CMS who the API key belongs
  to and refuses unless that account may edit content (admin, editor or site,
  see cms/src/access/roles.ts).

  HOW IT WRITES

  Every update sends the whole document back with the changes laid over it.
  payload.update reapplies a field's defaultValue for anything the data does
  not name (cms/CLAUDE.md), and the homepage global has fields with defaults
  (the contact words, the hero). A service is sent without `slug`, as the
  earlier scripts do, so its address cannot change. Everything it reads is
  saved to home-d-launch-copy-2026-10-backup.json beside it first (gitignored,
  and only on --apply). After each write it reads the document back and checks
  both what it meant to change and that nothing else moved, and it stops at
  the first write that fails or does not read back as expected.

  Run:
    node cms/scripts/home-d-launch-copy-2026-10.mjs
    node cms/scripts/home-d-launch-copy-2026-10.mjs --verbose
    node cms/scripts/home-d-launch-copy-2026-10.mjs --apply
*/

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const APPLY = process.argv.includes('--apply')
const VERBOSE = process.argv.includes('--verbose')

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
const BASE = (env.PUBLIC_PAYLOAD_URL || '').replace(/\/$/, '')
const KEY = env.PAYLOAD_API_KEY
/* The homepage, services and testimonials are public to read, so a dry run
   needs only the address; writing needs the key. */
if (!BASE || (APPLY && !KEY)) {
    console.error(`Need PUBLIC_PAYLOAD_URL${APPLY ? ' and PAYLOAD_API_KEY' : ''} in the repo root .env.`)
    process.exit(2)
}
const headers = { 'Content-Type': 'application/json', ...(KEY ? { Authorization: `users API-Key ${KEY}` } : {}) }

async function api(method, path, body) {
    const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    const text = await res.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch { json = { raw: text.slice(0, 300) } }
    if (!res.ok) {
        const why = json?.errors?.map((e) => e.message + (e.data?.errors ? ` ${JSON.stringify(e.data.errors)}` : '')).join('; ') || json?.message || text.slice(0, 300)
        throw new Error(`${method} ${path}: HTTP ${res.status} ${why}`)
    }
    return json
}

const fail = (msg, code = 1) => {
    console.error(`STOPPED: ${msg}`)
    process.exit(code)
}

/* ------------------------------------------------------------- the target */

const GROUPS = [
    ['dHero', 'hero'], ['dProof', 'proof'], ['dProblem', 'problem'], ['dSolutions', 'solutions'], ['dWork', 'work'],
    ['dProcess', 'process'], ['dPrices', 'prices'], ['dFaq', 'faq'], ['dContact', 'contact'],
]
const DEFAULTS_DIR = join(ROOT, 'src', 'lib', 'homeD')
const defaultsOf = (file) => JSON.parse(readFileSync(join(DEFAULTS_DIR, `${file}.defaults.json`), 'utf8'))

const BADGES = { 'Build it': 'One-off projects', 'Grow it': 'Monthly plans' }
const TEXT_FIXES = {
    trust: {
        from: 'A WhatsApp assistant that replies within a minute, with a record of how fast each one was answered.',
        to: 'A WhatsApp assistant with a first reply in 64 seconds, day or night, and a record of how fast each one was answered.',
    },
    promo: {
        from: 'Every enquiry answered within a minute, day or night, so no buyer goes elsewhere while you sleep.',
        to: 'A first reply in 64 seconds, day or night, so no buyer goes elsewhere while you sleep.',
    },
    aiService: {
        from: 'We set up a WhatsApp assistant that answers every enquiry within a minute, day or night, asks the questions you always ask, and hands the customer to you with the details filled in.',
        to: 'We set up a WhatsApp assistant that answers every enquiry, with a first reply in 64 seconds, day or night. It asks the questions you always ask and hands the customer to you with the details filled in.',
    },
    adsBody: {
        from: 'This service is ads. Regular posts and videos are in our monthly Grow it plans and AI video.',
        to: 'This service is ads. Regular posts and videos are in our monthly plans and AI video.',
    },
}
const AI_SLUG = 'ai-automation'
const ADS_SLUG = 'digital-marketing-social-media'

const proofDefaults = defaultsOf('proof')
const QUOTE = {
    authorName: 'Emmanuel Korsah',
    authorRole: 'CEO, Omek',
    quote: proofDefaults.quote?.text,
    published: true,
}
if (!QUOTE.quote || proofDefaults.quote?.name !== QUOTE.authorName || proofDefaults.quote?.role !== QUOTE.authorRole) {
    fail('src/lib/homeD/proof.defaults.json no longer holds the approved quote by Emmanuel Korsah, CEO, Omek. Nothing done.', 2)
}

/* Roles that may edit the website's words (contentEditors in cms/src/access/roles.ts). */
const CONTENT_ROLES = ['admin', 'editor', 'site']

/* ----------------------------------------------------------------- helpers */

const STRIP = ['id', 'createdAt', 'updatedAt', 'globalType']
const whole = (docIn, over, extraStrip = []) => {
    const out = { ...docIn }
    for (const k of [...STRIP, ...extraStrip]) delete out[k]
    return { ...out, ...over }
}
const clone = (v) => JSON.parse(JSON.stringify(v))
const isEmpty = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
const short = (v, n = 90) => {
    const s = typeof v === 'string' ? v : JSON.stringify(v)
    return s.length > n ? `${s.slice(0, n - 3)}...` : s
}
const show = (v) => (isEmpty(v) ? '(empty)' : JSON.stringify(v))
const row = (field, before, after) => (JSON.stringify(before) === JSON.stringify(after)
    ? `    ${field}: unchanged, ${show(after)}`
    : `    ${field}:\n      before: ${show(before)}\n      after:  ${show(after)}`)

/* Empty values read the same whichever way Payload returns them; key order never matters. */
const norm = (v) => {
    if (Array.isArray(v)) return v.map(norm)
    if (v && typeof v === 'object') {
        const out = {}
        for (const k of Object.keys(v).sort()) {
            if (k === 'updatedAt' || k === 'createdAt') continue
            const n = norm(v[k])
            if (n !== undefined) out[k] = n
        }
        return out
    }
    return isEmpty(v) ? undefined : v
}
const same = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b))
const at = (obj, path) => path.reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj)

/*
  The approved words laid into the CMS group, box by box. A text box is filled
  only when it is empty; a list is filled only when it has no rows. Records
  every filled value (with its path) so the write can be checked afterwards.
*/
function seed(cms, def, path, log) {
    if (Array.isArray(def)) {
        if (Array.isArray(cms) && cms.length) {
            log.kept.push(`${path.join('.')}: ${cms.length} row(s) already in the CMS, list kept as it is`)
            return cms
        }
        if (!def.length) return Array.isArray(cms) ? cms : []
        const rows = clone(def)
        log.lists.push([path.join('.'), rows.length])
        const walk = (v, p) => {
            if (Array.isArray(v)) { log.expect.push([[...p, 'length'], v.length]); v.forEach((x, i) => walk(x, [...p, i])) }
            else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, [...p, k])
            else if (!isEmpty(v)) { log.expect.push([p, v]); log.count++ }
        }
        walk(rows, path)
        return rows
    }
    if (def && typeof def === 'object') {
        const base = cms && typeof cms === 'object' && !Array.isArray(cms) ? { ...cms } : {}
        for (const [k, d] of Object.entries(def)) base[k] = seed(base[k], d, [...path, k], log)
        return base
    }
    if (isEmpty(cms)) {
        if (isEmpty(def)) return cms ?? null
        log.filled.push([path.join('.'), def])
        log.expect.push([path, def])
        log.count++
        return def
    }
    if (cms !== def) log.kept.push(`${path.join('.')}: ${short(cms, 70)} (typed in the CMS, kept)`)
    return cms
}

/* -------------------------------------------------------------------- read */

console.log(APPLY ? 'APPLY: changes will be written.\n' : 'DRY RUN: nothing will be written. Add --apply to write.\n')
console.log(`CMS: ${BASE}\n`)

const [homepage, servicesRes, testimonialsRes] = await Promise.all([
    api('GET', '/api/globals/homepage?depth=0'),
    api('GET', '/api/services?limit=50&depth=0'),
    api('GET', '/api/testimonials?limit=200&depth=0'),
])
const services = servicesRes.docs || []
const testimonials = testimonialsRes.docs || []
if (!homepage || typeof homepage !== 'object' || !Array.isArray(homepage.promoSections)) fail('the CMS did not return the homepage global. Nothing done.', 2)

/* Who the key belongs to, and whether that account may edit content. */
let role = null
if (KEY) {
    try {
        const me = await api('GET', '/api/users/me?depth=0')
        role = me?.user?.role ?? null
        console.log(`API key: ${me?.user?.email || '(unknown account)'}, role "${role}". ${CONTENT_ROLES.includes(role) ? 'May edit the homepage, services and testimonials (contentEditors).' : 'May NOT edit content.'}\n`)
    } catch (err) {
        console.log(`API key: could not ask the CMS who it is (${err.message}).\n`)
    }
} else {
    console.log('API key: none in the environment (fine for a dry run; --apply needs one).\n')
}

/* ------------------------------------------------------------- the changes */

const changes = [] // { what, method, path, body, check: async () => string[] }
const missingGroups = GROUPS.map(([g]) => g).filter((g) => !(g in homepage))
const fieldsReady = missingGroups.length === 0

/* 1. Seed the new home page groups */
const homeOver = {}
const homeExpect = [] // [path, value]
console.log('1. NEW HOME PAGE BOXES (only empty ones are filled)\n')
if (!fieldsReady) {
    console.log(`    The live homepage does not have ${missingGroups.length === GROUPS.length ? 'any of the nine groups' : missingGroups.join(', ')} yet:`)
    console.log('    the CMS deploy with these fields and migration 20261024_111030_home_d_sections have not run.')
    console.log('    Shown below as if every box were empty, which is what they will be once it has.\n')
}
let seedTotal = 0
for (const [group, file] of GROUPS) {
    const log = { filled: [], lists: [], kept: [], expect: [], count: 0 }
    const next = seed(homepage[group], defaultsOf(file), [group], log)
    seedTotal += log.count
    const scalars = log.filled.filter(([p]) => p.split('.').length === 2)
    const nested = log.filled.length - scalars.length
    const parts = [
        `${log.count} box(es) to fill`,
        log.lists.length ? `lists: ${log.lists.map(([p, n]) => `${p.slice(group.length + 1)} (${n} rows)`).join(', ')}` : '',
        nested ? `${nested} box(es) inside groups` : '',
    ].filter(Boolean)
    console.log(`  ${group} from ${file}.defaults.json: ${log.count ? parts.join('; ') : 'nothing to fill'}`)
    for (const [p, v] of VERBOSE ? log.filled : scalars) console.log(`      ${p.slice(group.length + 1)}: (empty) -> ${JSON.stringify(short(v))}`)
    if (VERBOSE) for (const [p, v] of log.expect.filter(([q]) => !log.filled.some(([f]) => f === q.join('.')))) console.log(`      ${p.slice(1).join('.')}: ${JSON.stringify(short(v))}`)
    for (const k of log.kept) console.log(`      kept: ${k}`)
    if (log.count) {
        homeOver[group] = next
        homeExpect.push(...log.expect)
    }
}
console.log('')

/* 2. Words on the homepage */
console.log('2. LABELS AND THE 64-SECOND WORDING\n')
const homeChanges = []
{
    const rows = homepage.promoSections || []
    let badges = 0
    let promoBody = false
    const nextRows = rows.map((r, i) => {
        const to = BADGES[r.badge]
        if (to) {
            console.log(row(`homepage promoSections[${i}].badge (${r.visual || r.heading || 'card'})`, r.badge, to))
            homeExpect.push([['promoSections', i, 'badge'], to])
            badges++
            return { ...r, badge: to }
        }
        if (Object.values(BADGES).includes(r.badge)) console.log(`    homepage promoSections[${i}].badge: already "${r.badge}"`)
        return r
    })
    const promoIdx = nextRows.findIndex((r) => r.body === TEXT_FIXES.promo.from)
    if (promoIdx >= 0) {
        console.log(row(`homepage promoSections[${promoIdx}].body`, nextRows[promoIdx].body, TEXT_FIXES.promo.to))
        nextRows[promoIdx] = { ...nextRows[promoIdx], body: TEXT_FIXES.promo.to }
        homeExpect.push([['promoSections', promoIdx, 'body'], TEXT_FIXES.promo.to])
        promoBody = true
    } else if (rows.some((r) => r.body === TEXT_FIXES.promo.to)) {
        console.log('    homepage promoSections body: already the 64-second wording')
    } else {
        console.log('    homepage promoSections body: no card reads the old sentence exactly; left alone')
    }
    if (badges || promoBody) {
        homeOver.promoSections = nextRows
        if (badges) homeChanges.push(`${badges} promo card badge(s) renamed`)
        if (promoBody) homeChanges.push('the AI automation promo card text')
    }

    const trust = homepage.trustHighlights || []
    const ti = trust.findIndex((r) => r.description === TEXT_FIXES.trust.from)
    if (ti >= 0) {
        console.log(row(`homepage trustHighlights[${ti}].description (${trust[ti].title})`, trust[ti].description, TEXT_FIXES.trust.to))
        homeOver.trustHighlights = trust.map((r, i) => (i === ti ? { ...r, description: TEXT_FIXES.trust.to } : r))
        homeExpect.push([['trustHighlights', ti, 'description'], TEXT_FIXES.trust.to])
        homeChanges.push('the "Every enquiry answered" highlight')
    } else if (trust.some((r) => r.description === TEXT_FIXES.trust.to)) {
        console.log('    homepage trustHighlights: already the 64-second wording')
    } else {
        console.log('    homepage trustHighlights: no row reads the old sentence exactly; left alone')
    }
}

if (Object.keys(homeOver).length) {
    const seeded = GROUPS.map(([g]) => g).filter((g) => homeOver[g])
    const touchedKeys = Object.keys(homeOver)
    changes.push({
        what: `homepage: ${[seeded.length ? `fill ${seedTotal} empty box(es) in ${seeded.join(', ')}` : '', ...homeChanges].filter(Boolean).join('; ')}`,
        method: 'POST',
        path: '/api/globals/homepage',
        body: whole(homepage, homeOver),
        check: async () => {
            const after = await api('GET', '/api/globals/homepage?depth=0')
            const bad = []
            for (const [p, v] of homeExpect) {
                const got = p[p.length - 1] === 'length' ? at(after, p.slice(0, -1))?.length : at(after, p)
                if (got !== v) bad.push(`${p.join('.')} is ${show(got)}, expected ${show(v)}`)
            }
            for (const k of Object.keys(homepage)) {
                if (touchedKeys.includes(k) || STRIP.includes(k)) continue
                if (!same(homepage[k], after[k])) bad.push(`${k} changed although this script did not touch it`)
            }
            return bad
        },
    })
}

/* Services */
const serviceFix = (slug, label, make) => {
    const svc = services.find((s) => s.slug === slug)
    if (!svc) { console.log(`    ${label}: no service with slug ${slug}; left alone`); return }
    const result = make(svc)
    if (!result) return
    const { over, verify } = result
    changes.push({
        what: `services #${svc.id} (${svc.title}): ${result.what}`,
        method: 'PATCH',
        path: `/api/services/${svc.id}`,
        body: whole(svc, over, ['slug']),
        check: async () => {
            const after = await api('GET', `/api/services/${svc.id}?depth=0`)
            const bad = verify(after)
            if (after.slug !== svc.slug) bad.push(`slug became "${after.slug}"`)
            for (const k of Object.keys(svc)) {
                if (k in over || STRIP.includes(k)) continue
                if (!same(svc[k], after[k])) bad.push(`${k} changed although this script did not touch it`)
            }
            return bad
        },
    })
}

serviceFix(AI_SLUG, 'AI automation description', (svc) => {
    if (svc.description === TEXT_FIXES.aiService.from) {
        console.log(row(`services #${svc.id} (${svc.title}) description`, svc.description, TEXT_FIXES.aiService.to))
        return {
            what: 'description takes the 64-second wording',
            over: { description: TEXT_FIXES.aiService.to },
            verify: (after) => (after.description === TEXT_FIXES.aiService.to ? [] : ['description']),
        }
    }
    console.log(`    services #${svc.id} (${svc.title}) description: ${svc.description === TEXT_FIXES.aiService.to ? 'already the 64-second wording' : 'does not read the old sentence exactly; left alone'}`)
    return null
})

serviceFix(ADS_SLUG, 'Growth & Performance Marketing page text', (svc) => {
    const body = typeof svc.body === 'string' ? JSON.parse(svc.body) : svc.body
    if (!body || typeof body !== 'object') { console.log(`    services #${svc.id} body: empty; left alone`); return null }
    const next = clone(body)
    const hits = []
    const walk = (node, p) => {
        if (!node || typeof node !== 'object') return
        if (node.type === 'text' && node.text === TEXT_FIXES.adsBody.from) { node.text = TEXT_FIXES.adsBody.to; hits.push(p) }
        if (Array.isArray(node.children)) node.children.forEach((c, i) => walk(c, `${p}.children[${i}]`))
    }
    walk(next.root, 'root')
    if (hits.length !== 1) {
        const already = JSON.stringify(body).includes(JSON.stringify(TEXT_FIXES.adsBody.to))
        console.log(`    services #${svc.id} (${svc.title}) body: ${hits.length > 1 ? `the sentence appears ${hits.length} times; left alone` : already ? 'already says "monthly plans"' : 'no text node reads the old sentence exactly; left alone'}`)
        return null
    }
    console.log(row(`services #${svc.id} (${svc.title}) body, text node ${hits[0]}`, TEXT_FIXES.adsBody.from, TEXT_FIXES.adsBody.to))
    return {
        what: 'page text "monthly Grow it plans" becomes "monthly plans" (one text node)',
        over: { body: typeof svc.body === 'string' ? JSON.stringify(next) : next },
        verify: (after) => {
            const got = typeof after.body === 'string' ? JSON.parse(after.body) : after.body
            return same(got, next) ? [] : ['body']
        },
    }
})
console.log('')

/* 3. The client quote */
console.log('3. THE CLIENT QUOTE (testimonials)\n')
const existing = testimonials.filter((t) => String(t.authorName || '').trim().toLowerCase() === QUOTE.authorName.toLowerCase())
if (existing.length) {
    for (const t of existing) {
        const sameQuote = t.quote === QUOTE.quote
        console.log(`    testimonial #${t.id} by ${t.authorName} already exists (role ${show(t.authorRole)}, ${t.published ? 'published' : 'NOT published'}, quote ${sameQuote ? 'word for word' : 'differs from the approved words'}); left as it is`)
    }
} else {
    console.log('    no testimonial by Emmanuel Korsah yet; will create:')
    console.log(`      authorName: ${JSON.stringify(QUOTE.authorName)}`)
    console.log(`      authorRole: ${JSON.stringify(QUOTE.authorRole)}`)
    console.log(`      quote:      ${JSON.stringify(QUOTE.quote)}`)
    console.log('      published:  true')
    changes.push({
        what: 'testimonials: create the approved quote by Emmanuel Korsah, CEO, Omek, published',
        method: 'POST',
        path: '/api/testimonials',
        body: QUOTE,
        check: async () => {
            const found = (await api('GET', `/api/testimonials?limit=10&depth=0&where[authorName][equals]=${encodeURIComponent(QUOTE.authorName)}`)).docs || []
            if (found.length !== 1) return [`expected one testimonial by ${QUOTE.authorName}, found ${found.length}`]
            const t = found[0]
            return ['authorName', 'authorRole', 'quote', 'published'].filter((k) => t[k] !== QUOTE[k])
        },
    })
}
console.log('')

/* ------------------------------------------------------------------ report */

console.log(`${changes.length} write(s):`)
for (const [i, c] of changes.entries()) console.log(`  ${i + 1}. ${c.what}`)
console.log('')
if (!fieldsReady) {
    console.log('The live CMS does not have the new home page groups yet. Deploy the CMS and run migration')
    console.log('20261024_111030_home_d_sections before --apply; until then Payload would drop them and answer 200.\n')
}

if (!APPLY) {
    console.log('Dry run. Nothing written. Run with --apply to write these.')
    process.exit(0)
}
if (!changes.length) {
    console.log('Nothing to do.')
    process.exit(0)
}
if (!fieldsReady) fail('the new home page groups are not live. Nothing written.', 2)
if (!CONTENT_ROLES.includes(role)) fail(`the API key's account (role "${role}") may not edit content. Nothing written.`, 2)

const backupFile = join(HERE, 'home-d-launch-copy-2026-10-backup.json')
writeFileSync(backupFile, JSON.stringify({ takenAt: new Date().toISOString(), homepage, services: services.filter((s) => [AI_SLUG, ADS_SLUG].includes(s.slug)), testimonials }, null, 2))
console.log(`Backup of everything read: ${backupFile}\n`)

/* One write at a time, each read back and checked before the next. */
for (const [i, c] of changes.entries()) {
    let bad
    try {
        await api(c.method, c.path, c.body)
        bad = await c.check().catch((err) => [`could not read it back: ${err.message}`])
    } catch (err) {
        console.error(`\nFAILED at ${i + 1}/${changes.length}: ${c.what}\n  ${err.message}`)
        console.error(`\n${i} write(s) before it were made and checked. The backup is ${backupFile}.`)
        process.exit(1)
    }
    if (bad.length) {
        console.error(`\nWRITTEN BUT NOT AS EXPECTED at ${i + 1}/${changes.length}: ${c.what}`)
        for (const b of bad.slice(0, 20)) console.error(`    ${b}`)
        if (bad.length > 20) console.error(`    ... and ${bad.length - 20} more`)
        console.error(`\nStopped before the rest. Is the CMS deploy and migration live? The backup is ${backupFile}.`)
        process.exit(1)
    }
    console.log(`  written and read back ${i + 1}/${changes.length}  ${c.what}`)
}
console.log(`\nAll ${changes.length} write(s) made and read back. Allow a minute for the site's cache.`)
