#!/usr/bin/env node
/*
  Adds the Tannor Freight case study: a client website, under web design and
  on the Work page.

  Asked for by Ernest on 29 October 2026 ("we build tannor freight website.
  they must represent as well on our website"). Everything the write-up says
  is taken from the project's own notes on the drive (ALL QUADEM DIGITAL
  PROJECTS/TANNOR FREIGHT AND LOGISTICS/WEBSITE/tannor-website-v6: README.md,
  V6-CHANGE-NOTES.md, SEO-AND-AI-SEARCH.md) and from the review copy itself.

  Later the same day Ernest asked for the story to say that we built Tannor's
  admin as well ("tell the tannor story to tell i built and admin as well for
  them"), so the admin has its own two sections and three screenshots, and the
  description leads with the website and the admin together. The site went
  live at https://www.tannorfreight.com/ on 29 October too, so "launch in
  progress" (and with it the In progress chip) is gone and the page links to
  the live site.

  NO SPEED FIGURES, ON PURPOSE

  The project has Lighthouse scores, but from local runs, which are too noisy
  to publish, and Google PageSpeed's keyless quota was used up both times we
  tried on 29 October. The page says PageSpeed figures for the live address
  will follow.

  WHAT IT WRITES

  1. Eight media files, matched by filename so a second run uploads nothing
     twice: the homepage at 1600 x 1000 as the cover (the size of the other
     website covers), then a service page, the gallery and the contact page at
     the same size, the homepage on a phone, and three screens of the admin.
     The website shots are browser screenshots of
     https://tannor-website-v6-liart.vercel.app/ taken on 29 October 2026
     with the browser clock at 10:00 Ghana time, so the top bar shows the
     office open rather than the "Closed" it shows after 9 pm. The admin
     shots come from the project's own copy run locally with a throwaway
     password, signed in and not published from; its content files matched
     the live site's latest commit.
  2. The case study, slug tannor-freight, order 4.5: after SAN Collection and
     before QuadBrand. That keeps the web design page's three cards and the
     About page's three browser windows as they are; Ernest can move it up
     with the Order field.

  Every field is read back afterwards and it fails if any came back different.

  Run from the repo root (it reads .env there):
    node cms/scripts/tannor-freight-case-study.mjs --images=<folder>
    node cms/scripts/tannor-freight-case-study.mjs --images=<folder> --confirm

  <folder> holds home-1600.png, service-1600.png, gallery-1600.png,
  contact-1600.png, home-phone-framed.png, and admin/hours.png,
  admin/photos.png and admin/service-customs-clearance.png.
*/

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const CONFIRM = process.argv.includes('--confirm')
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
    console.error('Pass --images=<folder> with the five screenshots.')
    process.exit(2)
}
const auth = { Authorization: `users API-Key ${KEY}` }
const json = { ...auth, 'Content-Type': 'application/json' }

/* Postgres stores a json field as jsonb, which hands its keys back in its own
   order, so a read-back compares with the keys sorted. */
const canon = (value) =>
    JSON.stringify(value, (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v))

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

const CREDIT = 'Browser screenshot of the Tannor Freight & Logistics website built by Quadem Digital (review copy, before launch), 29 October 2026.'
const ADMIN_CREDIT = 'Screenshot of the website admin Quadem Digital built for Tannor Freight & Logistics, 29 October 2026.'
const MEDIA = [
    {
        key: 'cover',
        file: 'home-1600.png',
        name: 'tannor-freight-home',
        alt: 'Tannor Freight & Logistics homepage: "Your cargo. Our priority." beside a white SUV at the harbour, with Get a quote and Chat on WhatsApp buttons.',
    },
    {
        key: 'service',
        file: 'service-1600.png',
        name: 'tannor-freight-customs-clearance',
        alt: 'Tannor Freight customs clearance page: "Clear at Tema. Without the guesswork." beside staff inspecting cars at the port.',
    },
    {
        key: 'gallery',
        file: 'gallery-1600.png',
        name: 'tannor-freight-gallery',
        alt: 'Tannor Freight gallery page: "Real cargo. Real work." beside a red SUV among shipping containers.',
    },
    {
        key: 'contact',
        file: 'contact-1600.png',
        name: 'tannor-freight-contact',
        alt: 'Tannor Freight contact page with call, WhatsApp, email and office address cards under the heading "Get in touch."',
    },
    /* The phone shot is taken with the real clock: a fixed clock froze the
       homepage's headline animation and the first upload (media 157,
       tannor-freight-home-phone) showed an empty hero. Phones show no
       opening hours in the top bar, so the clock does not matter there. It is
       set on a navy 1600 x 1000 ground so the gallery's wide tiles show the
       whole phone rather than a strip of its header. */
    {
        key: 'phone',
        file: 'home-phone-framed.png',
        name: 'tannor-freight-phone',
        alt: 'Tannor Freight homepage on a phone, with the Get a quote and Chat on WhatsApp buttons above the harbour photograph.',
    },
    {
        key: 'adminHours',
        file: 'admin/hours.png',
        name: 'tannor-freight-admin-hours',
        credit: ADMIN_CREDIT,
        alt: 'Tannor Freight website admin, Opening hours: a button for each day from Monday to Sunday, opening and closing times, and how the hours will read on the website.',
    },
    {
        key: 'adminPhotos',
        file: 'admin/photos.png',
        name: 'tannor-freight-admin-photos',
        credit: ADMIN_CREDIT,
        alt: 'Tannor Freight website admin, Gallery photos: a Choose photos button above the gallery\'s 19 photos, numbered in the order they appear.',
    },
    {
        key: 'adminService',
        file: 'admin/service-customs-clearance.png',
        name: 'tannor-freight-admin-service-page',
        credit: ADMIN_CREDIT,
        alt: 'Tannor Freight website admin, Customs Clearance page: boxes for the label, both headline lines, the introduction and the reassurance line, each showing how many characters fit.',
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
const a = (value, url) => ({
    type: 'link',
    version: 3,
    direction: 'ltr',
    format: '',
    indent: 0,
    fields: { linkType: 'custom', url, newTab: true },
    children: [text(value)],
})

const body = {
    root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
            h('The job'),
            p(
                'Tannor Freight & Logistics clears cargo through customs, ships containers, hauls heavy loads, tows vehicles and stores goods. It needed a website that explains each of those plainly and gets a visitor to ask for a quote. And the website had to stay current without Tannor calling us for every new photo, phone number or change of hours.'
            ),
            p('So we built two things: the website, and an admin behind it that Tannor\'s own team runs.'),
            p(
                'We started with the homepage alone, revised it with Tannor until they approved it, and then built the rest of the site from that design: navy and orange, large confident headlines, and Tannor\'s own photographs from the port and the yard.'
            ),

            h('Ten pages, one job each'),
            p(
                'Home, About, a Services overview, a page for each of the five main services, a Gallery and a Contact page. Every service page follows the same order: what the service is, what is included, the cargo it handles, how it works in four steps, why Tannor, common questions and related services. Its "Get a quote" button opens the contact form with that service already chosen.'
            ),

            h('Quotes go straight to WhatsApp'),
            p(
                'The quote form sends nothing to a server. It turns what the visitor filled in into a WhatsApp message, and the visitor checks it and sends it to Tannor themselves. There is no inbox to watch and no customer data stored on the website. A WhatsApp button sits on every page, and on a service page its opening message already names that service.'
            ),

            h('Answers before the questions'),
            ul(
                [b('Open now. '), 'The top bar shows today\'s opening hours and whether the office is open right now, and the footer and contact page follow the same hours.'],
                [b('Real work only. '), 'The gallery is Tannor\'s own photographs and video clips, filtered by type of work. No stock photos, and every caption describes only what is in the picture.'],
                [b('A map that waits. '), 'The map loads only when a visitor asks for it, so Google is not contacted on every visit.'],
                [b('Movement with manners. '), 'Headlines rise into place and photographs open out as the page scrolls. All of it switches off for anyone whose device is set to reduce motion.']
            ),

            h('An admin built for Tannor'),
            p(
                'Rather than hand Tannor a general content system full of menus they would never use, we built an admin around this one website. Tannor\'s team signs in with a password and sees one section for each thing they change, named in their own words:'
            ),
            ul(
                [b('Contact details. '), 'Phone numbers, the WhatsApp number, email addresses, the office address and landmark, and social links. One change updates the header, the footer, the Contact page and the business details Google reads.'],
                [b('Opening hours. '), 'Tick the days and set the times. The website writes the hours line and the "Open now" sign from them, and the admin shows how the hours will read before anything goes live.'],
                [b('Gallery photos. '), 'Add photos and they are resized for the website automatically. Give each a title and a caption, put it under the right gallery filter, and reorder or remove photos.'],
                [b('Gallery videos. '), 'Titles, captions and the order of the clips.'],
                [b('Service pages. '), 'Every word on the five service pages, from the headline to the questions and answers, and the photo at the top, chosen from the gallery.']
            ),
            p(
                'Every box shows how many characters the design has room for, so a long headline cannot spill out of its space. Anything not yet published is marked in the menu, so nothing is forgotten halfway.'
            ),

            h('One button to publish'),
            p(
                'Edits wait in the admin until Tannor presses "Publish changes". The changes are checked and saved together, the website rebuilds, and the admin says "Your changes are live on the website", usually about a minute later. If two people edit at the same time, the second is asked to reload instead of overwriting the first, and if an update ever fails, the admin says so in plain words.'
            ),
            p(
                'The admin can change the words and pictures and nothing else. The layout, the page addresses and the design stay as we built them, so an update cannot break the design. It is part of the website itself, not a separate system to host and maintain.'
            ),

            h('Ready for Google and AI search'),
            p(
                'Each page has its own title and description. The site gives Google the business details it looks for, from services and opening hours to address and phone, marks up its questions and answers, and includes a short guide for AI assistants. All of it was in place on launch day.'
            ),

            h('Live'),
            p(
                'The site went live at ',
                a('www.tannorfreight.com', 'https://www.tannorfreight.com/'),
                ' on 29 October 2026, with the admin from day one. We will add Google PageSpeed figures for the live site to this page.'
            ),
        ],
    },
}

const SLUG = 'tannor-freight'
const study = {
    title: 'Tannor Freight',
    slug: SLUG,
    tag: 'Logistics',
    description:
        'A ten-page website for a freight and logistics company, and the admin we built so Tannor\'s own team can run it. Visitors ask for quotes on WhatsApp, and Tannor updates contacts, hours, photos and service pages themselves, live in about a minute.',
    resultMetric: '10',
    resultText: 'Pages live at tannorfreight.com, with an admin Tannor\'s team runs themselves',
    body,
    order: 4.5,
    showUnderServices: ['web-design'],
    projectType: 'client',
    published: true,
}

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

console.log('Media')
for (const m of MEDIA) console.log(`  ${m.existing ? `already there, id ${m.existing.id}` : 'upload'}  ${m.file} as ${m.name}`)
console.log(`\nCase study /projects/${SLUG}/: ${existingStudy ? `UPDATE id ${existingStudy.id}` : 'CREATE'}`)
console.log(`  "${study.title}", ${study.tag}, ${study.projectType}, order ${study.order}, under ${study.showUnderServices.join(', ')}`)
console.log(`  result: ${study.resultMetric} | ${study.resultText}`)
console.log(`  published: ${study.published}, cover + ${MEDIA.length - 1} gallery images, ${body.root.children.length} body blocks`)

if (!CONFIRM) {
    console.log('\nDry run. Nothing written. Add --confirm to write.')
    process.exit(0)
}

/* ----------------------------------------------------------------- write */

for (const m of MEDIA) {
    if (m.existing) {
        m.id = m.existing.id
        continue
    }
    const form = new FormData()
    form.append('file', new Blob([readFileSync(m.path)], { type: 'image/png' }), `${m.name}${extname(m.file)}`)
    form.append('_payload', JSON.stringify({ alt: m.alt, credit: m.credit || CREDIT, kind: 'raw' }))
    const uploaded = await api('media', { method: 'POST', body: form })
    m.id = uploaded.doc?.id
    if (!m.id) fail(`uploading ${m.file} returned no id`)
    console.log(`  uploaded ${m.file} as media ${m.id} (${uploaded.doc.filename})`)
}
const byKey = Object.fromEntries(MEDIA.map((m) => [m.key, m.id]))
const doc = {
    ...study,
    coverImage: byKey.cover,
    imageGallery: ['service', 'gallery', 'contact', 'phone', 'adminHours', 'adminPhotos', 'adminService'].map((key) => ({ image: byKey[key] })),
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
const wrong = Object.keys(want).filter((k) => canon(want[k]) !== canon(got[k]))
if (wrong.length) fail(`the case study came back different in: ${wrong.join(', ')}`)
console.log('  read back: every field as written')

console.log(`\nDone. ${BASE.replace('cms.', '')}/projects/${SLUG}/ (allow a minute for the cache).`)
