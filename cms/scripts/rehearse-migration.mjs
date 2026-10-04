/*
  Runs a migration against the real database inside a transaction that is
  always rolled back: up, down, up again, then ROLLBACK. Nothing is kept.

  Every schema change on this project has been rehearsed this way before it
  shipped, by hand each time. This is that, written down. It reads the SQL out
  of the generated file (the sql`...` blocks in up() and down()), so it only
  suits generated migrations without interpolation, which is all of them.

    railway run --service quademdigital node scripts/rehearse-migration.mjs src/migrations/<name>.ts
*/
import fs from 'node:fs'
import pg from 'pg'

const file = process.argv[2]
if (!file) { console.error('Usage: node scripts/rehearse-migration.mjs <migration.ts>'); process.exit(1) }
if (!process.env.DATABASE_URL) { console.error('No DATABASE_URL. Run through `railway run`.'); process.exit(1) }

const src = fs.readFileSync(file, 'utf8')
const block = (name) => {
  const start = src.indexOf(`export async function ${name}`)
  if (start === -1) throw new Error(`No ${name}() in ${file}`)
  const rest = src.slice(start)
  const end = rest.indexOf('\nexport async function', 10)
  const body = end === -1 ? rest : rest.slice(0, end)
  return [...body.matchAll(/sql`([\s\S]*?)`/g)].map((m) => m[1]).join('\n')
}
const up = block('up'), down = block('down')
if (/\$\{/.test(up + down)) { console.error('This migration interpolates values; rehearse it another way.'); process.exit(1) }

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()
const tables = async () => Number((await client.query(`SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'`)).rows[0].count)
try {
  await client.query('BEGIN')
  const t0 = await tables()
  await client.query(up); const t1 = await tables()
  await client.query(down); const t2 = await tables()
  await client.query(up); const t3 = await tables()
  console.log(`tables: before ${t0}, after up ${t1}, after down ${t2}, after up again ${t3}`)
  console.log(t2 === t0 && t3 === t1 && t1 > t0 ? 'OK: up and down are inverse and repeatable' : 'CHECK: counts do not line up')
} catch (err) {
  console.error('FAILED inside the transaction:', err.message)
  process.exitCode = 1
} finally {
  await client.query('ROLLBACK')
  console.log('rolled back, after:', await tables())
  await client.end()
}
