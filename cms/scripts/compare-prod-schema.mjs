/**
 * Read-only schema drift check: compares a live database against the committed
 * code snapshot (src/migrations/20260801_000000_rebaseline_snapshot.json, which
 * is the full current code schema) and reports differences by name only.
 *
 * It NEVER writes: it opens a read-only transaction and runs SELECTs against
 * information_schema. It prints table/column NAMES only — no row data, no
 * secrets. The connection string stays in your environment; nothing is logged.
 *
 * Usage (run in YOUR terminal so the URL never leaves your machine):
 *
 *   cd cms
 *   PROD_DATABASE_URL="postgresql://…:PORT/…" node scripts/compare-prod-schema.mjs
 *
 * Use Railway's DATABASE_PUBLIC_URL (with its port). SSL is auto-detected.
 */
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const snapPath = path.join(dir, '../src/migrations/20260801_000000_rebaseline_snapshot.json')
const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'))

// code schema: table -> Set(columns)   (strip the "public." prefix)
const code = new Map()
for (const [t, tv] of Object.entries(snap.tables)) {
  code.set(t.replace(/^public\./, ''), new Set(Object.keys(tv.columns)))
}

const url = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL
if (!url) {
  console.error('Set PROD_DATABASE_URL to the database you want to check (read-only).')
  process.exit(1)
}
try {
  const u = new URL(url)
  console.log(`Target: ${u.hostname}:${u.port || '(default)'}  (read-only)`)
} catch { /* ignore */ }

const preferSsl = !/railway\.internal|localhost|127\.0\.0\.1/.test(url)
async function connect() {
  for (const ssl of [preferSsl, !preferSsl]) {
    const c = new pg.Client({ connectionString: url, ssl: ssl ? { rejectUnauthorized: false } : false })
    try { await c.connect(); return c } catch (e) {
      console.log(`  connect failed (ssl ${ssl ? 'on' : 'off'}): ${e.code || e.message}`)
      try { await c.end() } catch {}
    }
  }
  throw new Error('Could not connect (SSL on or off). Check host/port in the URL.')
}

const client = await connect()
try {
  await client.query('BEGIN TRANSACTION READ ONLY')
  const { rows } = await client.query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public' ORDER BY table_name, column_name`,
  )
  await client.query('ROLLBACK')

  const live = new Map()
  for (const r of rows) {
    if (!live.has(r.table_name)) live.set(r.table_name, new Set())
    live.get(r.table_name).add(r.column_name)
  }

  const ignoreTable = (t) => t === 'payload_migrations'
  const missingTables = []
  const missingCols = []
  const extraCols = []

  for (const [t, cols] of code) {
    if (ignoreTable(t)) continue
    if (!live.has(t)) { missingTables.push(t); continue }
    const lc = live.get(t)
    for (const c of cols) if (!lc.has(c)) missingCols.push(`${t}.${c}`)
  }
  for (const [t, cols] of live) {
    if (ignoreTable(t) || !code.has(t)) continue
    const cc = code.get(t)
    for (const c of cols) if (!cc.has(c)) extraCols.push(`${t}.${c}`)
  }
  const extraTables = [...live.keys()].filter((t) => !ignoreTable(t) && !code.has(t))

  console.log(`\nProd public tables: ${live.size} | code tables: ${code.size}`)
  console.log(`\n=== TABLES the code expects but PROD is MISSING (${missingTables.length}) ===`)
  console.log(missingTables.sort().join('\n') || '  (none)')
  console.log(`\n=== COLUMNS the code expects but PROD is MISSING (${missingCols.length}) ===`)
  console.log(missingCols.sort().join('\n') || '  (none)')
  console.log(`\n=== Extra tables in PROD not in code (${extraTables.length}) ===`)
  console.log(extraTables.sort().join('\n') || '  (none)')
  console.log(`\n=== Extra columns in PROD not in code (${extraCols.length}) ===`)
  console.log(extraCols.sort().join('\n') || '  (none)')

  console.log('\nVERDICT:', (missingTables.length + missingCols.length === 0)
    ? 'prod HAS everything the code expects, safe; new migrations will be no-ops.'
    : 'prod is MISSING objects the code reads, those reads can 500; the new migrations will repair them.')
} finally {
  await client.end()
}
