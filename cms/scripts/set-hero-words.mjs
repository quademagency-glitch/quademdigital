/**
 * Shorten the words the homepage headline cycles through.
 *
 * WHY
 *
 * The hero sets its type to fit the LONGEST word, because the words never wrap
 * and they share one grid cell. Two of the four were phrases, "Brand Identity"
 * and "SEO Campaigns" at 14 characters, so all four printed at the size the
 * longest one needed: 89px, where the design this follows sets 220px for a six
 * letter word. Shortening two words roughly doubles the headline for all of
 * them, with no code change.
 *
 * These are the same four words the site already falls back to when the CMS is
 * unreachable, so nothing new is being invented here.
 *
 * WHAT IT PRESERVES
 *
 * Each row keeps its id and its hidden fields: rawMedia and mockupMedia are
 * foreign keys into the media library, and a write that dropped them would
 * orphan those uploads. Only `service` is touched.
 *
 * USAGE
 *
 *   node scripts/set-hero-words.mjs            # show before and after, write nothing
 *   node scripts/set-hero-words.mjs --apply    # write it
 *   node scripts/set-hero-words.mjs --revert   # put the old words back
 *
 * The site caches CMS reads for 60 seconds and the edge for another 60, so the
 * change shows up within about two minutes. No deploy is needed: the page reads
 * the CMS when somebody asks for it.
 */

const CMS = process.env.PUBLIC_PAYLOAD_URL || 'https://cms.quademdigital.com'
const KEY = process.env.PAYLOAD_API_KEY

if (!KEY) {
  console.error('PAYLOAD_API_KEY is not set.')
  process.exit(1)
}

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const REVERT = args.includes('--revert')

/* Old phrase -> short word. Anything not listed is left exactly as it is. */
const SHORTEN = {
  'Brand Identity': 'Brands',
  'SEO Campaigns': 'Campaigns',
}
const LENGTHEN = Object.fromEntries(Object.entries(SHORTEN).map(([a, b]) => [b, a]))
const map = REVERT ? LENGTHEN : SHORTEN

const auth = { Authorization: `users API-Key ${KEY}` }

const res = await fetch(`${CMS}/api/globals/homepage?depth=0`, { headers: auth })
if (!res.ok) {
  console.error(`Could not read the homepage global: HTTP ${res.status}`)
  process.exit(1)
}
const homepage = await res.json()
const rows = homepage.heroServices || []

if (rows.length === 0) {
  console.error('The hero has no words in it. Nothing to do.')
  process.exit(1)
}

/* The headline is sized by the longest word, so that is the number to watch. */
const longest = (list) => Math.max(...list.map((w) => w.length))
const before = rows.map((r) => r.service).filter(Boolean)
const after = rows.map((r) => map[r.service] ?? r.service).filter(Boolean)

const px = (chars) => Math.round(Math.min(220, (43 * 16) / (chars * 0.55)))

console.log('\n  now :', before.join(', '))
console.log('        longest', longest(before), 'characters, headline prints at about', px(longest(before)) + 'px')
console.log('\n  after:', after.join(', '))
console.log('        longest', longest(after), 'characters, headline prints at about', px(longest(after)) + 'px')

if (before.join('|') === after.join('|')) {
  console.log('\nAlready as requested. Nothing written.')
  process.exit(0)
}

if (!APPLY && !REVERT) {
  console.log('\nNothing written. Re-run with --apply.\n')
  process.exit(0)
}

/*
  Every row goes back whole, with only `service` changed. Sending just the words
  would drop the media relationships on the rows, which are hidden in the admin
  but still real foreign keys.
*/
const heroServices = rows.map((r) => ({ ...r, service: map[r.service] ?? r.service }))

const put = await fetch(`${CMS}/api/globals/homepage`, {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ heroServices }),
})

if (!put.ok) {
  console.error(`Write failed: HTTP ${put.status} ${(await put.text()).slice(0, 300)}`)
  process.exit(1)
}

const saved = (await put.json()).result ?? (await Promise.resolve(null))
const nowWords = (saved?.heroServices || []).map((r) => r.service).filter(Boolean)
console.log('\nWritten. The CMS now holds:', nowWords.join(', ') || '(could not read it back)')

const keptMedia = (saved?.heroServices || []).filter((r) => r.rawMedia || r.mockupMedia).length
console.log(`Rows still carrying their media link: ${keptMedia} of ${(saved?.heroServices || []).length}`)
console.log('Live within about two minutes. No deploy needed.\n')
