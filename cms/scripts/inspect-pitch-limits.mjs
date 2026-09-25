/*
  Read-only. Answers one question: what does production actually hold in
  pitches.html, and is anything below the application capping its length.

  No writes. Run with: railway run --service quademdigital node scripts/inspect-pitch-limits.mjs
*/
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) {
  console.log('No DATABASE_URL in the environment. Run this through `railway run`.')
  process.exit(0)
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()

const col = await client.query(
  `SELECT data_type, character_maximum_length
     FROM information_schema.columns
    WHERE table_name = 'pitches' AND column_name = 'html'`,
)
console.log('pitches.html column:', col.rows[0]
  ? `${col.rows[0].data_type}${col.rows[0].character_maximum_length ? `(${col.rows[0].character_maximum_length})` : ' (no length cap)'}`
  : 'not found')

const pitches = await client.query(
  `SELECT id, slug, length(html) AS chars, created_at, updated_at
     FROM pitches ORDER BY created_at DESC LIMIT 12`,
)
console.log('\npitches in production, newest first:')
pitches.rows.forEach((p) =>
  console.log(`  id ${String(p.id).padEnd(4)} ${String(p.slug || '-').slice(0, 26).padEnd(28)} ${String(p.chars ?? 0).padStart(7)} chars  created ${new Date(p.created_at).toISOString().slice(0, 16).replace('T', ' ')}  updated ${new Date(p.updated_at).toISOString().slice(0, 16).replace('T', ' ')}`),
)

const mig = await client.query(`SELECT name FROM payload_migrations ORDER BY id DESC LIMIT 3`)
console.log('\nlast migrations applied in production:')
mig.rows.forEach((m) => console.log('  ' + m.name))

await client.end()
