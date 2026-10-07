#!/usr/bin/env node
/*
  Lets the team portal put large files straight into the private documents
  bucket (src/lib/stagedUploads.ts), and clears anything left half-way.

    node scripts/apply-bucket-cors.mjs           shows what is there and what would change
    node scripts/apply-bucket-cors.mjs --apply   makes the change

  Two settings on S3_DOCUMENTS_BUCKET, each merged with whatever rules are
  already there (only rules with these IDs are replaced):

  - CORS "team-portal-uploads": the browser at team.quademdigital.com may PUT,
    and nothing else. A PUT still needs a signed link from the CMS, which takes
    one file of one size and type, for ten minutes, into incoming/<their id>/.
    No reading, no listing, no other site.
  - Lifecycle "expire-incoming": anything still under incoming/ after a day is
    deleted. A finished upload removes its own holding copy straight away; this
    only catches the ones abandoned half-way.

  Reads the bucket and keys from cms/.env, or the environment.
*/
import {
  GetBucketCorsCommand,
  GetBucketLifecycleConfigurationCommand,
  PutBucketCorsCommand,
  PutBucketLifecycleConfigurationCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.join(here, '..', '.env')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

const apply = process.argv.includes('--apply')
const bucket = process.env.S3_DOCUMENTS_BUCKET
if (!bucket || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
  console.error('S3_DOCUMENTS_BUCKET and the S3 keys are needed (cms/.env).')
  process.exit(1)
}
const region = process.env.S3_REGION && process.env.S3_REGION !== 'auto' ? process.env.S3_REGION : 'us-east-1'
const s3 = new S3Client({
  region,
  endpoint: process.env.S3_ENDPOINT || undefined,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
})

const CORS_RULE = {
  ID: 'team-portal-uploads',
  AllowedOrigins: ['https://team.quademdigital.com'],
  AllowedMethods: ['PUT'],
  AllowedHeaders: ['content-type'],
  ExposeHeaders: ['ETag'],
  MaxAgeSeconds: 3600,
}
const LIFECYCLE_RULE = {
  ID: 'expire-incoming',
  Status: 'Enabled',
  Filter: { Prefix: 'incoming/' },
  Expiration: { Days: 1 },
  AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
}

const none = (err, code) => err?.name === code || err?.Code === code
const corsNow = await s3
  .send(new GetBucketCorsCommand({ Bucket: bucket }))
  .then((r) => r.CORSRules ?? [])
  .catch((err) => {
    if (none(err, 'NoSuchCORSConfiguration')) return []
    throw err
  })
const lifeNow = await s3
  .send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }))
  .then((r) => r.Rules ?? [])
  .catch((err) => {
    if (none(err, 'NoSuchLifecycleConfiguration')) return []
    throw err
  })

const corsNext = [...corsNow.filter((r) => r.ID !== CORS_RULE.ID), CORS_RULE]
const lifeNext = [...lifeNow.filter((r) => r.ID !== LIFECYCLE_RULE.ID), LIFECYCLE_RULE]
const show = (label, v) => console.log(`${label}:\n${JSON.stringify(v, null, 2)}\n`)

console.log(`Bucket: ${bucket} (${region})\n`)
show('CORS now', corsNow)
show('CORS after', corsNext)
show('Lifecycle now', lifeNow)
show('Lifecycle after', lifeNext)

if (!apply) {
  console.log('Nothing written. Run again with --apply to make this change.')
  process.exit(0)
}
await s3.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: corsNext } }))
await s3.send(new PutBucketLifecycleConfigurationCommand({ Bucket: bucket, LifecycleConfiguration: { Rules: lifeNext } }))
const check = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }))
console.log(`Written. CORS rules on the bucket now: ${(check.CORSRules ?? []).map((r) => r.ID ?? '(no id)').join(', ')}`)
