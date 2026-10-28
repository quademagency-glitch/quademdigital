#!/usr/bin/env node
/*
  Adds the Omek Google Ads case study: a client project under Growth &
  Performance Marketing, and on the Work page with everything else.

  Asked for by Ernest on 28 October 2026, from the write-up he prepared in
  Portfolio Projects/Omek Google Ads/omek-google-ads-case-study.md. Every
  figure here is transcribed from that file and its four screenshots. Do not
  round them, convert them or compute new ones from them (no "return on ad
  spend" multiple: the page says plainly that four weeks cannot settle one).

  WHY A SECOND OMEK ENTRY IS RIGHT THIS TIME

  A second Omek case study was deleted on 29 August 2026 because it split one
  story, the storefront, across two pages (see seed-omek-case-study.mjs). This
  is a different piece of work for a different service: the ads, not the
  website. It shows under Growth & Performance Marketing only, never under web
  design, and about.astro keeps it out of the browser-window stack of sites.

  WHAT IT WRITES

  1. Five media files: a cover cropped from the real Google Ads overview
     (01-campaign-overview.png, caption bar left out) and the four screenshots
     as Ernest framed them. Matched by filename, so a second run uploads
     nothing twice. The CMS stores each as webp.
  2. The case study, slug omek-google-ads, order 1.5: after the Omek
     storefront and before QuadERP, so on the Work page it sits with the work
     that is not a website rather than among the sites.
  3. One paragraph on the Growth & Performance Marketing page (services row
     digital-marketing-social-media). Its "Work we've done" section ends by
     saying no ad results are published yet, which the case study card
     underneath it would contradict. Only that paragraph changes, matched by
     its exact words, and only with --publish, since the card shows only
     once the case study is published; --keep-growth-words leaves it alone.

  published stays false unless --publish is passed: the write-up asks for
  Omek's written approval of the name and figures before they go public. An
  unpublished case study is reachable by its link for review, noindex, and
  absent from every list.

  Everything it may overwrite is backed up beside this file first, and every
  row is read back afterwards; it fails if anything it did not name moved.

  Run from the repo root (it reads .env there):
    node cms/scripts/omek-google-ads-case-study.mjs --images=<folder>
    node cms/scripts/omek-google-ads-case-study.mjs --images=<folder> --confirm
    node cms/scripts/omek-google-ads-case-study.mjs --images=<folder> --confirm --publish

  <folder> holds the four screenshots under their original names plus
  cover-omek-google-ads.png. The screenshots are client material and are not
  committed: this repo is public.
*/

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname, basename, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const CONFIRM = process.argv.includes('--confirm')
const PUBLISH = process.argv.includes('--publish')
const CHANGE_GROWTH_WORDS = PUBLISH && !process.argv.includes('--keep-growth-words')
const IMAGES = process.argv.find((a) => a.startsWith('--images='))?.slice('--images='.length)

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
if (!IMAGES) {
    console.error('Pass --images=<folder> with the four screenshots and cover-omek-google-ads.png.')
    process.exit(2)
}
const auth = { Authorization: `users API-Key ${KEY}` }
const json = { ...auth, 'Content-Type': 'application/json' }

const fail = (message) => {
    console.error(`\nStopped: ${message}`)
    process.exit(1)
}
async function api(path, options = {}) {
    const res = await fetch(`${BASE}/api/${path}`, { ...options, headers: { ...(options.body instanceof FormData ? auth : json), ...options.headers } })
    const text = await res.text()
    if (!res.ok) fail(`${options.method || 'GET'} ${path}: HTTP ${res.status}\n${text.slice(0, 1500)}`)
    return text ? JSON.parse(text) : null
}

/* ---------------------------------------------------------------- media */

const CREDIT = 'Screenshot from the Google Ads and Merchant Center accounts Quadem Digital manages for Omek Gigs Appliances, September to October 2026. Account IDs left out.'
const MEDIA = [
    {
        key: 'cover',
        file: 'cover-omek-google-ads.png',
        name: 'omek-google-ads-cover',
        alt: 'Google Ads overview for Omek Gigs Appliances: no serving issues, 1.87K clicks, 20.2K impressions, $0.05 average cost per click and $96.99 spent.',
    },
    {
        key: 'overview',
        file: '01-campaign-overview.png',
        name: 'omek-google-ads-01-campaign-overview',
        alt: 'Google Ads overview for Omek Gigs Appliances, 24 September to 18 October 2026: no serving issues, 1.87K clicks, 20.2K impressions, $0.05 average cost per click and $96.99 spent.',
    },
    {
        key: 'conversions',
        file: '02-conversions-tracking.png',
        name: 'omek-google-ads-02-conversions-tracking',
        alt: 'Google Ads conversions for Omek Gigs Appliances: Purchase is active and primary, while WhatsApp and phone number clicks are kept as secondary.',
    },
    {
        key: 'assetGroups',
        file: '03-asset-groups-excellent.png',
        name: 'omek-google-ads-03-asset-groups-excellent',
        alt: 'Performance Max asset groups for Omek Gigs Appliances, including fridges and freezers and air conditioners, each rated Excellent for ad strength.',
    },
    {
        key: 'merchant',
        file: '04-merchant-center-277-approved.png',
        name: 'omek-google-ads-04-merchant-center-277-approved',
        alt: 'Google Merchant Center for Omek Gigs Appliances: 349 clicks in the last 28 days, up 1,736.8%, and 277 of 277 products approved.',
    },
]

for (const m of MEDIA) {
    m.path = resolve(IMAGES, m.file)
    if (!existsSync(m.path)) fail(`missing ${m.path}`)
}

/* ----------------------------------------------------------------- body */

const text = (value, format = 0) => ({ type: 'text', version: 1, format, detail: 0, mode: 'normal', style: '', text: value })
const p = (...parts) => ({
    type: 'paragraph',
    version: 1,
    children: parts.map((part) => (typeof part === 'string' ? text(part) : part)),
})
const h = (value) => ({ type: 'heading', tag: 'h2', version: 1, children: [text(value)] })
const ul = (...items) => ({
    type: 'list',
    listType: 'bullet',
    tag: 'ul',
    start: 1,
    version: 1,
    children: items.map((parts, i) => ({
        type: 'listitem',
        value: i + 1,
        version: 1,
        children: (Array.isArray(parts) ? parts : [parts]).map((part) => (typeof part === 'string' ? text(part) : part)),
    })),
})
const b = (value) => text(value, 1)

const body = {
    root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
            h('Where it started'),
            p(
                'Omek Gigs Appliances is an official LG store and an official Sigma dealer, with several showrooms and an online shop that takes mobile money and card payments. When we started in September 2026 it had no paid search at all. On searches like "air conditioner price", the sponsored product listings at the top of Google belonged to the big online marketplaces.'
            ),
            p(
                'Three things stood in the way. The product feed of 277 items was not ready for ads: titles were too long or written in capitals, the TVs had no descriptions, there was no return policy, and products sat in pending review. Nothing recorded a purchase, so Google had no way to learn which clicks turned into sales. And the test budget was small: four dollars a day, about fifty cedis.'
            ),

            h('What we built'),
            ul(
                [b('The campaign. '), 'Performance Max, linked to Google Merchant Center and split into five product groups: TVs and audio, air conditioners, fridges and freezers, laundry and cooking, and small appliances. Google rates the ads in every group Excellent.'],
                [b('The words. '), 'Ad copy written only from facts on Omek\'s own website, with rules agreed up front: no price claims, no promise of free or nationwide delivery, and no "best" or "cheapest".'],
                [b('The tracking. '), 'A purchase tag on the order confirmation page that sends each order\'s real value in cedis and its order number, so no sale is counted twice. It loads straight away on checkout pages, so no sale is missed either.']
            ),

            h('Getting all 277 products approved'),
            p(
                'We rewrote every product title in one pattern: brand, size or spec, product type, model. "LG 65-inch 4K OLED Smart TV OLED65C46LA" is one of them. We completed the TV descriptions and set up a verified return policy. Every product moved out of pending review: 277 approved, none limited, none disapproved. That is when the product ads, with a picture and a price, started to show.'
            ),

            h('Cutting the wasted clicks'),
            p(
                'In the first days, part of the budget went on display placements inside games, quizzes and apps, where people tap by accident and rarely buy. We blocked 92 of those placements across the account. Display impressions fell from about 5,000 a week to 22 a week, with no loss of sales.'
            ),

            h('Every week since'),
            p(
                'Once real purchases were being recorded, we moved the bidding from soft signals, such as WhatsApp and phone taps, to confirmed purchases. We paused an older Shopping campaign that was competing with the main one for the same searches. And we read the results group by group, moving budget towards the products that sell. So far the best are fridges and freezers, at $0.94 per conversion, and laundry and cooking, at $1.84.'
            ),

            h('The first four weeks, in numbers'),
            ul(
                [b('Ad spend, 24 September to 18 October 2026: '), 'about $97 (about GH₵1,210).'],
                [b('Clicks: '), '1,868 from 20,201 impressions, at an average of $0.05 a click.'],
                [b('Sales, week of 12 to 18 October: '), '3 confirmed online orders worth about GH₵7,635, from $30.44 (about GH₵381) of ad spend.'],
                [b('Products: '), '277 of 277 approved in Merchant Center, none limited, none disapproved.'],
                [b('Merchant Center clicks, last 28 days: '), '349, up 1,736.8% on the 28 days before.'],
                [b('Wasted display and app traffic: '), 'down by over 99% after the placement blocks.']
            ),

            h('How this was checked, and what it does not prove'),
            p(
                'The purchases were checked against Omek\'s own order records, not only against Google\'s count. Dollar figures are Google Ads data, and cedi figures use $1 = GH₵12.5.'
            ),
            p(
                'Four weeks on a test budget is an early result. One strong week is not a trend, and this page does not claim a settled return on ad spend. We will update it at 90 days.'
            ),
        ],
    },
}

const SLUG = 'omek-google-ads'
const study = {
    title: 'Omek Google Ads',
    slug: SLUG,
    tag: 'Google Ads',
    description:
        'Omek Gigs Appliances went from no paid search to confirmed online sales in under four weeks, on a test budget of about GH₵1,200. We built the Google Ads campaign, fixed the 277-product Shopping feed, set up purchase tracking and cut the wasted app traffic.',
    resultMetric: 'GH₵7,635',
    resultText: 'Confirmed online orders in one week, from GH₵381 of ad spend',
    body,
    order: 1.5,
    showUnderServices: ['digital-marketing'],
    projectType: 'client',
    published: PUBLISH,
}

/* -------------------------------------------- the Growth page paragraph */

const GROWTH_SLUG = 'digital-marketing-social-media'
const OLD_LEAD = "What you won't find here: "
const OLD_REST = "reach figures or return on ad spend. We'll publish results once a campaign has recorded before-and-after numbers we can stand behind."
const NEW_LEAD = 'Four weeks in: '
const NEW_REST = "Omek's Google ads were bringing in confirmed online orders, checked against Omek's own order records. The case study below has the numbers and the screenshots."
const sameText = (node, lead, rest) =>
    node?.type === 'paragraph' && node.children?.length === 2 && node.children[0].text === lead && node.children[1].text === rest

/* ------------------------------------------------------------------ read */

const findMedia = async (name) => {
    for (const filename of [`${name}.webp`, `${name}.png`]) {
        const found = await api(`media?where[filename][equals]=${encodeURIComponent(filename)}&depth=0&limit=1`)
        if (found.docs?.[0]) return found.docs[0]
    }
    return null
}
for (const m of MEDIA) m.existing = await findMedia(m.name)

const existingStudy = (await api(`caseStudies?where[slug][equals]=${SLUG}&depth=0&limit=1`)).docs?.[0] || null
const growth = (await api(`services?where[slug][equals]=${GROWTH_SLUG}&depth=0&limit=1`)).docs?.[0]
if (!growth) fail(`no services row with slug ${GROWTH_SLUG}`)
const paragraphs = growth.body?.root?.children || []
const oldAt = paragraphs.findIndex((node) => sameText(node, OLD_LEAD, OLD_REST))
const newAt = paragraphs.findIndex((node) => sameText(node, NEW_LEAD, NEW_REST))

console.log('Media')
for (const m of MEDIA) console.log(`  ${m.existing ? `already there, id ${m.existing.id}` : 'upload'}  ${m.file} as ${m.name}`)
console.log(`\nCase study /projects/${SLUG}/: ${existingStudy ? `UPDATE id ${existingStudy.id}` : 'CREATE'}`)
console.log(`  "${study.title}", ${study.tag}, ${study.projectType}, order ${study.order}, under ${study.showUnderServices.join(', ')}`)
console.log(`  result: ${study.resultMetric} | ${study.resultText}`)
console.log(`  published: ${study.published}${study.published ? '' : ' (reachable by link, noindex, in no list)'}`)
console.log(`  cover + ${MEDIA.length - 1} gallery images, ${body.root.children.length} body blocks`)
console.log(`\nGrowth & Performance Marketing page (services ${growth.id}):`)
if (!CHANGE_GROWTH_WORDS) console.log(`  left alone (${PUBLISH ? '--keep-growth-words' : 'changes only with --publish'})`)
else if (newAt > -1) console.log('  already says the new paragraph; nothing to do')
else if (oldAt > -1) console.log(`  paragraph ${oldAt}\n    before: ${OLD_LEAD}${OLD_REST}\n    after:  ${NEW_LEAD}${NEW_REST}`)
else fail('the "What you won\'t find here" paragraph is not there word for word. It has been edited since 28 October; read it before changing it.')

if (!CONFIRM) {
    console.log('\nDry run. Nothing written. Add --confirm to write.')
    process.exit(0)
}

/* ----------------------------------------------------------------- write */

const backup = join(HERE, 'omek-google-ads-backup.json')
writeFileSync(backup, JSON.stringify({ takenAt: new Date().toISOString(), caseStudy: existingStudy, growthService: growth }, null, 2))
console.log(`\nBackup: ${backup}`)

for (const m of MEDIA) {
    if (m.existing) {
        m.id = m.existing.id
        continue
    }
    const form = new FormData()
    form.append('file', new Blob([readFileSync(m.path)], { type: 'image/png' }), `${m.name}${extname(m.file)}`)
    form.append('_payload', JSON.stringify({ alt: m.alt, credit: CREDIT, kind: 'raw' }))
    const uploaded = await api('media', { method: 'POST', body: form })
    m.id = uploaded.doc?.id
    if (!m.id) fail(`uploading ${basename(m.path)} returned no id`)
    console.log(`  uploaded ${m.file} as media ${m.id} (${uploaded.doc.filename})`)
}
const byKey = Object.fromEntries(MEDIA.map((m) => [m.key, m.id]))
const doc = {
    ...study,
    coverImage: byKey.cover,
    imageGallery: ['overview', 'conversions', 'assetGroups', 'merchant'].map((key) => ({ image: byKey[key] })),
}

const saved = existingStudy
    ? await api(`caseStudies/${existingStudy.id}`, { method: 'PATCH', body: JSON.stringify(doc) })
    : await api('caseStudies', { method: 'POST', body: JSON.stringify(doc) })
const studyId = saved.doc?.id ?? saved.id
console.log(`  case study ${existingStudy ? 'updated' : 'created'}, id ${studyId}`)

/* Read it back rather than trusting the response: a field the running CMS
   does not declare is dropped from a write with no error at all. */
const after = await api(`caseStudies/${studyId}?depth=0`)
const want = { ...doc, imageGallery: doc.imageGallery.map((g) => g.image) }
const got = { ...after, imageGallery: (after.imageGallery || []).map((g) => g.image) }
const wrong = Object.keys(want).filter((k) => JSON.stringify(want[k]) !== JSON.stringify(got[k]))
if (wrong.length) fail(`the case study came back different in: ${wrong.join(', ')}`)
console.log('  read back: every field as written')

if (CHANGE_GROWTH_WORDS && oldAt > -1) {
    const nextBody = structuredClone(growth.body)
    nextBody.root.children[oldAt].children[0].text = NEW_LEAD
    nextBody.root.children[oldAt].children[1].text = NEW_REST
    // The whole row goes back, so no field falls to its default (cms/CLAUDE.md),
    // and never the slug, which the slug hook would rebuild from the title.
    const whole = { ...growth, body: nextBody }
    for (const k of ['id', 'createdAt', 'updatedAt', 'slug']) delete whole[k]
    await api(`services/${growth.id}`, { method: 'PATCH', body: JSON.stringify(whole) })

    const back = await api(`services/${growth.id}?depth=0`)
    const moved = Object.keys({ ...growth, ...back }).filter(
        (k) => !['body', 'updatedAt'].includes(k) && JSON.stringify(growth[k]) !== JSON.stringify(back[k]),
    )
    if (moved.length) fail(`on the Growth page something else changed: ${moved.join(', ')}. Restore from ${backup}.`)
    const otherBlocks = back.body.root.children.filter((_, i) => i !== oldAt)
    const wasOther = growth.body.root.children.filter((_, i) => i !== oldAt)
    if (JSON.stringify(otherBlocks) !== JSON.stringify(wasOther)) fail(`another paragraph on the Growth page moved. Restore from ${backup}.`)
    if (!sameText(back.body.root.children[oldAt], NEW_LEAD, NEW_REST)) fail('the Growth page paragraph did not take')
    console.log('  Growth page: the one paragraph changed, nothing else moved')
}

console.log(`\nDone. ${BASE.replace('cms.', '')}/projects/${SLUG}/ (allow a minute for the cache).`)
