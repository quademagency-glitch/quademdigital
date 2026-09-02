#!/usr/bin/env node
/*
  Prices for the two services that have none.

  ############################################################################
  #  THESE NUMBERS ARE A PROPOSAL. THEY HAVE NOT BEEN APPROVED.              #
  #  Nothing is written without --confirm. The default is a dry run.         #
  ############################################################################

  AI Automation and Digital Marketing showed no price anywhere on the site. Not
  a wrong figure: no figure, on two of the seven things Quadem sells, while the
  homepage next door showed cards from $3,000. Found 2 September 2026.

  WHERE THE SHAPE OF EACH LADDER COMES FROM

  Not from a guess about what these services are. From what the two pages
  already say about themselves, live, in Ernest's own words.

  AI Automation is a one-off build with no monthly fee, and the page says so
  outright:

      "The build is the cost. Running it is close to nothing, and I would
       rather say that plainly than sell you a monthly fee for something that
       mostly sits still."

  So a monthly tier here would contradict the page. One build tier, and Custom
  for anything past the standard three-question assistant. The note repeats the
  running-cost line, because a visitor comparing this against a subscription
  product needs to see it beside the number, not four scrolls further down.

  Digital Marketing splits naturally in two, and again the page draws the line:
  the written buyer profiles come first and are a one-off piece of work, and the
  calendar and page management that follow are ongoing. The page says the
  profiles are the input and the calendar is the output, so they are priced in
  that order.

  WHERE THE NUMBERS COME FROM

  Every figure below already exists somewhere on the site. Nothing is a new
  price point.

      $3,000 one-off    the entry one-off everywhere: Landing Page, Logo
                        Design, and the /global website build. Also Ernest's
                        floor, set 2 September 2026: nothing one-off under
                        $3,000, because roughly a thousand cold emails point at
                        /global and a cheaper one-off elsewhere undercuts it.
      $1,500 a month    the entry monthly: Local SEO and Video Starter both sit
                        here, as does the published Video retainer.
      Custom            what the third tier already is on web design, SEO and
                        brand identity.

  THE CEDI COLUMN IS THE WEAK PART, AND IT IS DELIBERATE

  GH₵ 2,500 matches the Landing Page and the Ghana Starter bundle; GH₵ 1,800
  matches Video Starter. But the cedi ladder across the whole site is currently
  incoherent: cedis per dollar runs from 0.33 on a logo to 3.00 on Fieldwork
  leads, a nine fold spread, so "consistent with the cedi ladder" is not a thing
  that can be true yet. See docs/pricing-audit-2026-09-02.md.

  These two are placed against the tiers a Ghanaian buyer would actually compare
  them with. They should be revisited when the cedi audit is settled.

  BEFORE THIS CAN WRITE ANYTHING

  1. Ernest approves or corrects the numbers.
  2. `cd cms && pnpm migrate` applies 20260902_153000_add_service_pricing_tiers
     to production Postgres.
  3. The CMS on Railway is redeployed with the updated Services.ts.

  Step 3 is not optional. Until it ships, Payload does not know these fields
  exist: it strips them from the write and omits them from the read, silently,
  answering 200 the whole time. That is why this reads every tier back and
  compares it rather than trusting the status code.

  Run:
    node cms/scripts/set-ai-automation-and-marketing-prices.mjs
        prints the proposal and writes nothing.

    node cms/scripts/set-ai-automation-and-marketing-prices.mjs --confirm
        writes it, only once the three steps above are done.
*/

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
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

const PROPOSAL = {
    'ai-automation': {
        heading: 'What it costs',
        subtitle:
            'One build, no subscription. The assistant answers inside the window a customer opened themselves, so there is no message traffic to pay for and nothing running between enquiries.',
        note: 'A starting point, not a rate card. What you pay depends on how many questions the assistant has to ask and what it has to write into, and I will tell you if an assistant is the wrong thing for your business rather than build one.',
        plans: [
            {
                name: 'The build',
                price: 'GH₵ 2,500',
                priceUsd: 'from $3,000',
                period: 'one off',
                description:
                    'The assistant answering on WhatsApp, the three qualifying questions, and every answer written into a database you can sort and filter.',
                isPopular: true,
                features: [
                    { feature: 'Replies the moment a message arrives, day or night' },
                    { feature: 'Three qualifying questions, then it stops and hands over' },
                    { feature: 'Every lead written into a database, not left in a chat thread' },
                    { feature: 'The time from first message to qualified lead, recorded' },
                    { feature: 'Nothing to pay for between enquiries' },
                ],
            },
            {
                name: 'Beyond the standard build',
                price: 'Custom',
                priceUsd: 'Custom',
                period: 'per project',
                description:
                    'More than three questions, more than one channel, or writing into a system you already run. Priced once I know what it has to talk to.',
                isPopular: false,
                features: [],
            },
        ],
    },
    'digital-marketing-social-media': {
        heading: 'What it costs',
        subtitle:
            'The buyer profiles come first and are a piece of work in their own right. The calendar and the page management come out of them, and run monthly.',
        note: 'A starting point, not a rate card. The profiles are the part that changes what everything else costs, and I will tell you if you already have them.',
        plans: [
            {
                name: 'The buyer profiles',
                price: 'GH₵ 2,500',
                priceUsd: 'from $3,000',
                period: 'one off',
                description:
                    'Written profiles of who actually buys, what makes them buy today, and what they need to see before they trust the price. The document the targeting, the creative and the offers all come out of.',
                isPopular: false,
                features: [
                    { feature: 'Income band, cities and what triggers the purchase' },
                    { feature: 'What they are afraid of, and what they actually buy' },
                    { feature: 'Written down before a single post is drafted' },
                    { feature: 'Yours to keep, and it outlasts any campaign' },
                ],
            },
            {
                name: 'Calendar and page',
                price: 'GH₵ 1,800',
                priceUsd: 'from $1,500',
                period: 'a month',
                description:
                    'A content calendar so the page does not go quiet for three weeks then post five times in a day, and someone answering comments and messages rather than letting them pile up.',
                isPopular: true,
                features: [
                    { feature: 'A content calendar built from the profiles' },
                    { feature: 'Comments and messages answered, not accumulated' },
                    { feature: 'Every post traceable to a person it was written for' },
                    { feature: 'Rolling monthly' },
                ],
            },
            {
                name: 'Ads on top',
                price: 'Custom',
                priceUsd: 'Custom',
                period: 'a month',
                description:
                    'Paid campaigns run against the same profiles. Priced on the spend and the number of audiences, and quoted separately from the ad budget itself.',
                isPopular: false,
                features: [],
            },
        ],
    },
}

function show() {
    console.log('')
    console.log('  A PROPOSAL. Nothing below is approved and nothing is written without --confirm.')
    console.log('')
    for (const [slug, section] of Object.entries(PROPOSAL)) {
        console.log(`  /services/${slug}/`)
        console.log(`     ${section.heading}: ${section.subtitle.slice(0, 76)}...`)
        for (const p of section.plans) {
            console.log(`       ${String(p.name).padEnd(26)} ${String(p.priceUsd).padEnd(14)} ${String(p.price).padEnd(12)} ${p.period}`)
        }
        console.log('')
    }
}

show()

if (!CONFIRM) {
    console.log('  Dry run. Nothing was written.')
    console.log('')
    console.log('  Before --confirm can work:')
    console.log('    1. Ernest approves or corrects these numbers.')
    console.log('    2. cd cms && pnpm migrate')
    console.log('    3. Redeploy the CMS on Railway with the updated Services.ts.')
    process.exit(0)
}

let failed = 0
for (const [slug, section] of Object.entries(PROPOSAL)) {
    const find = await fetch(`${BASE}/api/services?where[slug][equals]=${slug}&depth=0&limit=1`, { headers })
    const doc = (await find.json()).docs?.[0]
    if (!doc) {
        console.error(`  ${slug}: no such service.`)
        failed++
        continue
    }

    const res = await fetch(`${BASE}/api/services/${doc.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ pricingSection: section }),
    })
    const out = await res.json()
    if (!res.ok) {
        console.error(`  ${slug}: HTTP ${res.status}`)
        console.error(JSON.stringify(out, null, 2).slice(0, 700))
        failed++
        continue
    }

    /* Payload drops fields its running config does not declare and answers 200
       while doing it, so the write is read back and compared rather than
       trusted. A silent drop here looks exactly like success. */
    const got = (out.doc || out.result || out).pricingSection?.plans || []
    const wrongPrice = got.filter((t, i) => t.priceUsd !== section.plans[i]?.priceUsd)
    if (got.length !== section.plans.length || wrongPrice.length) {
        console.error(`  ${slug}: came back with ${got.length} tier(s), expected ${section.plans.length}.`)
        console.error('  The CMS on Railway has not been redeployed with the updated Services.ts,')
        console.error('  so Payload does not know these fields exist and stripped them.')
        failed++
        continue
    }
    console.log(`  ${slug}: ${got.length} tiers written.`)
}

console.log('')
if (failed) {
    console.error(`${failed} service(s) did not take.`)
    process.exit(1)
}
console.log('Written. The edge cache holds public pages for 60 seconds.')
