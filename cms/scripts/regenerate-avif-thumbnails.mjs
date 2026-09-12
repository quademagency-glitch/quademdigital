/**
 * Backfill the 400px AVIF derivative onto media uploaded before it existed.
 *
 * WHY
 *
 * A browser picks a file from within one format's list, so the narrowest entry
 * offered is the smallest it can possibly take, whatever the `sizes` attribute
 * says. The AVIF list used to start at 800px, so the founder's portrait painted
 * a 74px circle on a phone out of the 800px file, and the 22 images of 113
 * whose source is narrower than 1200px had exactly one AVIF entry and no choice
 * at all. Some of those are 72KB blog and case study covers.
 *
 * `AVIF_WIDTHS` in src/lib/mediaPresets.ts now includes `thumbnail`, so every
 * NEW upload gets it. This is for everything already in the library.
 *
 * HOW
 *
 * It re-uploads each original back onto its own document. Payload regenerates
 * every derivative from it, writes the size records and puts the files in the
 * bucket, which is the same path a normal upload takes. Generating the one file
 * by hand and writing the columns directly would be faster and would be a
 * second, parallel implementation of resizing that could drift from the real
 * one, which is the thing that caused this bug.
 *
 * ORDER MATTERS. Deploy the CMS first. Until the running app declares
 * `thumbnailAvif`, it strips it from the response and generates nothing, and
 * this script will report success while changing nothing. See cms/CLAUDE.md,
 * "A migration is half the job". The check below refuses to run in that state.
 *
 * USAGE
 *
 *   node scripts/regenerate-avif-thumbnails.mjs                 # list what it would do
 *   node scripts/regenerate-avif-thumbnails.mjs --apply --limit=1
 *   node scripts/regenerate-avif-thumbnails.mjs --apply --id=42
 *   node scripts/regenerate-avif-thumbnails.mjs --apply
 *
 * Idempotent: a document that already has thumbnailAvif is skipped, so it is
 * safe to re-run after a failure or an interruption.
 */

const CMS = process.env.PUBLIC_PAYLOAD_URL || process.env.CMS_URL || 'https://cms.quademdigital.com'
const KEY = process.env.PAYLOAD_API_KEY

const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const val = (f) => {
  const a = args.find((x) => x.startsWith(`${f}=`))
  return a ? a.split('=')[1] : null
}

const APPLY = has('--apply')
const ONLY_ID = val('--id')
const LIMIT = val('--limit') ? Number(val('--limit')) : Infinity

if (!KEY) {
  console.error('PAYLOAD_API_KEY is not set. It is needed to write to the media library.')
  process.exit(1)
}

const auth = { Authorization: `users API-Key ${KEY}` }
const kb = (n) => (n == null ? '?' : `${Math.round(n / 102.4) / 10}KB`)

const listRes = await fetch(`${CMS}/api/media?limit=1000&depth=0`, { headers: auth })
if (!listRes.ok) {
  console.error(`Could not list media from ${CMS}: HTTP ${listRes.status}`)
  process.exit(1)
}
const docs = (await listRes.json()).docs || []

/*
  Does the running app know about the new size at all? If not, every write below
  would come back looking fine and generate nothing. Any doc that already has it
  proves the deploy landed; with none, the answer is ambiguous and the script
  says so rather than guessing.
*/
const images = docs.filter((d) => (d.mimeType || '').startsWith('image'))
const already = images.filter((d) => d.sizes?.thumbnailAvif?.url)
const todo = images
  .filter((d) => !d.sizes?.thumbnailAvif?.url)
  .filter((d) => (ONLY_ID ? String(d.id) === String(ONLY_ID) : true))

console.log(`${images.length} images. ${already.length} already have a 400px AVIF, ${todo.length} do not.`)

if (!APPLY) {
  console.log('\nDry run. Nothing was written. Re-run with --apply.\n')
  for (const d of todo.slice(0, Number.isFinite(LIMIT) ? LIMIT : 20)) {
    const avif = Object.keys(d.sizes || {}).filter((k) => k.includes('Avif') && d.sizes[k]?.url)
    console.log(`  ${String(d.id).padStart(4)}  ${d.filename}`)
    console.log(`        source ${d.width}x${d.height}, avif sizes now: ${avif.join(', ') || 'none'}`)
    console.log(`        smallest avif on offer: ${kb(d.sizes?.mediumAvif?.filesize)}`)
  }
  if (todo.length > 20) console.log(`  ... and ${todo.length - 20} more`)
  process.exit(0)
}

if (already.length === 0 && !ONLY_ID) {
  console.error(
    '\nNo document has a 400px AVIF yet, so it is not possible to tell from here\n' +
      'whether the CMS has been deployed with the new size or not. Deploy it, then\n' +
      'run this on a single document first:\n\n' +
      `  node scripts/regenerate-avif-thumbnails.mjs --apply --id=${todo[0]?.id ?? '<id>'}\n\n` +
      'and check that its sizes include thumbnailAvif before doing the rest.',
  )
  process.exit(2)
}

let done = 0
let failed = 0
let saved = 0

for (const d of todo.slice(0, Number.isFinite(LIMIT) ? LIMIT : todo.length)) {
  try {
    // The original, which is the only copy kept at full quality and the right
    // thing to resize from. Resizing a derivative would compress twice.
    const fileRes = await fetch(`${CMS}/api/media/file/${encodeURIComponent(d.filename)}`, { headers: auth })
    if (!fileRes.ok) throw new Error(`could not fetch original: HTTP ${fileRes.status}`)
    const bytes = Buffer.from(await fileRes.arrayBuffer())

    /*
      multipart/form-data, with the Content-Type left to fetch so the boundary
      survives. Setting it by hand drops the boundary and Payload rejects the
      upload as malformed. See cms/CLAUDE.md.
    */
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: d.mimeType }), d.filename)
    form.append('_payload', JSON.stringify({ alt: d.alt ?? '' }))

    const put = await fetch(`${CMS}/api/media/${d.id}`, { method: 'PATCH', headers: auth, body: form })
    if (!put.ok) throw new Error(`PATCH failed: HTTP ${put.status} ${(await put.text()).slice(0, 200)}`)

    const updated = (await put.json()).doc
    const made = updated?.sizes?.thumbnailAvif
    if (!made?.url) throw new Error('no thumbnailAvif on the response: is the CMS deployed with the new size?')

    const before = d.sizes?.mediumAvif?.filesize ?? 0
    saved += Math.max(0, before - (made.filesize ?? 0))
    done++
    console.log(`  ok   ${d.filename}  400px avif ${kb(made.filesize)} (was ${kb(before)} at the smallest)`)
  } catch (err) {
    failed++
    console.error(`  FAIL ${d.filename}: ${err.message}`)
  }
}

console.log(`\n${done} regenerated, ${failed} failed.`)
if (done) {
  console.log(
    `A small rendering of one of these now costs about ${kb(saved / done)} less than it did.`,
  )
}
process.exit(failed ? 1 : 0)
