#!/usr/bin/env node
/**
 * Repoints the live CMS from shoot-based Video Production to AI Video & Reels,
 * and folds in the monthly tiers from the retired Brand Studio page.
 *
 * Why this exists: the fallback arrays in
 * `src/pages/services/video-production.astro` are dead in production. The
 * `videoProductionPage` global is fully populated, so `X?.length ? X :
 * [fallback]` always takes the CMS branch, and Payload only applies a field's
 * `defaultValue` when the document is first created. The database is the only
 * source of truth for the page body.
 *
 * Why REST and not `payload.init({ config })`: the local-API version of this
 * script (the .ts sibling, kept for reference) hangs indefinitely booting the
 * Payload/Next config against the remote Railway Postgres. The REST API needs
 * no bootstrap and is what the CMS already exposes.
 *
 * The URL slug stays `/services/video-production/` and the global slug stays
 * `videoProductionPage` — only content changes. `slug` is deliberately never
 * sent for the services row: regenerating it to `ai-video-reels` would break
 * the URL, the sitemap and SERVICE_KEY_BY_SLUG.
 *
 * Run:  node cms/scripts/repoint-video-to-ai.mjs
 *       (reads PAYLOAD_API_KEY and PUBLIC_PAYLOAD_URL from the repo-root .env)
 *       --dry-run  prints what it would send and exits
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ENV = resolve(HERE, '../../.env')
const DRY = process.argv.includes('--dry-run')

const env = Object.fromEntries(
  readFileSync(ENV, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]
    }),
)

const BASE = env.PUBLIC_PAYLOAD_URL || 'https://cms.quademdigital.com'
const KEY = env.PAYLOAD_API_KEY
if (!KEY) throw new Error(`PAYLOAD_API_KEY not found in ${ENV}`)

const HEADERS = { Authorization: `users API-Key ${KEY}`, 'Content-Type': 'application/json' }

async function api(path, init = {}) {
  const res = await fetch(`${BASE}/api${path}`, { ...init, headers: { ...HEADERS, ...init.headers } })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error(`${path}: non-JSON response (${res.status})\n${text.slice(0, 400)}`)
  }
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}\n${JSON.stringify(body).slice(0, 600)}`)
  return body
}

// New artwork, uploaded 2026-08-16. Everything it replaces showed a camera crew
// on a lit set, which contradicts a service that never films.
//   112 hero-ai-video.webp     (1200x1500) replaces 52 / 109
//   113 service-ai-video.webp  (1600x1063) replaces 111 / 56
const HERO_MEDIA_ID = 112
const CARD_MEDIA_ID = 113

const svg = (paths) =>
  `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`

const services = [
  {
    title: 'Reels & TikToks',
    description:
      'Vertical video cut for Instagram, TikTok and YouTube Shorts. Captions burned in, the hook in the first second, sized right for every feed.',
    iconSvg: svg('<rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line>'),
  },
  {
    title: 'Video Ads',
    description:
      'Short ads for Meta and TikTok, delivered as three or four different hooks so you can test which one brings sales at the lowest cost.',
    iconSvg: svg('<polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>'),
  },
  {
    title: 'Product Videos',
    description:
      'Send us photos of what you sell. We turn them into motion, so your product moves on screen instead of sitting still in a feed.',
    iconSvg: svg('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>'),
  },
  {
    title: 'AI Presenter Videos',
    description:
      'A voice and a face on screen without anyone filming. Licensed AI presenters, or your own likeness with your written permission.',
    iconSvg: svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>'),
  },
]

const steps = [
  {
    number: '01',
    title: 'Brand kit',
    description:
      'You send your logo, colours, product photos and the offer you want pushed. We set it up once and reuse it on every video after that.',
  },
  {
    number: '02',
    title: 'Script & hooks',
    description:
      'We write the script and two or three opening hooks, and you approve them before anything is made. This is the stage where changes are cheap.',
  },
  {
    number: '03',
    title: 'We generate & edit',
    description:
      'We generate the visuals and voiceover with AI, then edit by hand: pacing, captions, your logo, your colours, licensed music.',
  },
  {
    number: '04',
    title: 'You approve & post',
    description:
      'You review, we fix what you flag, then you get the files sized for every platform. Nothing publishes without your yes.',
  },
]

// One one-off pack to try it, then the three monthly plans carried over
// verbatim from the retired Brand Studio page. The frontend tells the one-off
// card apart by `period` starting with "one-off" — keep that prefix.
const plans = [
  {
    name: 'Reel Pack',
    price: 'GH₵ 1,500',
    period: 'one-off · 3 reels',
    description: 'Try it once. Three reels made with AI, no subscription and no commitment.',
    isPopular: false,
    features: [
      '3 AI reels (up to 30 seconds each)',
      'Script and 2 hook options per reel',
      'Burned-in captions, your logo and your colours',
      'AI voiceover or licensed music',
      '2 revision rounds',
      'Sized for Reels, TikTok and Shorts (9:16, 1:1, 16:9)',
      'Delivered in about 5 working days',
    ].map((feature) => ({ feature })),
  },
  {
    name: 'Starter',
    price: 'GH₵ 1,800',
    period: 'per month',
    description: 'Stay consistent on one platform without doing it yourself.',
    isPopular: false,
    features: [
      '4 short-form videos (reels) / month',
      '12 branded posts / month',
      '1 platform of your choice',
      'Monthly content calendar',
    ].map((feature) => ({ feature })),
  },
  {
    name: 'Growth',
    price: 'GH₵ 3,500',
    period: 'per month',
    description: 'Content that keeps posting and ads that bring in sales.',
    isPopular: true,
    features: [
      '6 short-form videos (reels) / month',
      '20 branded posts / month',
      '8 ad creatives for testing',
      '2 to 3 platforms, cross-posted',
      'Monthly performance report',
    ].map((feature) => ({ feature })),
  },
  {
    name: 'Scale',
    price: 'GH₵ 8,000',
    period: 'per month',
    description: 'Full coverage across every platform for brands growing fast.',
    isPopular: false,
    features: [
      '10 short-form videos (reels) / month',
      '30 branded posts / month',
      '12 ad creatives + paid-ad creative',
      'All platforms covered',
      'Advanced analytics & reporting',
    ].map((feature) => ({ feature })),
  },
]

const faqs = [
  {
    question: 'Do you film anything?',
    answer:
      'No. There is no shoot, no camera, no crew and no location to book. Everything is made with AI tools and edited by hand. That is exactly why it costs a fraction of a shoot and lands in days instead of weeks.',
  },
  {
    question: 'Will it look fake?',
    answer:
      'Some AI video does. Ours does not go out until it looks right. We keep shots short, we use your real product photos wherever the product is on screen, and we cut anything that reads as odd. If a scene still looks wrong to you, we replace it. You see everything before it publishes.',
  },
  {
    question: 'Do you use my actual products and branding?',
    answer:
      'Yes. Send your logo, colours, fonts and product photos once and we build every video from them. Your product appears as your product, not a generic stand-in. If you have no photos yet we can generate product-accurate visuals, but real photos always come out better.',
  },
  {
    question: 'Can you put me, or my staff, in the videos?',
    answer:
      "Only with written permission. If you want your own face or voice used, you sign a short consent form and send us the reference material. Otherwise we use licensed AI presenters that are cleared for commercial use. We never use anybody's likeness without their say-so.",
  },
  {
    question: 'How many revisions do I get, and how fast is it?',
    answer:
      'Two revision rounds on every video, one at the script stage and one on the final cut. A one-off pack of three reels takes about five working days. Monthly plans run to a calendar you approve at the start of the month, so you always know what is coming and when.',
  },
  {
    question: 'Who owns the videos, and can I run them as paid ads?',
    answer:
      'You do, once the invoice is paid. Full commercial rights, ads included. The music and any AI presenters are licensed for commercial use, so nothing gets pulled for a rights claim later.',
  },
]

// --- 1. the page body -------------------------------------------------------
const page = await api('/globals/videoProductionPage?depth=0')

const pageUpdate = {
  // hero.badge/headline/subtitle are not rendered by the .astro page (they are
  // hardcoded there) but are written so the admin never shows editor copy that
  // contradicts the live page. hero.media moves off the film-crew still.
  hero: {
    ...(page.hero || {}),
    media: HERO_MEDIA_ID,
    badge: '✨ AI Video & Reels',
    headline: 'AI Video & Reels that keep your brand posting, with no shoot day',
    subtitle:
      'Every reel is built with AI from your logo, your products and your offer. No camera, no crew, nothing for you to organise. You approve the script, we deliver video you can post the same week.',
  },
  servicesSection: {
    ...(page.servicesSection || {}),
    heading: 'What we make',
    subtitle: 'Short-form video for the places your customers actually scroll.',
    services,
  },
  processSection: {
    ...(page.processSection || {}),
    heading: 'How it works',
    subtitle: 'Four steps, no shoot day, and nothing goes out without your sign-off.',
    steps,
  },
  pricingSection: {
    ...(page.pricingSection || {}),
    heading: 'AI Video & Reels pricing',
    subtitle:
      'One batch to try it, or a monthly plan that keeps you posting. Prices in Ghana Cedis, MoMo and bank transfer accepted.',
    note: '* One-off packs are billed up front. Monthly plans are billed monthly and you can cancel anytime. Add-ons: paid-ad management (10 to 15% of ad spend) and one-off launch campaigns.',
    plans,
  },
  faqSection: {
    ...(page.faqSection || {}),
    heading: 'Frequently Asked Questions',
    subtitle: 'The questions people actually ask before buying AI video.',
    faqs,
  },
  // Neither renders today (no showreel videoUrl, no gallery images), but the
  // copy would surface the moment either is filled in.
  showreel: { ...(page.showreel || {}), subtitle: "A few of the reels we've made recently." },
  portfolioGallery: { ...(page.portfolioGallery || {}), subtitle: 'A few frames from recent AI video work.' },
  ctaSection: {
    ...(page.ctaSection || {}),
    heading: 'Ready to stop going quiet?',
    subtitle:
      "Book a free 15-minute call. We'll show you exactly what your first three reels would look like, before you pay anything.",
  },
}

// --- 2. the /services/ overview card ---------------------------------------
// title, description and tags render straight from this row with no code
// fallback, so the rename is invisible without it.
const found = await api('/services?where[slug][equals]=video-production&limit=1&depth=0')
const svc = found.docs?.[0]

const svcUpdate = {
  title: 'AI Video & Reels',
  description:
    'Reels, ads and product videos made with AI. No shoot day, no crew, and your brand on screen every week.',
  tags: [{ tag: 'Reels & TikToks' }, { tag: 'AI Video Ads' }, { tag: 'Product Videos' }],
  featuredImage: CARD_MEDIA_ID,
  rawMedia: CARD_MEDIA_ID,
  mockupMedia: CARD_MEDIA_ID,
}

// --- 3. the homepage hero carousel -----------------------------------------
const home = await api('/globals/homepage?depth=0')
const heroServices = (home.heroServices || []).map((s) =>
  (s.service || '').toLowerCase().includes('video') ? { ...s, service: 'Reels', rawMedia: HERO_MEDIA_ID } : s,
)

if (DRY) {
  console.log('--- videoProductionPage ---')
  console.log(JSON.stringify(pageUpdate, null, 2).slice(0, 1500), '...')
  console.log('\n--- services row', svc?.id, '---')
  console.log(JSON.stringify(svcUpdate, null, 2))
  console.log('\n--- homepage heroServices ---')
  console.log(heroServices.map((s) => `${s.service} (media ${s.rawMedia})`).join(', '))
  process.exit(0)
}

console.log('Updating videoProductionPage...')
await api('/globals/videoProductionPage', { method: 'POST', body: JSON.stringify(pageUpdate) })
console.log(`  ok: ${services.length} services, ${steps.length} steps, ${plans.length} plans, ${faqs.length} faqs`)

if (!svc) {
  console.warn('WARNING: no services row with slug "video-production" — skipped the overview card.')
} else {
  console.log(`Updating services row ${svc.id}...`)
  await api(`/services/${svc.id}`, { method: 'PATCH', body: JSON.stringify(svcUpdate) })
  const after = await api(`/services/${svc.id}?depth=0`)
  console.log(`  ok: title="${after.title}" slug="${after.slug}"`)
  if (after.slug !== 'video-production') {
    console.error(`  !! SLUG CHANGED to "${after.slug}" — /services/video-production/ will 404. Revert it.`)
    process.exitCode = 1
  }
}

console.log('Updating homepage heroServices...')
await api('/globals/homepage', { method: 'POST', body: JSON.stringify({ heroServices }) })
console.log(`  ok: ${heroServices.map((s) => s.service).join(', ')}`)
console.log('\nDone. Allow ~60s for the Astro side cache (CACHE_TTL_MS) to expire.')
