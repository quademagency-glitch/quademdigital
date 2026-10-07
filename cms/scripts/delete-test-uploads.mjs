#!/usr/bin/env node
/*
  Deletes the sample PDFs the CMS tests left in the live documents bucket.

  Approved by Ernest on 7 October 2026. Dry run by default.

  WHAT THEY ARE

  cms/vitest.setup.ts loaded cms/.env, which names the live buckets, so until
  commit 2cf00900 every file a test uploaded (sample agreements, and the
  signing copies made from them) went to production storage while its record
  stayed in the local test database. 93 of them, all named
  test-<13-digit timestamp>-<kind>-<client>.pdf, at the bucket's root and under
  signing/, uploaded on 6 October 2026. Private, and pointed at by nothing.

  WHY NOTHING ELSE CAN GO

  A file is deleted only if its name has the tests' shape AND nothing in the
  live database names it. Every table with a file name in it is read first,
  old versions included (documents, proposals, onboarding documents, signature
  requests, signed documents, profile photos, and any added later), and a file
  any of them names is left alone whatever it is called.

  Every file to be deleted is copied to the backup drive first. Afterwards the
  bucket is listed again: the deleted files must be gone, and every file the
  database names must still be there.

  Run, from the repo root:
    node cms/scripts/delete-test-uploads.mjs
    node cms/scripts/delete-test-uploads.mjs --confirm
*/

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(HERE, '..', 'package.json'))
require('dotenv').config({ path: join(HERE, '..', '.env'), quiet: true })
const { S3Client, ListObjectsV2Command, GetObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3')
const { Client } = require('pg')

const CONFIRM = process.argv.includes('--confirm')
const BUCKET = process.env.S3_DOCUMENTS_BUCKET
const BACKUPS = '/Volumes/QUADEM/BACKUPS/quadem-cms'
if (!BUCKET || !process.env.DATABASE_URL) {
  console.error('Need S3_DOCUMENTS_BUCKET and DATABASE_URL in cms/.env.')
  process.exit(2)
}

/** The tests' own naming: test-<Date.now()>-<kind>-<client>.pdf (tests/int/api.int.spec.ts). */
const TEST_UPLOAD = /(^|\/)test-\d{13}-[A-Za-z0-9_-]+\.pdf$/

const s3 = new S3Client({
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '' },
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT || undefined,
})

async function listAll() {
  const all = []
  let token
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token }))
    all.push(...(r.Contents || []).map((o) => ({ key: o.Key, size: o.Size ?? 0, at: o.LastModified })))
    token = r.IsTruncated ? r.NextContinuationToken : undefined
  } while (token)
  return all
}

/** Every file the live database names, as its key in the bucket. Read only. */
async function namedByDatabase() {
  const connect = async (ssl) => {
    const c = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 20000, ...(ssl ? { ssl: { rejectUnauthorized: false } } : {}) })
    await c.connect()
    return c
  }
  const db = await connect(false).catch(() => connect(true))
  try {
    await db.query('BEGIN READ ONLY')
    const keys = new Set()
    // Every table that names a file, and its old versions, rather than a list that could fall behind.
    const cols = (await db.query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name IN ('filename', 'prefix', 'version_filename', 'version_prefix')`)).rows
    const tables = new Map()
    for (const { table_name: t, column_name: c } of cols) tables.set(t, [...(tables.get(t) ?? []), c])
    for (const [table, has] of tables) {
      for (const [file, prefix] of [['filename', 'prefix'], ['version_filename', 'version_prefix']]) {
        if (!has.includes(file)) continue
        const rows = (await db.query(`SELECT "${file}" AS f${has.includes(prefix) ? `, "${prefix}" AS p` : ''} FROM public."${table}" WHERE "${file}" IS NOT NULL`)).rows
        for (const r of rows) keys.add(r.p ? `${r.p}/${r.f}` : r.f)
      }
    }
    await db.query('COMMIT')
    return keys
  } finally {
    await db.end()
  }
}

const mb = (n) => `${(n / 1_000_000).toFixed(2)} MB`
const top = (key) => (key.includes('/') ? `${key.split('/')[0]}/` : '(root)')

const before = await listAll()
const named = await namedByDatabase()
const present = new Set(before.map((o) => o.key))
const candidates = before.filter((o) => TEST_UPLOAD.test(o.key) && !named.has(o.key))
const spared = before.filter((o) => TEST_UPLOAD.test(o.key) && named.has(o.key))

const groups = {}
for (const o of candidates) groups[top(o.key)] = (groups[top(o.key)] || 0) + 1
const dates = candidates.map((o) => o.at.toISOString()).sort()
console.log(`In the bucket: ${before.length} files.`)
console.log(`Named by the live database: ${named.size} (${[...named].filter((k) => present.has(k)).length} of them in this bucket).`)
console.log(`Test uploads nothing names: ${candidates.length}, ${mb(candidates.reduce((n, o) => n + o.size, 0))}, ${JSON.stringify(groups)}${dates.length ? `, uploaded ${dates[0].slice(0, 16)} to ${dates.at(-1).slice(0, 16)}` : ''}.`)
if (spared.length) console.log(`Named like a test but used by the database, so kept: ${spared.map((o) => o.key).join(', ')}`)
console.log(`Left untouched: ${before.length - candidates.length}.`)

if (!candidates.length) {
  console.log('\nNothing to delete.')
  process.exit(0)
}
if (!CONFIRM) {
  console.log('\nDry run. Nothing was copied or deleted. Add --confirm to do it.')
  process.exit(0)
}

// A copy of every file first, so a mistake is a re-upload away from undone.
if (!existsSync(BACKUPS)) {
  console.error(`The backup drive is not there (${BACKUPS}). Nothing was deleted.`)
  process.exit(2)
}
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
const backup = join(BACKUPS, `test-uploads-${stamp}`)
for (const o of candidates) {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: o.key }))
  const bytes = Buffer.from(await res.Body.transformToByteArray())
  if (bytes.length !== o.size) {
    console.error(`${o.key} came back ${bytes.length} bytes, expected ${o.size}. Nothing was deleted.`)
    process.exit(1)
  }
  const file = join(backup, o.key)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, bytes, { mode: 0o600 })
}
writeFileSync(join(backup, 'manifest.json'), JSON.stringify({ bucket: BUCKET, copiedAt: new Date().toISOString(), files: candidates }, null, 2), { mode: 0o600 })
console.log(`\nCopied all ${candidates.length} to ${backup}`)

let failed = 0
for (let i = 0; i < candidates.length; i += 1000) {
  const chunk = candidates.slice(i, i + 1000)
  const res = await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: chunk.map((o) => ({ Key: o.key })), Quiet: true } }))
  for (const e of res.Errors || []) {
    console.error(`  could not delete ${e.Key}: ${e.Message}`)
    failed++
  }
}

// Listed again rather than trusted.
const after = await listAll()
const left = new Set(after.map((o) => o.key))
const stillThere = candidates.filter((o) => left.has(o.key))
const lost = [...named].filter((k) => present.has(k) && !left.has(k))
const othersLost = before.filter((o) => !candidates.includes(o) && !left.has(o.key))
console.log(`Now in the bucket: ${after.length} files (was ${before.length}).`)
if (failed || stillThere.length || lost.length || othersLost.length) {
  if (stillThere.length) console.error(`${stillThere.length} test uploads are still there.`)
  if (lost.length || othersLost.length) console.error(`Missing that should not be: ${[...lost, ...othersLost.map((o) => o.key)].join(', ')}. Restore from ${backup}.`)
  process.exit(1)
}
console.log(`Deleted ${candidates.length}. Every file the database names is still there, and nothing else moved.`)
