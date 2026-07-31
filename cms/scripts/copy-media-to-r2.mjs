/**
 * One-time copy of existing CMS media into the S3/R2 bucket, so turning on
 * S3 storage doesn't 404 the 33 files currently served from the app's disk.
 *
 * RUN THIS BEFORE setting S3_BUCKET on the live CMS — while the CMS still
 * serves files from disk (otherwise the downloads below hit an empty bucket).
 *
 *   S3_BUCKET=quadem-cms-media \
 *   S3_ACCESS_KEY_ID=xxx \
 *   S3_SECRET_ACCESS_KEY=yyy \
 *   S3_REGION=auto \
 *   S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com \
 *   node scripts/copy-media-to-r2.mjs
 *
 * Idempotent: files already in the bucket are skipped, so it's safe to re-run.
 */
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const CMS = process.env.CMS_URL || 'https://cms.quademdigital.com'
const bucket = process.env.S3_BUCKET
const missing = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_ENDPOINT'].filter((k) => !process.env[k])
if (missing.length) {
  console.error('Missing env vars: ' + missing.join(', '))
  process.exit(1)
}

const s3 = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
})

// 1. List every media doc and collect the original filename + every resized variant.
const res = await fetch(`${CMS}/api/media?limit=1000&depth=0`)
if (!res.ok) {
  console.error(`Could not list media from ${CMS}: HTTP ${res.status}`)
  process.exit(1)
}
const docs = (await res.json()).docs || []
const filenames = new Set()
for (const d of docs) {
  if (d.filename) filenames.add(d.filename)
  if (d.sizes) for (const size of Object.values(d.sizes)) if (size && size.filename) filenames.add(size.filename)
}
console.log(`Found ${docs.length} media docs → ${filenames.size} files (originals + resized variants) to copy.`)

// 2. Copy each file into the bucket (skip if already there).
let copied = 0, skipped = 0, failed = 0
for (const fn of filenames) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: fn }))
    skipped++
    continue
  } catch { /* not in bucket yet — copy it */ }

  try {
    const r = await fetch(`${CMS}/api/media/file/${encodeURIComponent(fn)}`)
    if (!r.ok) { console.log(`  ! source missing (HTTP ${r.status}): ${fn}`); failed++; continue }
    const body = Buffer.from(await r.arrayBuffer())
    const contentType = r.headers.get('content-type') || 'application/octet-stream'
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: fn, Body: body, ContentType: contentType }))
    console.log(`  ✓ ${fn} (${body.length} bytes)`)
    copied++
  } catch (e) {
    console.log(`  ! failed: ${fn} — ${e.message}`)
    failed++
  }
}

console.log(`\nDone. copied=${copied} skipped=${skipped} failed=${failed}`)
if (failed) process.exitCode = 1
