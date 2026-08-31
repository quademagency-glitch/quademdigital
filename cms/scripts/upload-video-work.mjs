#!/usr/bin/env node
/*
  Uploads the video work Ernest selected, and wires it into the AI Video and
  Reels page.

  Job B in HANDOFF.md was blocked on one thing: where the reels are. There were
  no videos in the CMS at all, 113 media documents and not one of them a video,
  and nothing on the drive that could be identified as Quadem's without
  guessing. Ernest picked the files on 31 August 2026 from a listing of
  everything on the drive.

  Every file was watched before it went anywhere. A frame was pulled from each
  and looked at, which is how the one exclusion below was found.

  EXCLUDED, and this one matters
  ------------------------------
  Ads/The_Quadem_Blueprint.mp4 was on Ernest's list and is not uploaded here.
  Two reasons, either of which is enough:

    1. It carries a "NotebookLM" watermark on every frame. That is Google's
       tool, not Quadem's work, and a page selling video production is the
       worst possible place to advertise somebody else's product.
    2. Its headline graphic is "300%". That is the exact class of figure this
       site spent a day removing: the old case study cards carried "300%
       increase in website traffic" for clients who never reported it. Putting
       it back inside a video is worse than leaving it in text, because no
       guard in this repo can see inside an MP4.

  It is also 8 minutes 31, which is not a reel. If Ernest wants it published
  after reading this, it needs the watermark gone and the number sourced.

  What goes where
  ---------------
  The showreel slot gets "Quadem Digital .mov", which despite living in the
  Style All Clothing folder is the Quadem brand reel: landscape, 53 seconds,
  and its own on-screen title is "AI Video & Reels". Everything else goes in
  the gallery, grouped so a client's campaign stays together.

  Sizes and transcoding
  ---------------------
  Every file is under the 200MB the CMS transcodes on its own, so the originals
  go up and the CMS produces the 1280 and 720 renditions and the poster frame.
  videoUsage is 'playable' throughout: these are advertisements with voice and
  music, so they keep their audio and get play controls, and nothing downloads
  until a visitor asks for it.

  Run:
    node cms/scripts/upload-video-work.mjs --dry-run
    node cms/scripts/upload-video-work.mjs --only=1     # one file, to test
    node cms/scripts/upload-video-work.mjs
    node cms/scripts/upload-video-work.mjs --wire       # only set the page up
*/

import { readFileSync, existsSync, statSync } from 'node:fs'
import { basename, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const DRY = process.argv.includes('--dry-run')
const WIRE_ONLY = process.argv.includes('--wire')
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1]

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
const auth = { Authorization: `users API-Key ${KEY}` }
const json = { ...auth, 'Content-Type': 'application/json' }

const DRIVE = '/Volumes/QUADEM'
const ADS = `${DRIVE}/ALL QUADEM DIGITAL PROJECTS/Quadem Digital Enterprise/Ads`
const ERP = `${DRIVE}/ALL QUADEM DIGITAL PROJECTS/QuadERP/store-manager-images/video`

/*
  alt is required on Media and is what a screen reader announces, so each of
  these describes the footage rather than labelling the file.
*/
const SHOWREEL = {
    file: `${ADS}/Style all clothing/Quadem Digital .mov`,
    alt: 'Quadem Digital showreel: branded merchandise and screens of AI video and reels work rotating through a dark studio',
}

const GALLERY = [
    {
        file: `${ADS}/Ads/Quadem Digital Ad.mov`,
        alt: 'A gold and silver B monogram resolving on a dark ground, from a Quadem Digital brand identity reel',
    },
    {
        file: `${ADS}/Ads/Facebook awareness campaign video.mov`,
        alt: 'A man walking through an appliance showroom past screens, from a Quadem Digital awareness advert',
    },
    {
        file: `${DRIVE}/QuadEM Agency/BRAND CONTENTS/YOU CAN TRUST US.mp4`,
        alt: 'Quadem Digital social graphic reading "You can trust us with all your business solutions", listing the services and the website address',
    },
    {
        file: `${DRIVE}/ALL QUADEM DIGITAL PROJECTS/Quadem Digital Enterprise/quadem_01_founder_intro.mp4`,
        alt: 'A man at a desk of monitors showing website designs, under a wall sign reading Design Build Grow',
    },

    // Enter Vex Consult, a client campaign in four cuts.
    { file: `${ADS}/EnterVEX/Enter Vex 1.mov`, alt: 'Enter Vex Consult advert: a consultant greeting a client across a desk in a Ghanaian office' },
    { file: `${ADS}/EnterVEX/entervex 2.mov`, alt: 'Enter Vex Consult advert: a presenter in a teal shirt speaking to camera about business registration' },
    { file: `${ADS}/EnterVEX/Entervex 3.mov`, alt: 'Enter Vex Consult advert: a young man on the phone in a busy Ghanaian street market' },
    { file: `${ADS}/EnterVEX/entervex4.mov`, alt: 'Enter Vex Consult advert: office scenes of documents being handed over and paperwork completed' },

    // Style All Clothing, a client campaign: the concept cut, five clips, end card.
    { file: `${ADS}/Style all clothing/Concept 2.mov`, alt: 'Style All Clothing advert: a man in an embroidered maroon kaftan presenting in a menswear showroom' },
    { file: `${ADS}/Style all clothing/CLIP 1.mp4`, alt: 'Style All Clothing clip: a man inspecting a patterned African print shirt on a rail' },
    { file: `${ADS}/Style all clothing/CLIP 2.mp4`, alt: 'Style All Clothing clip: a man in a blue kaftan looking frustrated in a busy street' },
    { file: `${ADS}/Style all clothing/CLIP 3.mp4`, alt: 'Style All Clothing clip: a man in an embroidered maroon kaftan gesturing in a tailoring showroom' },
    { file: `${ADS}/Style all clothing/CLIP 4.mp4`, alt: 'Style All Clothing clip: a phone screen showing a virtual try-on of an outfit, over a circuit board background' },
    { file: `${ADS}/Style all clothing/CLIP 5.mp4`, alt: 'Style All Clothing clip: a man in a maroon kaftan smiling in a menswear showroom' },
    { file: `${ADS}/Style all clothing/END CARD.mp4`, alt: 'Style All Clothing end card: the brand crest over an aerial view of a Ghanaian city at sunset' },

    // QuadERP, Quadem's own retail software, in vertical cuts.
    { file: `${ERP}/quaderp_vertical_v2.mp4`, alt: 'QuadERP vertical advert: "Your whole shop on one screen", showing the sales and stock dashboard' },
    { file: `${ERP}/quaderp_vertical_sample.mp4`, alt: 'QuadERP vertical advert showing the dashboard and the line "Momo. Cash. Card. One till. Every payment."' },
    { file: `${ERP}/tt1.mp4`, alt: 'QuadERP short: a full sale completed in eleven seconds on the point of sale screen' },
    { file: `${ERP}/tt2.mp4`, alt: 'QuadERP short: stock and staff tracking on one screen' },
    { file: `${ERP}/tt3.mp4`, alt: 'QuadERP short: theft alerts on the shop dashboard' },
    { file: `${ERP}/tt4.mp4`, alt: 'QuadERP short: sales figures on the QuadERP dashboard' },
    { file: `${ERP}/tt5.mp4`, alt: 'QuadERP short: the QuadERP till accepting mobile money, cash and card' },
]

const ALL = [SHOWREEL, ...GALLERY]

/* ------------------------------------------------------------------ upload */

async function findByFilename(name) {
    const url = `${BASE}/api/media?where%5Bfilename%5D%5Bequals%5D=${encodeURIComponent(name)}&depth=0&limit=1`
    const r = await fetch(url, { headers: auth })
    if (!r.ok) return null
    return (await r.json()).docs?.[0] || null
}

async function upload(item) {
    const name = basename(item.file)
    if (!existsSync(item.file)) {
        console.error(`  MISSING on disk: ${item.file}`)
        return null
    }
    const existing = await findByFilename(name)
    if (existing) {
        console.log(`  already in the CMS as media ${existing.id}, skipping the upload`)
        return existing
    }

    const bytes = readFileSync(item.file)
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: name.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4' }), name)
    /*
      Payload's REST upload takes the document as one JSON part called
      _payload, not as separate form fields. Sent as separate fields it
      answers 400 "The following field is invalid: Alt", because alt is
      required and never arrived.
    */
    form.append('_payload', JSON.stringify({ alt: item.alt, videoUsage: 'playable' }))

    const r = await fetch(`${BASE}/api/media`, { method: 'POST', headers: auth, body: form })
    const out = await r.json().catch(() => ({}))
    if (!r.ok) {
        console.error(`  FAILED HTTP ${r.status}: ${JSON.stringify(out).slice(0, 400)}`)
        return null
    }
    const doc = out.doc || out
    console.log(`  uploaded as media ${doc.id}  (${(statSync(item.file).size / 1048576).toFixed(1)}MB, status ${doc.videoStatus || 'n/a'})`)
    return doc
}

const uploaded = new Map()

if (!WIRE_ONLY) {
    const list = ONLY ? [ALL[Number(ONLY) - 1]].filter(Boolean) : ALL
    console.log(`${DRY ? 'Would upload' : 'Uploading'} ${list.length} file(s).\n`)
    for (const [i, item] of list.entries()) {
        const name = basename(item.file)
        const mb = existsSync(item.file) ? (statSync(item.file).size / 1048576).toFixed(1) : '?'
        console.log(`${String(i + 1).padStart(2)}/${list.length}  ${name}  ${mb}MB`)
        if (DRY) {
            console.log(`  alt: ${item.alt}`)
            continue
        }
        const doc = await upload(item)
        if (doc) uploaded.set(item.file, doc.id)
    }
    if (DRY) {
        console.log('\nDry run. Nothing was uploaded.')
        process.exit(0)
    }
    if (ONLY) {
        console.log('\nSingle file done. Re-run without --only to do the rest.')
        process.exit(0)
    }
}

/* -------------------------------------------------------------------- wire */

async function idFor(item) {
    if (uploaded.has(item.file)) return uploaded.get(item.file)
    const doc = await findByFilename(basename(item.file))
    return doc ? doc.id : null
}

const showreelId = await idFor(SHOWREEL)
if (!showreelId) {
    console.error('\nThe showreel is not in the CMS. Not touching the page.')
    process.exit(1)
}

const galleryIds = []
for (const item of GALLERY) {
    const id = await idFor(item)
    if (id) galleryIds.push({ image: id })
    else console.error(`  not in the CMS, left out of the gallery: ${basename(item.file)}`)
}

const current = await (await fetch(`${BASE}/api/globals/videoProductionPage?depth=0`, { headers: auth })).json()

const patch = {
    showreel: {
        ...(current.showreel || {}),
        heading: current.showreel?.heading || 'Showreel',
        // The blocker is gone, so the section stops advertising itself as empty.
        isComingSoon: false,
        videoFile: showreelId,
    },
    portfolioGallery: {
        ...(current.portfolioGallery || {}),
        heading: current.portfolioGallery?.heading || 'Work gallery',
        images: galleryIds,
    },
}

console.log(`\nWiring the page: showreel media ${showreelId}, ${galleryIds.length} gallery item(s).`)

const r = await fetch(`${BASE}/api/globals/videoProductionPage`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify(patch),
})
const out = await r.json().catch(() => ({}))
if (!r.ok) {
    console.error(`FAILED HTTP ${r.status}: ${JSON.stringify(out).slice(0, 600)}`)
    process.exit(1)
}

const saved = out.result || out.doc || out
const savedGallery = saved?.portfolioGallery?.images?.length ?? 0
const savedShowreel = saved?.showreel?.videoFile
if (!savedShowreel || savedGallery !== galleryIds.length) {
    console.error(`Saved back as showreel=${savedShowreel}, gallery=${savedGallery}. That is not what was sent.`)
    console.error('Payload drops fields the deployed app does not declare. Check the CMS deploy.')
    process.exit(1)
}

console.log(`Done. Showreel set and ${savedGallery} gallery items live.`)
console.log('Transcoding runs after upload, so give it a few minutes before judging the page.')
