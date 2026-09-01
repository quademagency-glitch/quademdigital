#!/usr/bin/env node
/*
  Makes the two missing service photographs with Nano Banana, and optionally
  puts the chosen one on the service.

  AI Automation and Fieldwork are the only two services with no picture. On
  /services/ they fall back to a grey box with their icon in it, next to five
  services that show a photograph, so they read as unfinished.

  WHY THIS IS A SCRIPT AND NOT A DONE JOB
  ---------------------------------------
  As of 1 September 2026 every route to a generated image is at zero, and the
  two Gemini keys are stuck for two different reasons that read the same:

    Bloom                0 credits
    Higgsfield           0 credits, and nano_banana_pro costs 2 per image
    GEMINI_API_KEY       free tier. Not a rate limit: the free tier grants NO
                         image generations at all, and says so, "limit: 0".
                         Billing was never turned on for its project. Both
                         gemini-3-pro-image and gemini-2.5-flash-image agree.
    GEMINI_IMAGE_API_KEY billing IS set up, as prepaid, and the balance has run
                         out: "Your prepayment credits are depleted". Top it up
                         at https://ai.studio/projects and this runs unchanged.

  Nano Banana Pro is roughly 15 US cents an image, so all four options below
  cost well under a dollar.

  So the prompts are written and checked into the repo rather than left in a
  chat log. When one of those is topped up, this is one command.

  THE HOUSE LOOK
  --------------
  Taken from the five service photographs already on the site: near black and
  deep navy ground, one cool blue light source, shallow depth of field, Black
  subjects. The "nothing readable" clause is repeated three ways on purpose.
  These models are good at text, and the site's rule is that no artwork carries
  words or numbers: baked-in text cannot be edited later, cannot be translated,
  and goes stale without anyone noticing.

  CHECK THE OUTPUT BEFORE UPLOADING. The models still slip letters onto screens
  and paper. That is why generating and uploading are two separate commands.

  Run:
    node cms/scripts/generate-service-photographs.mjs
        writes PNGs to cms/scripts/generated/ and stops. Look at them.

    node cms/scripts/generate-service-photographs.mjs --upload=ai-automation-a
        uploads that one file, sets it as the service's image, and verifies the
        write came back.
*/

import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT_DIR = join(HERE, 'generated')

const uploadArg = process.argv.find((a) => a.startsWith('--upload='))
const UPLOAD = uploadArg ? uploadArg.split('=')[1] : null

function readEnv(file) {
    const out = {}
    if (!existsSync(file)) return out
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
    return out
}

// GEMINI_API_KEY lives in cms/.env, the CMS keys; the site keys are in the root.
const env = { ...readEnv(join(ROOT, '.env')), ...readEnv(join(ROOT, 'cms', '.env')), ...process.env }

/* Nano Banana Pro. gemini-2.5-flash-image is the cheaper original and takes the
   same request shape, if the Pro quota is the thing in the way. */
const MODEL = 'gemini-3-pro-image'

const STYLE =
    'Cinematic editorial photograph, low key lighting, near black and deep navy palette with ' +
    'cool cyan highlights, one soft blue light source, shallow depth of field, high contrast, ' +
    'photorealistic, 35mm. Absolutely no text, no letters, no numbers, no words, no logos, no ' +
    'watermarks and no readable interface anywhere in the frame. Any screen or paper shows only ' +
    'soft abstract blue and grey shapes, deliberately out of focus and unreadable.'

/* Two options per service. The service each one belongs to is what --upload
   uses to decide where the picture goes, so the key prefix matters. */
const JOBS = [
    {
        key: 'ai-automation-a',
        slug: 'ai-automation',
        prompt:
            'A Black woman in her thirties, a small business owner, stands behind the counter of ' +
            'her own shop late at night after closing. She holds a smartphone and looks at it with ' +
            'a calm, unhurried expression, as though something has already been handled for her. ' +
            'The phone screen throws cool blue light onto her face and hands. The shop behind her ' +
            'is dark. ' + STYLE,
    },
    {
        key: 'ai-automation-b',
        slug: 'ai-automation',
        prompt:
            'A smartphone lying face up on a dark wooden counter in a closed shop at night, its ' +
            'screen glowing cool blue and lighting the surface around it. In the soft background a ' +
            'Black man in his thirties is turning away, further into the dark shop, out of focus. ' +
            'Most of the frame is the glowing phone and the darkness. ' + STYLE,
    },
    {
        key: 'fieldwork-a',
        slug: 'fieldwork',
        prompt:
            'A Black man in his thirties sits at a desk late at night, focused, working down a ' +
            'printed sheet of paper with a pen in his hand, an open laptop beside him. The laptop ' +
            'screen throws cool blue light across the desk, the paper and his hands. The room ' +
            'behind him is very dark. ' + STYLE,
    },
    {
        key: 'fieldwork-b',
        slug: 'fieldwork',
        prompt:
            'A Black woman in her thirties stands at a window at night in a dark room, holding an ' +
            'open notebook and a pen, looking out at distant blurred city lights below. Her face is ' +
            'lit cool blue from the window. She looks like someone deciding who to go and see ' +
            'tomorrow. ' + STYLE,
    },
]

async function generate() {
    /* GEMINI_IMAGE_API_KEY first, GEMINI_API_KEY as the fallback. They are
       separate because cms/src/utils/aiEmailGenerator.ts uses GEMINI_API_KEY to
       write emails, and paying for pictures should not mean moving that feature
       onto a different Google account by accident. Either one works here. */
    const KEY = env.GEMINI_IMAGE_API_KEY || env.GEMINI_API_KEY
    if (!KEY) {
        console.error('No GEMINI_IMAGE_API_KEY or GEMINI_API_KEY in cms/.env .')
        process.exit(2)
    }
    mkdirSync(OUT_DIR, { recursive: true })

    let written = 0
    const problems = []
    for (const job of JOBS) {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: job.prompt }] }],
                    generationConfig: {
                        responseModalities: ['IMAGE'],
                        // 3:2 to match the five service photographs, which are 1600x1063.
                        imageConfig: { aspectRatio: '3:2', imageSize: '2K' },
                    },
                }),
            },
        )
        const out = await res.json()

        if (out.error) {
            const msg = out.error.message || ''
            problems.push(msg)
            console.error(`  ${job.key}: ${out.error.status || res.status}`)
            console.error(`     ${msg.split('\n')[0].slice(0, 160)}`)
            continue
        }

        const part = (out.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData)
        if (!part) {
            console.error(`  ${job.key}: the model answered without an image.`)
            continue
        }
        const file = join(OUT_DIR, `${job.key}.png`)
        writeFileSync(file, Buffer.from(part.inlineData.data, 'base64'))
        written++
        console.log(`  ${job.key}: ${Math.round(statSync(file).size / 1024)} KB  ${file}`)
    }

    if (written === 0) {
        const all = problems.join(' ')
        console.error('')
        console.error('Nothing was generated. Two different walls look the same from here:')
        console.error('')
        if (/limit: 0/.test(all)) {
            console.error('  "limit: 0" is not a rate limit. This key is on the free tier, and the')
            console.error('  free tier grants no image generations at all. Billing has never been')
            console.error('  turned on for its project.')
        }
        if (/prepayment credits are depleted/i.test(all)) {
            console.error('  "prepayment credits are depleted" means billing IS set up on this')
            console.error('  key, as prepaid, and the balance has run out. Top it up and this')
            console.error('  runs unchanged. Nano Banana Pro is roughly 15 US cents an image, so')
            console.error('  all four options here cost well under a dollar.')
        }
        console.error('')
        console.error('  Either way: https://ai.studio/projects')
        process.exit(1)
    }

    console.log('')
    console.log(`${written} of ${JOBS.length} generated.`)
    console.log('Look at every one before uploading. These models still slip letters onto screens')
    console.log('and paper, and the site takes no artwork with words or numbers in it.')
    console.log('Then: node cms/scripts/generate-service-photographs.mjs --upload=<key>')
}

async function upload(key) {
    const BASE = env.PUBLIC_PAYLOAD_URL
    const API = env.PAYLOAD_API_KEY
    if (!BASE || !API) {
        console.error('Need PUBLIC_PAYLOAD_URL and PAYLOAD_API_KEY in the repo root .env.')
        process.exit(2)
    }
    const job = JOBS.find((j) => j.key === key)
    if (!job) {
        console.error(`No prompt called "${key}". Known: ${JOBS.map((j) => j.key).join(', ')}`)
        process.exit(2)
    }
    const file = join(OUT_DIR, `${key}.png`)
    if (!existsSync(file)) {
        console.error(`${file} does not exist. Generate first, then look at it, then upload.`)
        process.exit(2)
    }

    const headers = { Authorization: `users API-Key ${API}` }

    // Payload wants every document field in one _payload JSON part. Sending alt
    // as its own form field is rejected with "field is invalid: Alt".
    const form = new FormData()
    form.append('file', new Blob([readFileSync(file)], { type: 'image/png' }), `service-${key}.png`)
    form.append('_payload', JSON.stringify({ alt: `Illustration for the ${job.slug} service` }))

    const up = await fetch(`${BASE}/api/media`, { method: 'POST', headers, body: form })
    const media = await up.json()
    if (!up.ok) {
        console.error(`Upload failed: HTTP ${up.status}`)
        console.error(JSON.stringify(media, null, 2).slice(0, 700))
        process.exit(1)
    }
    const mediaId = media.doc?.id
    console.log(`Uploaded as media ${mediaId} (${media.doc?.filename}).`)

    const find = await fetch(
        `${BASE}/api/services?where[slug][equals]=${job.slug}&depth=0&limit=1`,
        { headers },
    )
    const doc = (await find.json()).docs?.[0]
    if (!doc) {
        console.error(`No service with slug "${job.slug}". The image is uploaded but unattached.`)
        process.exit(1)
    }

    const patch = { featuredImage: mediaId, mockupMedia: mediaId, mockupStatus: 'ready' }
    const res = await fetch(`${BASE}/api/services/${doc.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
    })
    const out = await res.json()
    if (!res.ok) {
        console.error(`HTTP ${res.status}`)
        console.error(JSON.stringify(out, null, 2).slice(0, 700))
        process.exit(1)
    }

    // Payload drops fields the running app does not declare and does not error
    // when it does, so read the write back rather than trusting the 200.
    const got = out.doc?.featuredImage
    const gotId = typeof got === 'object' && got ? got.id : got
    if (String(gotId) !== String(mediaId)) {
        console.error(`featuredImage came back as ${gotId}, not ${mediaId}. The write did not take.`)
        process.exit(1)
    }
    console.log(`/services/${job.slug}/ now uses it. The edge cache holds public pages for 60 seconds.`)
}

if (UPLOAD) await upload(UPLOAD)
else await generate()
