#!/usr/bin/env node
/*
  The five automated emails in Resend, brought in line with the services
  restructure (Ernest, 20 October 2026: "go", with "we" as recommended).

  - Every email speaks as "we", like the website, instead of "I". Ernest still
    signs them and is still named as the main contact.
  - Nurture Day 3 listed four services, one of them Branding (retired on
    19 October) and one "SEO & Paid Ads" selling Shopping campaigns. It now
    lists the six services we sell, in the website's own words.
  - The WhatsApp links start "Hi Quadem", as the website's do.

  Dry run by default: prints each change and writes before/after HTML to
  --out=<dir> for a look. --live updates each template and publishes it
  (a Resend update alone only makes an unpublished draft; the live copy keeps
  sending until it is published), then reads it back.

  Every replacement must find its text exactly once, or the run stops before
  writing anything, so an email edited in Resend since is never half-changed.
  The published HTML of all five is backed up to
  lead-emails-we-2026-10-backup.json first (gitignored).

  Run:
    node cms/scripts/lead-emails-we-2026-10.mjs --out=/tmp/emails
    node cms/scripts/lead-emails-we-2026-10.mjs --live
*/

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const LIVE = process.argv.includes('--live')
const OUT = (process.argv.find((x) => x.startsWith('--out=')) || '').slice('--out='.length)

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
if (!env.RESEND_API_KEY) {
    console.error('Need RESEND_API_KEY in the repo root .env.')
    process.exit(2)
}
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` }

async function api(method, path, body) {
    const res = await fetch(`https://api.resend.com${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    const text = await res.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch { json = { raw: text.slice(0, 300) } }
    if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${json?.message || text.slice(0, 300)}`)
    return json
}

const card = (title, body) => `<td width="48%" style="background:#E8F6FB;border-left:4px solid #00B4D8;border-radius:6px;padding:16px 18px;vertical-align:top;">
          <p style="color:#0D1B6E;font-size:13px;font-weight:700;margin:0 0 6px;letter-spacing:1px;">${title}</p>
          <p style="color:#333;font-size:13px;line-height:1.6;margin:0;">${body}</p>
        </td>`
const row = (a, b) => `<tr>
        ${card(...a)}
        <td width="4%"></td>
        ${card(...b)}
      </tr>`
const SERVICES = [
    ['WEBSITES', 'Fast, clear websites that turn visitors into enquiries and sales, from one page to a full online shop.'],
    ['AI AUTOMATION', 'A WhatsApp assistant that answers every enquiry within a minute, day or night, and hands it to you with the details filled in.'],
    ['AI VIDEO &amp; REELS', 'Reels, ads and product videos made with AI from your logo and products. No camera, no crew, no shoot day.'],
    ['SEO &amp; CONTENT', 'Show up on Google when people search for what you sell, with a report every month on where you rank.'],
    ['GROWTH &amp; ADS', 'Ads on Facebook, Instagram and Google, judged on enquiries and sales, with what each enquiry cost reported every month.'],
    ['FIELDWORK', 'A list every month of businesses that match your best customers, each with a checked email and a reason to contact them now.'],
]
const SIX_CARDS = `<!-- Result cards -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${row(SERVICES[0], SERVICES[1])}
      <tr><td colspan="3" style="padding-top:12px;"></td></tr>
      ${row(SERVICES[2], SERVICES[3])}
      <tr><td colspan="3" style="padding-top:12px;"></td></tr>
      ${row(SERVICES[4], SERVICES[5])}
    </table>`

// [from, to] pairs, applied to the HTML. A `from` that is a RegExp must match once.
const PLAN = {
    'lead-auto-reply': {
        subject: ['Got your message, I will be in touch soon', 'Got your message, we will be in touch soon'],
        html: [
            ['I have received your message and will get back to you within', 'We have received your message and will get back to you within'],
            ['want to jump straight into a conversation, WhatsApp me directly:', 'want to jump straight into a conversation, message us on WhatsApp:'],
            ['I review your message and prepare relevant questions', 'We read your message and prepare the right questions'],
            ['I reply within 24 hours with next steps or a discovery call invite', 'We reply within 24 hours with next steps or an invitation to a call'],
            ['We agree on scope and I send you a tailored proposal', 'We agree what you need and send you a written proposal with a fixed price'],
            ['text=Hi%20Ernest%2C%20I%20just%20filled%20your%20contact%20form.', 'text=Hi%20Quadem%2C%20I%20just%20filled%20in%20your%20contact%20form.'],
        ],
    },
    'nurture-day-1-follow-up': {
        html: [
            ['I wanted to follow up after your message yesterday. Most people who reach out have a specific problem they want solved, and I want to make sure we actually talk about yours.', 'We wanted to follow up after your message yesterday. Most people who reach out have a specific problem they want solved, and we want to make sure we talk about yours.'],
            ['Or reply to this email directly. I read every message.', 'Or reply to this email directly. We read every message.'],
            ['text=Hi%20Ernest%2C%20I%27d%20like%20to%20book%20a%20discovery%20call.', 'text=Hi%20Quadem%2C%20I%27d%20like%20to%20book%20a%20call.'],
        ],
    },
    'nurture-day-3-social-proof': {
        html: [
            ['I know choosing a digital agency is a big decision. So instead of telling you how good we are, let me show you what we have actually built.', 'Choosing who to work with is a big decision. So instead of telling you how good we are, here is what we do, and what each part is built to bring you.'],
            [/<!-- Result cards -->[\s\S]*?<\/table>/, SIX_CARDS],
            ['>View Our Portfolio<', '>See our work<'],
        ],
    },
    'nurture-day-7-last-check-in': {
        html: [
            ['I will keep this short.', 'We will keep this short.'],
            ['This is my last email. You reached out a week ago and I want to make sure you got what you needed, whether that is from us or somewhere else.', 'This is our last email. You reached out a week ago and we want to make sure you got what you needed, whether that is from us or somewhere else.'],
            ['Either way, I wish you and your business all the best.', 'Either way, we wish you and your business all the best.'],
            ['text=Hi%20Ernest%2C%20I%27m%20ready%20to%20talk%20about%20my%20project.', 'text=Hi%20Quadem%2C%20I%27m%20ready%20to%20talk%20about%20my%20project.'],
        ],
    },
    'client-onboarding-welcome': {
        html: [
            ['I am genuinely excited to get started on this project with you.', 'We are genuinely excited to get started on this project with you.'],
            ['Save my WhatsApp number: +233 530 890 302', 'Save our WhatsApp number: +233 530 890 302'],
            ['Any questions at any point, WhatsApp is the fastest way to reach me. I respond within a few hours during business days.', 'Any questions at any point, WhatsApp is the fastest way to reach us. We reply within a few hours on business days.'],
            ['Message Me on WhatsApp', 'Message us on WhatsApp'],
            ['text=Hi%20Ernest%2C%20I%20just%20received%20the%20onboarding%20email.', 'text=Hi%20Quadem%2C%20I%20just%20received%20the%20onboarding%20email.'],
        ],
    },
}

const once = (hay, from) => {
    if (from instanceof RegExp) { const all = hay.match(new RegExp(from.source, 'g')) || []; return all.length }
    return hay.split(from).length - 1
}

console.log(LIVE ? 'LIVE RUN: templates will be updated and published.\n' : 'DRY RUN: nothing will be written. Add --live to write.\n')

const list = await api('GET', '/templates?limit=100')
const templates = {}
for (const t of list.data || []) {
    const slug = t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    if (PLAN[slug]) templates[slug] = await api('GET', `/templates/${t.id}`)
}
const missing = Object.keys(PLAN).filter((s) => !templates[s])
if (missing.length) { console.error(`STOPPED: templates not found: ${missing.join(', ')}`); process.exit(1) }

const backupFile = join(HERE, 'lead-emails-we-2026-10-backup.json')
if (LIVE || !existsSync(backupFile)) writeFileSync(backupFile, JSON.stringify({ takenAt: new Date().toISOString(), templates }, null, 2))

const updates = []
const problems = []
for (const [slug, plan] of Object.entries(PLAN)) {
    const t = templates[slug]
    let html = t.html
    for (const [from, to] of plan.html) {
        const n = once(html, from)
        if (n !== 1) { problems.push(`${t.name}: expected 1 match of ${String(from).slice(0, 70)}, found ${n}`); continue }
        html = html.replace(from, to)
    }
    let subject = t.subject
    if (plan.subject) {
        if (subject !== plan.subject[0]) problems.push(`${t.name}: subject is "${subject}", expected "${plan.subject[0]}"`)
        else subject = plan.subject[1]
    }
    if (/\u2014|\u2013/.test(html + subject)) problems.push(`${t.name}: the new copy contains an em or en dash`)
    updates.push({ id: t.id, name: t.name, slug, subject, html, before: t.html, draftPending: t.has_unpublished_versions })
    console.log(`${t.name}: ${plan.html.length} changes${plan.subject ? ' + subject' : ''}${t.has_unpublished_versions ? ' (replaces an unpublished draft)' : ''}`)
}
if (problems.length) { console.error(`\nSTOPPED, nothing written:\n  ${problems.join('\n  ')}`); process.exit(1) }

if (OUT) {
    mkdirSync(OUT, { recursive: true })
    for (const u of updates) { writeFileSync(join(OUT, `${u.slug}.before.html`), u.before); writeFileSync(join(OUT, `${u.slug}.after.html`), u.html) }
    console.log(`\nBefore/after HTML written to ${OUT}.`)
}
if (!LIVE) { console.log('\nDry run. Nothing written. Run with --live to update and publish.'); process.exit(0) }

for (const u of updates) {
    try {
        await api('PATCH', `/templates/${u.id}`, { subject: u.subject, html: u.html })
        await api('POST', `/templates/${u.id}/publish`)
        const back = await api('GET', `/templates/${u.id}`)
        const ok = back.html === u.html && back.subject === u.subject && !back.has_unpublished_versions
        console.log(`  ${ok ? 'published' : 'CHECK BY HAND'}  ${u.name}`)
        if (!ok) process.exitCode = 1
    } catch (err) {
        console.error(`\nFAILED on ${u.name}: ${err.message}\nThe backup is ${backupFile}.`)
        process.exit(1)
    }
}
