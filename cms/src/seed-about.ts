// @ts-nocheck
import { config as dotenvConfig } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenvConfig({ path: path.resolve(__dirname, '../.env') })

const { Client } = pg

const FOUNDER_NAME = 'Ernest'
const TITLE = 'About Quadem Digital'
const HEADLINE = "Hi, I'm Ernest, the person behind Quadem Digital."
const SUBHEADLINE = "I work directly with every client: no handoffs, no account managers, no bloat."
const BIO = `I started Quadem with one belief: great design and smart strategy shouldn't just look good. It should make you money.

I'll be straight with you. Quadem is new. That's exactly why working with us is different. You won't be passed to a junior or treated as an account number in a bloated agency. You get me: building your website, running your campaigns, and personally invested in your results.

What I lack in years, I make up for in hunger and accountability. I move fast, I communicate directly (usually on WhatsApp), and I treat your business like it's my own, because right now, my reputation is built one client at a time, on the quality of your results.

If you want a premium website, a brand that turns heads, or marketing that actually brings in customers, and you want to deal with a real person who cares, let's talk.`

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  // Ensure new columns exist (idempotent)
  await client.query(`ALTER TABLE about ADD COLUMN IF NOT EXISTS founder_name text`)
  await client.query(`ALTER TABLE about ADD COLUMN IF NOT EXISTS subheadline text`)
  console.log('✓ Columns ensured')

  // Upsert: Payload globals use a single row; insert if missing, update if present
  const existing = await client.query(`SELECT id FROM about LIMIT 1`)

  if (existing.rows.length > 0) {
    await client.query(
      `UPDATE about SET
        founder_name = $1,
        title        = $2,
        headline     = $3,
        subheadline  = $4,
        bio          = $5,
        updated_at   = NOW()
       WHERE id = $6`,
      [FOUNDER_NAME, TITLE, HEADLINE, SUBHEADLINE, BIO, existing.rows[0].id],
    )
    console.log('✓ About global updated (row id:', existing.rows[0].id, ')')
  } else {
    await client.query(
      `INSERT INTO about (title, founder_name, headline, subheadline, bio, updated_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [TITLE, FOUNDER_NAME, HEADLINE, SUBHEADLINE, BIO],
    )
    console.log('✓ About global inserted (new row)')
  }

  await client.end()
  console.log('Done.')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
