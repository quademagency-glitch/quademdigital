#!/usr/bin/env node
/*
  Replaces the generic write-ups on five case studies, and corrects the
  projectType on the ones that were labelled "concept".

  Why this exists
  ---------------
  Five of the six published case studies carried the same three headings, The
  Challenge, The Solution and The Results, filled with copy nobody could source:
  "a massive boost in sales", "a substantial increase in direct-to-consumer
  online sales", "a fully booked speaking calendar". None of those numbers were
  measured and none of them belong on a portfolio whose whole argument is that
  it does not invent figures.

  The descriptions on the same documents were already specific and true, which
  is what made the contrast obvious once the pages got a design: an honest
  paragraph at the top, then three paragraphs of nothing underneath it.

  Where the replacement copy comes from
  ------------------------------------
  Every claim below traces to something on this drive or in the CMS. Nothing is
  inferred from the finished sites.

    omek-storefront    Omek-Site-Audit-Report.md dated 3 July 2026, plus the
                       commit history of omek-storefront and omek-admin, plus
                       the measured table already on the document.
    quaderp-landing    the quaderp-landing-wt commit history: the 1.3MB to
                       150KB commit, the 549px layout-shift commit, the GA4
                       commit, the two copy-correction commits, and the seven
                       page files under src/pages.
    san-collection     sans-bag-web: package.json, the Prisma schema, the route
                       tree and the commit history. Collections named in the
                       existing CMS description.
    quajo-speaks       quajospeaks: README, src/lib/site.ts and the commit
                       history, including the 92 to 100 accessibility commit.
    quadbrand          brandengine: package.json, docs/PLAN.md, the route tree
                       and the commit history.

  projectType
  -----------
  Five documents said "concept", which the field's own admin text defines as no
  real client relationship. Omek and San's Bag are real clients. QuadERP,
  QuadBrand and QuajoSpeaks are Ernest's own brands. Nothing renders this field
  today, which is the only reason the wrong values never showed, but a field
  that exists to be displayed should be right before something displays it.
  QuajoSpeaks and San Collection were confirmed by Ernest on 29 August 2026.

  Nothing else on any document is touched: title, slug, description, cover
  image, gallery, metrics, result figures and publish state all stay as they
  are. The old bodies are written to a backup file first.

  Run:
    node cms/scripts/rewrite-case-study-write-ups.mjs --dry-run
    node cms/scripts/rewrite-case-study-write-ups.mjs
*/

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
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

/* ------------------------------------------------------------------ lexical */

const p = (text) => ({
    type: 'paragraph',
    version: 1,
    children: [{ type: 'text', version: 1, format: 0, detail: 0, mode: 'normal', style: '', text }],
})
const h = (text, tag = 'h2') => ({
    type: 'heading',
    tag,
    version: 1,
    children: [{ type: 'text', version: 1, format: 0, detail: 0, mode: 'normal', style: '', text }],
})
const doc = (...children) => ({
    root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children },
})

/* -------------------------------------------------------------------- copy */

const WRITE_UPS = {
    'omek-storefront': {
        projectType: 'client',
        body: doc(
            h('What the audit found before anything was built'),
            p(
                'The first job was not building. It was reading the shop the way a customer reads it, on 3 July 2026, and writing down everything that was wrong. At that point it was WordPress with WooCommerce behind it, carrying 267 products.'
            ),
            p(
                'Some of what I found was costing money directly. The About page promised free delivery on orders over five thousand cedis. The contact page and the footer said twenty thousand. Both were live at the same time, which is the sort of contradiction a customer screenshots. The owner confirmed twenty thousand was the real figure.'
            ),
            p(
                'Some of it was quietly embarrassing. The email link on the contact page pointed at a placeholder address nobody owns, so anyone who clicked it wrote to nothing. Ninety two products sat under a category spelled Televsion. The description Google was showing for the homepage said applainces. The footer said Greate Accra Region on every page of the site.'
            ),
            p(
                'And some of it simply disagreed with itself: two store addresses, two sets of opening hours and two WhatsApp numbers, none of them matching.'
            ),

            h('The cheap fixes went first, and did not wait for the rebuild'),
            p(
                'None of that needed new software, so none of it waited for any. On the same day I renamed the category without changing its web address, so no existing link broke, pointed the email link at the shop inbox, set the delivery threshold to twenty thousand on every page that mentions it, corrected the spelling, listed both stores properly, and put the opening hours back to the ones the shop actually keeps.'
            ),
            p(
                'That order is deliberate. A rebuild takes months. A shop quoting the wrong delivery threshold is losing money this week.'
            ),

            h('Then the shop itself'),
            p(
                'The new storefront is a separate front end reading the same WooCommerce catalogue, so the products never had to move and the shop keeps working while it is replaced.'
            ),
            p(
                'Speed was the reason it exists. Before the work, opening the shop on a phone meant eight seconds before anything appeared and just over nineteen before the main picture finished loading. Product photographs were being requested from the shop domain rather than from the server that actually holds them, so every one took a detour. The page asked for the header, then the products, then the settings, one after another, when it could ask for all three at once. Analytics and the advertising pixel loaded at the exact moment the phone was busiest. Six manufacturer logos and four payment logos downloaded immediately, competing with the product photograph for the same connection.'
            ),
            p(
                'The rest is the plumbing that is only visible when it is missing. Old product links now land on the page that holds the product instead of a dead end. Nested category addresses stopped being swallowed by a catch-all rule. An address that does not exist answers with a real 404 rather than a page that looks fine to a person and looks alive to Google. There is a product feed for Google Merchant Center, and customers are told when their order status changes.'
            ),
            p(
                'Checkout takes Paystack and Hubtel. The admin is custom and covers orders, stock, categories, coupons, reviews and enquiries, including flash deals priced against competitor listings rather than against an invented discount. 151 of the 267 products are live so far.'
            ),

            h('What it measures at now'),
            p(
                'The table below is the result, mobile and desktop, before and after. The line worth pointing at is the main picture: three and a half seconds instead of nineteen and a third.'
            ),
            p(
                'Accessibility, best practices and search readiness moved as well. Those were not the point of the work. They moved because most of what makes a page fast also makes it well built.'
            ),
            p(
                'One thing this page does not do. It says the shop got faster and it says exactly how that was measured. It does not put a sales figure beside it, because I do not have one I could stand behind.'
            )
        ),
    },

    'quaderp-landing': {
        projectType: 'self',
        body: doc(
            h('Who the page has to convince'),
            p(
                'The buyer is a shop owner in Ghana who has never bought software before, is reading on a phone, and has probably been sold to badly already. That rules out most of what a software landing page normally does: no jargon, no dashboard screenshots that mean nothing without context, and no pricing that hides until you agree to a call.'
            ),
            p(
                'One action, repeated down the page: start the thirty day trial. Anything that did not support that came off.'
            ),

            h('The page was eight times heavier than it needed to be'),
            p(
                'The first version weighed 1.3 megabytes. On the connection the actual buyer is using, that is the difference between a page and a wait. It is 150 kilobytes now, and nothing came out that a visitor would miss.'
            ),
            p(
                'The product screenshots were also declared at the wrong size, so the page grew by 549 pixels as it loaded and the thing you were about to tap moved out from under your thumb. Correcting the dimensions fixed it.'
            ),
            p(
                'The measurement was worse than useless. Events were being sent and GA4 was receiving none of them, so every decision about the page was being made on no data at all. The page also lost the chosen plan between the pricing table and the signup form, so anyone who picked a tier had to pick it again.'
            ),

            h('Two claims came off the page'),
            p(
                'The payment section promised two behaviours the product does not have, and a loss prevention line overstated what the software can actually detect. Nobody had complained. They came off anyway.'
            ),
            p(
                'It is worth saying plainly, because it is the whole argument for having the person who reads the product write the page. A promise you cannot keep does not fail on the landing page. It fails in month two, on the phone, with a customer who has already paid.'
            ),

            h('One page was never going to rank'),
            p(
                'A single page can rank for a single thing, and the people who need this software are not searching for it by name, because they do not know the name. They are searching for a point of sale system in Ghana, for accounting or inventory software, or for an alternative to QuickBooks, Sage or Odoo.'
            ),
            p(
                'So it is seven pages now, one for each of those, plus a page on security and uptime for the buyer who has to justify the decision to somebody else. It scores 100 for both search readiness and best practices.'
            )
        ),
    },

    'san-collection': {
        projectType: 'client',
        body: doc(
            h('The brief came from the products'),
            p(
                "San's Bag sells handcrafted bags, and the design constraint followed from that rather than from a moodboard: nothing on the page competes with the bag. No rotating offer banners, no badges, no countdown timers. Photograph, name, price."
            ),
            p(
                'The catalogue is arranged as three collections, Lumina, Aura and Nova, so someone can browse by feel rather than scroll one long grid.'
            ),

            h('What is behind it'),
            p(
                'It is a Next.js storefront on its own PostgreSQL database rather than a rented shop platform. A rented platform charges a slice of every sale for as long as the shop exists, and this catalogue is meant to grow.'
            ),
            p(
                'Products, collections, categories, orders, addresses and discount codes are all real records, so a discount has rules rather than being a price typed over by hand. Payment goes through Paystack, which covers cards and mobile money in one integration. Photography is served through Cloudinary at the size each screen needs. Customers sign in and see their own order history.'
            ),

            h('The half of the build that decides whether a shop survives'),
            p(
                'The admin is usually the part that gets left until last and then never finished. It was built alongside the shop here.'
            ),
            p(
                'It adds and edits products, manages the collections, creates discounts and works through orders. A price drop is shown as a price drop rather than a number that quietly changed. Payment notifications are verified before anything is written to the database, so an order cannot be faked by anyone who finds the address.'
            ),

            h('Where it is now, honestly'),
            p(
                'Six products are live. That is not a technical limit and it is not a staged launch. The shop can only list what has been photographed, and the photography is still being worked through.'
            ),
            p(
                'Everything around that is finished: browsing, cart, checkout, order confirmation, customer accounts and the admin. It is waiting on the rest of the catalogue and on its own domain, and the number on this page goes up as the pictures come in.'
            )
        ),
    },

    'quajo-speaks': {
        projectType: 'self',
        body: doc(
            h('Why this one exists'),
            p(
                'QuajoSpeaks is mine rather than a client project, which is why it carries an internal badge. It is where I write and talk about relationships, personal growth and the things people usually only say to one other person.'
            ),
            p(
                'The brief was a mood before it was a specification. Everything else in this category is loud: pop-ups, countdowns, three newsletter prompts before the first paragraph. I wanted somewhere a person could sit with an idea for ten minutes without being sold anything.'
            ),

            h('Every essay has to stand on its own'),
            p(
                'The writing is the site, so the writing is what the structure is built around. One file per piece, and the filename is the web address, which means publishing is writing rather than operating a content system.'
            ),
            p(
                'Each piece gets its own page, its own link preview card generated from its own title, and a place in the feed. Someone can arrive at one essay from anywhere and have it make sense with no site around it. There is an RSS feed for the people who still keep one.'
            ),

            h('Two decisions worth naming'),
            p(
                'The contact and newsletter forms fail out loud. If the mail provider is unreachable, a visitor sees an error and my direct address rather than a cheerful confirmation for a message that went nowhere. A form that lies is worse than a form that is missing.'
            ),
            p(
                'And the video section came off the site for a while, because it was advertising videos that did not exist yet. An empty shelf with a sign over it looks worse than no shelf.'
            ),

            h('What it scores, and why'),
            p(
                'It scores 94 for performance and 100 for search readiness. The accessibility audit started at 92 and is at 100 now, which took real work: contrast, heading order, and making every entrance animation something the visitor can switch off.'
            ),
            p(
                'The reason it is quick is that the code running the motion is kept off the path to the first thing you read. The words paint first. The polish arrives a moment later, and if it never arrives the page still works.'
            )
        ),
    },

    quadbrand: {
        projectType: 'self',
        body: doc(
            h('The wall small teams hit'),
            p(
                'An AI image tool will hand you something good looking in twenty seconds. It will not hand you your blue, your typeface or your logo, and it will not give you the same answer twice. So somebody opens the file and corrects it by hand, which costs more time than the tool saved.'
            ),
            p(
                'The problem is not the quality of the generation. It is that the model has no idea who you are.'
            ),

            h('Reading a brand off its own website'),
            p(
                'QuadBrand starts from a web address. It reads the site, pulls out the colour palette, the typefaces and the logo, and keeps that as the brand rather than as a sentence in a prompt that someone has to remember to type.'
            ),
            p(
                'Every generation after that is held to it, and comes back in each social size at once rather than as one image you then crop four times.'
            ),

            h('What is actually shipped'),
            p(
                'It is a working product rather than a demo. Sign in and shared workspaces, so a team works from one brand instead of each person keeping a private version of it. Credits, metered per generation. Billing through Paystack. A library that keeps what has been made, and analytics on what is being made. A public API with its own documentation, a referral scheme and a changelog.'
            ),
            p(
                'Generation runs against several model providers rather than one. No single provider is best at everything, and being tied to one is a business risk before it is a technical one.'
            ),

            h('What it is not yet'),
            p(
                'It is in beta and the site says so. Six core features are shipped, and what is coming is in a public changelog rather than in a deck.'
            ),
            p(
                'This one is mine, like QuadERP, which is why it carries an internal badge. I show it because building the thing I sell is the most honest demonstration I have. The same person chose the stack, wrote the billing and has to answer for it when it breaks.'
            )
        ),
    },
}

/* Documents whose type was already right, listed so the summary can say so
   rather than silently ignoring them. */
const ALREADY_CORRECT = ['quadem-brand-identity', 'omek-gigs-performance']

/* --------------------------------------------------------------------- run */

const res = await fetch(`${BASE}/api/caseStudies?depth=0&limit=50&sort=order`, { headers })
if (!res.ok) {
    console.error(`Could not read caseStudies: HTTP ${res.status}`)
    process.exit(1)
}
const docs = (await res.json()).docs || []
const bySlug = new Map(docs.map((d) => [d.slug, d]))

const missing = Object.keys(WRITE_UPS).filter((slug) => !bySlug.has(slug))
if (missing.length) {
    console.error(`No case study with slug: ${missing.join(', ')}`)
    process.exit(1)
}

// Keep the old bodies. Gitignored, and the only copy of the previous text once
// this runs.
const backupPath = join(HERE, 'case-study-write-ups-backup.json')
if (!DRY) {
    const backup = Object.keys(WRITE_UPS).map((slug) => {
        const d = bySlug.get(slug)
        return { slug, projectType: d.projectType, body: d.body }
    })
    writeFileSync(backupPath, JSON.stringify(backup, null, 2))
    console.log(`Previous bodies saved to ${backupPath}\n`)
}

for (const slug of ALREADY_CORRECT) {
    const d = bySlug.get(slug)
    if (d) console.log(`Leaving ${slug} alone. projectType is already ${d.projectType}.`)
}
console.log('')

let failed = 0

for (const [slug, patch] of Object.entries(WRITE_UPS)) {
    const current = bySlug.get(slug)
    const headings = patch.body.root.children.filter((n) => n.type === 'heading').length
    const words = JSON.stringify(patch.body).match(/"text":"[^"]*"/g)
        ? patch.body.root.children
              .flatMap((n) => n.children || [])
              .map((c) => c.text || '')
              .join(' ')
              .split(/\s+/)
              .filter(Boolean).length
        : 0

    console.log(`${slug}`)
    console.log(`  projectType  ${current.projectType} -> ${patch.projectType}`)
    console.log(`  body         ${headings} sections, ${words} words`)
    console.log(`  untouched    title, description, cover, gallery, metrics, result, published`)

    if (DRY) continue

    const r = await fetch(`${BASE}/api/caseStudies/${current.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ projectType: patch.projectType, body: patch.body }),
    })
    const out = await r.json()
    if (!r.ok) {
        console.error(`  FAILED HTTP ${r.status}`)
        console.error(JSON.stringify(out, null, 2).slice(0, 800))
        failed += 1
        continue
    }

    /*
      Payload silently drops fields the running app does not declare, so a 200
      is not proof the write landed. Read the values back off the response.
    */
    const savedType = out.doc?.projectType
    const savedHeads = (out.doc?.body?.root?.children || []).filter((n) => n.type === 'heading').length
    if (savedType !== patch.projectType || savedHeads !== headings) {
        console.error(`  FAILED silently: got projectType=${savedType}, ${savedHeads} heading(s).`)
        console.error('  Check the CMS app on Railway has been deployed with these fields.')
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
    console.error(`\n${failed} document(s) did not save.`)
    process.exit(1)
}

console.log('\nAll five rewritten. The edge cache holds public pages for 60 seconds.')
