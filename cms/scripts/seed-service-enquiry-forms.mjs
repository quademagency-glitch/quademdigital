#!/usr/bin/env node
/*
  Writes the starting question set for each service's enquiry form.

  These are a starting point, not a fixture. The whole reason the questions live
  in the CMS is that Ernest rewords them in the admin as he learns which ones
  actually decide a quote, without a deploy and without asking anyone.

  Three per service at most. The form already asks for a name, an email, a
  message and a budget, so seven fields is the ceiling before a service page
  starts feeling like a credit application. Each question below is one Ernest
  would otherwise have to ask on a first call.

  Keys are set explicitly and short. They are what the answers are filed under
  in Leads.metadata.answers, and they stay put when a question is reworded, so
  a lead from today and a lead from six months ago are still comparable. Leave
  a key alone once it has collected anything.

  Requires the enquiry form schema to be migrated AND the CMS app on Railway to
  be redeployed. Payload drops fields the running app does not declare, so
  without the deploy this writes nothing and says so rather than reporting
  success. See "A migration is half the job" in cms/CLAUDE.md.

  Run:
    node cms/scripts/seed-service-enquiry-forms.mjs --dry-run
    node cms/scripts/seed-service-enquiry-forms.mjs
*/

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
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

const pick = (label, key, ...choices) => ({
    label,
    key,
    inputType: 'choice',
    required: true,
    choices: choices.map((choice) => ({ choice })),
})
const short = (label, key, placeholder, required = true) => ({
    label,
    key,
    inputType: 'text',
    required,
    placeholder,
})
const long = (label, key, placeholder, required = true) => ({
    label,
    key,
    inputType: 'longtext',
    required,
    placeholder,
})

const FORMS = {
    'web-design-development': {
        heading: 'Tell me about the website',
        intro: 'Three questions, then how to reach you. I will come back with what it takes and what it costs.',
        questionsHeading: 'About the site',
        buttonLabel: 'Send enquiry',
        questions: [
            pick(
                'Do you have a website already?',
                'existing-site',
                'No, this would be the first',
                'Yes, and it needs replacing',
                'Yes, and it needs fixing rather than replacing',
            ),
            pick(
                'What does it mainly need to do?',
                'primary-job',
                'Explain what I do and bring in enquiries',
                'Sell products online',
                'Take bookings or appointments',
                'Something else',
            ),
            pick('When would you want it live?', 'timing', 'As soon as possible', 'Within a month or two', 'Later this year', 'No fixed date'),
        ],
    },

    'seo-paid-ads': {
        heading: 'Tell me about the site you want found',
        intro: 'I need the address to look at anything useful, so that one is required.',
        questionsHeading: 'About your search presence',
        buttonLabel: 'Send enquiry',
        questions: [
            short('What is the web address?', 'site-url', 'yourbusiness.com'),
            short('What should someone be typing into Google to find you?', 'target-search', 'For example: bridal shop in Accra'),
            pick('Are you running paid ads at the moment?', 'paid-ads', 'No, never have', 'Not now, but I have before', 'Yes, and I want them working harder'),
        ],
    },

    'branding-graphic-design': {
        heading: 'Tell me about the brand',
        intro: 'Where you are starting from changes the job more than anything else, so that is the first question.',
        questionsHeading: 'About the brand',
        buttonLabel: 'Send enquiry',
        questions: [
            pick(
                'Where are you starting from?',
                'starting-point',
                'Nothing yet, the business is new',
                'A logo, but nothing built around it',
                'A full brand that has stopped fitting',
            ),
            pick('What does it need to work on first?', 'first-surface', 'A website', 'Signage and print', 'Social media', 'Packaging or the product itself'),
            pick('Do you have the name settled?', 'name-settled', 'Yes, settled', 'Yes, but I am open to changing it', 'Not yet'),
        ],
    },

    'video-production': {
        heading: 'Tell me what you want to post',
        intro: 'No shoot day and no crew, so the answers below are most of what I need to price it.',
        questionsHeading: 'About the videos',
        buttonLabel: 'Send enquiry',
        questions: [
            pick('How often do you want to be posting?', 'cadence', 'One batch, to try it', 'A few each month', 'Every week'),
            pick('What are the videos mainly for?', 'video-purpose', 'Selling a product', 'Explaining a service', 'Building the brand', 'Paid ads'),
            pick('Do you have photographs of the product already?', 'has-assets', 'Yes, plenty', 'A few', 'None yet'),
        ],
    },

    'digital-marketing-social-media': {
        heading: 'Tell me about your pages',
        intro: 'The strategy comes before the calendar, so these are about who you are trying to reach.',
        questionsHeading: 'About your social presence',
        buttonLabel: 'Send enquiry',
        questions: [
            pick('Where are your customers actually looking?', 'platforms', 'Instagram and Facebook', 'TikTok', 'LinkedIn', 'I am not sure yet'),
            pick('Who is posting at the moment?', 'who-posts', 'Nobody, it has gone quiet', 'Me, when I remember', 'Someone on the team', 'An agency'),
            long('What would a good three months look like?', 'success-looks-like', 'More enquiries, a fuller shop, better applicants: whatever it is for you.'),
        ],
    },

    'ai-automation': {
        heading: 'Tell me where your enquiries arrive',
        intro: 'The assistant answers in seconds and hands over to you. These three answers are what shape it.',
        questionsHeading: 'About your enquiries',
        buttonLabel: 'Send enquiry',
        questions: [
            pick('Where do most enquiries come in?', 'channel', 'WhatsApp', 'Instagram or Facebook messages', 'Phone calls', 'Email', 'A mix of everything'),
            pick('Roughly how many a week?', 'volume', 'Under 10', '10 to 50', '50 to 200', 'More than 200'),
            long(
                'What do you end up asking almost every one of them?',
                'repeat-questions',
                'The questions you answer over and over. Those are the ones worth automating.',
            ),
        ],
    },

    fieldwork: {
        heading: 'Tell me who you want to reach',
        intro: 'The more exact the description, the better the list. Vague in, vague out.',
        questionsHeading: 'About the list',
        buttonLabel: 'Send enquiry',
        questions: [
            long(
                'Describe the businesses you want, as exactly as you can',
                'target-description',
                'For example: dental clinics in Accra with fewer than ten staff and no working website.',
            ),
            short('Which towns or regions?', 'area', 'Accra, Kumasi, or anywhere in Ghana'),
            pick('How many do you want each month?', 'monthly-volume', 'Around 50', 'Around 100', 'Around 250', 'Not sure, tell me what is sensible'),
        ],
    },
}

/* --------------------------------------------------------------------- run */

const res = await fetch(`${BASE}/api/services?depth=0&limit=50&sort=order`, { headers })
if (!res.ok) {
    console.error(`Could not read services: HTTP ${res.status}`)
    process.exit(1)
}
const docs = (await res.json()).docs || []
const bySlug = new Map(docs.map((d) => [d.slug, d]))

const missing = Object.keys(FORMS).filter((s) => !bySlug.has(s))
if (missing.length) {
    console.error(`No service with slug: ${missing.join(', ')}`)
    process.exit(1)
}

if (!DRY) {
    writeFileSync(
        join(HERE, 'service-enquiry-forms-backup.json'),
        JSON.stringify(
            Object.keys(FORMS).map((slug) => ({ slug, enquiryForm: bySlug.get(slug).enquiryForm ?? null })),
            null,
            2,
        ),
    )
}

let failed = 0

for (const [slug, enquiryForm] of Object.entries(FORMS)) {
    const doc = bySlug.get(slug)
    const already = (doc.enquiryForm?.questions || []).length
    console.log(`${slug}`)
    console.log(`  questions now: ${already}   after: ${enquiryForm.questions.length}`)
    enquiryForm.questions.forEach((q) => console.log(`    ${q.key.padEnd(20)} ${q.label}`))

    if (already > 0) {
        console.log('  SKIPPED: questions already exist here, not overwriting what someone wrote.')
        continue
    }
    if (DRY) continue

    const r = await fetch(`${BASE}/api/services/${doc.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ enquiryForm }),
    })
    const out = await r.json()
    if (!r.ok) {
        console.error(`  FAILED HTTP ${r.status}: ${JSON.stringify(out).slice(0, 400)}`)
        failed += 1
        continue
    }

    /*
      A 200 proves nothing on its own. If the deployed CMS has not been rebuilt
      with these fields it accepts the write, drops them, and answers happily.
    */
    const saved = out.doc?.enquiryForm?.questions?.length ?? 0
    if (saved !== enquiryForm.questions.length) {
        console.error(`  FAILED silently: ${saved} question(s) came back, expected ${enquiryForm.questions.length}.`)
        console.error('  The CMS app on Railway has not been redeployed with the enquiry form fields.')
        failed += 1
        continue
    }
    const keys = (out.doc.enquiryForm.questions || []).map((q) => q.key)
    if (keys.some((k) => !k)) {
        console.error('  FAILED: a question came back without a key, so the page would drop it.')
        failed += 1
        continue
    }
    console.log('  written')
}

if (DRY) {
    console.log('\nDry run. Nothing was written.')
    process.exit(0)
}
if (failed) {
    console.error(`\n${failed} service(s) did not save.`)
    process.exit(1)
}
console.log('\nAll seven have questions. The edge cache holds public pages for 60 seconds.')
