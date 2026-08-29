#!/usr/bin/env node
/*
  Creates the blogPosts documents that put the analysis pieces into the blog
  index and the RSS feed.

  RUN THIS AFTER THE SITE IS DEPLOYED, NOT BEFORE.

  The pages themselves are static .astro routes. Astro matches static route
  segments ahead of dynamic ones, so each file wins its URL and blog/[slug].astro
  never serves it. These documents exist only to feed the two surfaces that
  cannot see a file: src/pages/blog/index.astro and src/pages/rss.xml.ts, both of
  which are driven entirely by the Payload collection.

  Which is exactly why the order matters. Create a document before the route is
  live and the blog index starts advertising a URL that answers 404, on the live
  site, for as long as it takes to deploy.

  The documents carry no body. The .astro file renders the page, so anything
  typed into `content` here would be written and never seen. scripts/check-blog-routes.mjs
  fails the build if that happens, and fails it if a slug is ever edited so the
  two drift apart.

  Run:
    node cms/scripts/seed-analysis-blog-posts.mjs --dry-run
    node cms/scripts/seed-analysis-blog-posts.mjs --draft   # staged, not live
    node cms/scripts/seed-analysis-blog-posts.mjs           # published
*/

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DRY = process.argv.includes('--dry-run')
const DRAFT = process.argv.includes('--draft')

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

const PUBLISHED_AT = '2026-08-25T09:00:00.000Z'

const POSTS = [
    {
        slug: 'uk-aesthetics-search',
        title: "Two of Britain's biggest skin clinics are quietly losing Google. One tiny rival is eating them.",
        excerpt:
            'Twenty six months of search data on three UK aesthetics clinics. Two lost roughly a third of their organic traffic. The third grew 75% while deleting nearly half its pages.',
        // rss.xml.ts uses linkedInPost verbatim as the feed description when it
        // is present, so it is written to stand alone in a reader.
        linkedInPost:
            "I pulled 26 months of search data on three UK aesthetics clinics. Two have lost roughly a third of their organic traffic. The third grew 75%, and did it while deleting nearly half its pages. All figures are Semrush estimates, and the method and its limits are on the page.",
        author: 'Ernest Avorwlanu',
        seoDescription:
            'Three UK aesthetics clinics, 26 months of Semrush search estimates. Two lost roughly a third of their organic traffic. The third grew 75% while deleting nearly half its pages.',
    },
    {
        slug: 'small-business-website-crawl-2026',
        title: 'We crawled 2,828 small business websites. 42.9% of them still had no HTTPS.',
        excerpt:
            'A crawl of 3,928 businesses listed on Google Maps across the UK, the Gulf and the US in August 2026. What their websites actually do, with the denominators attached.',
        linkedInPost:
            'We crawled the websites of 3,928 businesses listed on Google Maps across the UK, the Gulf and the US, and ran eight basic checks on each homepage. Of the 2,828 that loaded, 42.9% still had no HTTPS and only 15.6% passed all eight. The method, the sample and its limits are all on the page.',
        author: 'Ernest Avorwlanu',
        seoDescription:
            'Original research: 3,928 businesses from Google Maps, 2,828 websites that loaded, eight basic checks. 42.9% had no HTTPS. Only 15.6% passed all eight. August 2026.',
    },
]

const headers = { 'Content-Type': 'application/json', Authorization: `users API-Key ${KEY}` }
const status = DRAFT ? 'draft' : 'published'

for (const post of POSTS) {
    const found = await fetch(`${BASE}/api/blogPosts?where[slug][equals]=${post.slug}&depth=0&limit=1&draft=true`, { headers })
    if (!found.ok) {
        console.error(`Could not read blogPosts: HTTP ${found.status}`)
        process.exit(1)
    }
    const existing = (await found.json()).docs?.[0]

    const body = { ...post, publishedAt: PUBLISHED_AT, _status: status }

    if (DRY) {
        console.log(`${existing ? 'UPDATE' : 'CREATE'}  /blog/${post.slug}/   _status: ${status}`)
        console.log(`   ${post.title}`)
        continue
    }

    const res = existing
        ? await fetch(`${BASE}/api/blogPosts/${existing.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
        : await fetch(`${BASE}/api/blogPosts`, { method: 'POST', headers, body: JSON.stringify(body) })

    const out = await res.json()
    if (!res.ok) {
        console.error(`HTTP ${res.status} on ${post.slug}`)
        console.error(JSON.stringify(out, null, 2).slice(0, 1200))
        process.exit(1)
    }
    console.log(`${existing ? 'Updated' : 'Created'} /blog/${post.slug}/  (_status ${out.doc?._status})`)
}

if (DRY) {
    console.log('\nDry run. Nothing was written.')
} else {
    console.log('\nNow run: node scripts/check-blog-routes.mjs')
    console.log('It must exit 0. Anything else means a route and a document have drifted apart.')
}
