#!/usr/bin/env node
/**
 * Give every file in the media bucket a long cache header.
 *
 * S3 sends whatever headers an object carries, and these carry none: Payload's
 * storage adapter sets ACL and Content-Type on upload and nothing else. That
 * did not matter while every image was served through the CMS, because
 * cms/next.config.ts adds the header on the way out. It matters the moment
 * anything reads from the bucket directly, which is the whole point of putting
 * a CDN in front of it: an origin with no Cache-Control gives a CDN nothing to
 * work with and a browser nothing to remember.
 *
 * Safe because of what these filenames are. Payload embeds the dimensions in
 * every resized copy, so a name means one exact rendition for ever. The one
 * case where content changes behind a name is `image-weight.mjs --replace`, and
 * `buildPayloadImageUrl` already appends `?v=` from the document's updatedAt for
 * exactly that reason.
 *
 * Copy-in-place, which is how S3 changes a header without re-uploading bytes.
 * Content-Type has to be restated: REPLACE means replace, and leaving it out
 * turns every picture into application/octet-stream.
 *
 *   node scripts/set-media-cache-headers.mjs           # say what would change
 *   node scripts/set-media-cache-headers.mjs --apply   # change it
 */

import fs from 'node:fs'
import path from 'node:path'
import { S3Client, ListObjectsV2Command, HeadObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3'

const APPLY = process.argv.includes('--apply')

/** Matches what the video pipeline already writes for its derivatives. */
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

const envPath = path.join(process.cwd(), '.env')
if (!fs.existsSync(envPath)) {
  console.error('Run this from the cms directory: it reads the S3 credentials from cms/.env')
  process.exit(1)
}
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
)

const Bucket = env.S3_BUCKET
if (!Bucket) {
  console.error('S3_BUCKET is not set, so there is no bucket to work on.')
  process.exit(1)
}

const s3 = new S3Client({
  region: env.S3_REGION || 'us-east-1',
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
})

console.log(`bucket ${Bucket}${APPLY ? '' : '   (dry run, nothing will be changed)'}\n`)

let token
const keys = []
do {
  const res = await s3.send(new ListObjectsV2Command({ Bucket, ContinuationToken: token, MaxKeys: 1000 }))
  keys.push(...(res.Contents || []).map((o) => o.Key))
  token = res.IsTruncated ? res.NextContinuationToken : undefined
} while (token)

console.log(`${keys.length} objects\n`)

let already = 0, changed = 0, failed = 0
const problems = []

for (const [i, Key] of keys.entries()) {
  let head
  try {
    head = await s3.send(new HeadObjectCommand({ Bucket, Key }))
  } catch (err) {
    failed++
    problems.push(`${Key}: could not be read (${err.name})`)
    continue
  }

  if (head.CacheControl === CACHE_CONTROL) {
    already++
    continue
  }

  if (!APPLY) {
    changed++
    if (changed <= 3) console.log(`  would set: ${Key}  (currently ${head.CacheControl ?? 'no header'})`)
    continue
  }

  try {
    await s3.send(new CopyObjectCommand({
      Bucket,
      Key,
      CopySource: `${Bucket}/${Key}`,
      MetadataDirective: 'REPLACE',
      CacheControl: CACHE_CONTROL,
      // Restated deliberately. See the note at the top.
      ContentType: head.ContentType,
      ...(head.ContentDisposition ? { ContentDisposition: head.ContentDisposition } : {}),
      ...(head.ContentEncoding ? { ContentEncoding: head.ContentEncoding } : {}),
      Metadata: head.Metadata || {},
    }))
    changed++
  } catch (err) {
    failed++
    problems.push(`${Key}: ${err.name} ${err.message}`)
  }

  if ((i + 1) % 200 === 0) console.log(`  ${i + 1}/${keys.length}...`)
}

console.log('')
console.log(`already correct : ${already}`)
console.log(`${APPLY ? 'changed        ' : 'would change   '} : ${changed}`)
if (failed) {
  console.log(`failed          : ${failed}`)
  for (const p of problems.slice(0, 10)) console.log(`  ${p}`)
}

if (!APPLY && changed) console.log('\nRun again with --apply to make the change.')

if (APPLY && changed) {
  // Read one back through the public URL, because the header a visitor gets is
  // the only one that counts.
  const sample = keys[0]
  const url = `https://${Bucket}.s3.${env.S3_REGION || 'us-east-1'}.amazonaws.com/${encodeURIComponent(sample)}`
  const res = await fetch(url)
  console.log(`\nchecking ${sample} over the public URL:`)
  console.log(`  HTTP ${res.status}`)
  console.log(`  content-type  ${res.headers.get('content-type')}`)
  console.log(`  cache-control ${res.headers.get('cache-control')}`)
}

process.exit(failed ? 1 : 0)
