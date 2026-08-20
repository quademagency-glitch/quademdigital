// @ts-nocheck
import { config as dotenvConfig } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenvConfig({ path: path.resolve(__dirname, '../.env') })

const { Client } = pg

const HERO_HEADLINE = 'Premium websites and marketing for Ghanaian businesses ready to grow.'
const HERO_TAGLINE =
  'A founder-led digital studio in Accra. You work directly with the person building your brand, so you get fast turnarounds, honest pricing and work designed to make you money, not just look good.'
const PRIMARY_CTA_LABEL = 'Book a Free Strategy Call'
const PRIMARY_CTA_LINK = '#contact'
const SECONDARY_CTA_LABEL = 'See How We Work'
const SECONDARY_CTA_LINK = '#work'
const RISK_REVERSAL_HEADING = 'New agency. No risk to you.'
const RISK_REVERSAL_BODY =
  "We're building our reputation, so we go further to earn your trust: milestone-based payments, a clear timeline agreed before we start, and revisions until you're happy. You bet on our hunger. We bet on the results."

const TRUST_HIGHLIGHTS = [
  {
    icon: '👤',
    title: 'You Talk to the Founder',
    description: 'Not an account manager. Direct communication, rapid execution, real accountability.',
  },
  {
    icon: '🇬🇭',
    title: 'Built for Ghana',
    description: "MoMo checkout, WhatsApp-first selling, local SEO. We know how your customers actually buy.",
  },
  {
    icon: '📈',
    title: 'Results-Focused Design',
    description: 'Every site and campaign is built to convert, with clear before-and-after metrics agreed up front.',
  },
]

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  // Ensure all new scalar columns exist (idempotent — safe to re-run)
  const colDefs = [
    'ALTER TABLE homepage ADD COLUMN IF NOT EXISTS hero_headline text',
    'ALTER TABLE homepage ADD COLUMN IF NOT EXISTS hero_tagline text',
    'ALTER TABLE homepage ADD COLUMN IF NOT EXISTS hero_subheadline text',
    'ALTER TABLE homepage ADD COLUMN IF NOT EXISTS primary_cta_label text',
    'ALTER TABLE homepage ADD COLUMN IF NOT EXISTS primary_cta_link text',
    'ALTER TABLE homepage ADD COLUMN IF NOT EXISTS secondary_cta_label text',
    'ALTER TABLE homepage ADD COLUMN IF NOT EXISTS secondary_cta_link text',
    'ALTER TABLE homepage ADD COLUMN IF NOT EXISTS show_stats boolean',
    'ALTER TABLE homepage ADD COLUMN IF NOT EXISTS risk_reversal_enabled boolean',
    'ALTER TABLE homepage ADD COLUMN IF NOT EXISTS risk_reversal_heading text',
    'ALTER TABLE homepage ADD COLUMN IF NOT EXISTS risk_reversal_body text',
  ]
  for (const sql of colDefs) await client.query(sql)
  console.log('✓ Scalar columns ensured')

  // Upsert homepage row
  const existing = await client.query('SELECT id FROM homepage LIMIT 1')
  let homepageId: unknown

  if (existing.rows.length > 0) {
    homepageId = existing.rows[0].id
    await client.query(
      `UPDATE homepage SET
         hero_headline         = $1,
         hero_tagline          = $2,
         hero_subheadline      = NULL,
         primary_cta_label     = $3,
         primary_cta_link      = $4,
         secondary_cta_label   = $5,
         secondary_cta_link    = $6,
         show_stats            = false,
         risk_reversal_enabled = true,
         risk_reversal_heading = $7,
         risk_reversal_body    = $8,
         updated_at            = NOW()
       WHERE id = $9`,
      [
        HERO_HEADLINE, HERO_TAGLINE,
        PRIMARY_CTA_LABEL, PRIMARY_CTA_LINK,
        SECONDARY_CTA_LABEL, SECONDARY_CTA_LINK,
        RISK_REVERSAL_HEADING, RISK_REVERSAL_BODY,
        homepageId,
      ],
    )
    console.log('✓ Homepage row updated (id:', homepageId, ')')
  } else {
    const ins = await client.query(
      `INSERT INTO homepage
         (hero_headline, hero_tagline, primary_cta_label, primary_cta_link,
          secondary_cta_label, secondary_cta_link, show_stats,
          risk_reversal_enabled, risk_reversal_heading, risk_reversal_body,
          updated_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,false,true,$7,$8,NOW(),NOW())
       RETURNING id`,
      [
        HERO_HEADLINE, HERO_TAGLINE,
        PRIMARY_CTA_LABEL, PRIMARY_CTA_LINK,
        SECONDARY_CTA_LABEL, SECONDARY_CTA_LINK,
        RISK_REVERSAL_HEADING, RISK_REVERSAL_BODY,
      ],
    )
    homepageId = ins.rows[0].id
    console.log('✓ Homepage row inserted (id:', homepageId, ')')
  }

  // Detect homepage.id type so the trust_highlights table uses the right FK type
  const idTypeRow = await client.query(`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'homepage' AND column_name = 'id' LIMIT 1
  `)
  const isUUID = idTypeRow.rows[0]?.data_type?.toLowerCase().includes('uuid')
  const idColDef = isUUID ? 'id uuid DEFAULT gen_random_uuid() PRIMARY KEY' : 'id serial PRIMARY KEY'
  const parentColType = isUUID ? 'uuid' : 'integer'

  // Ensure trust highlights table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS homepage_trust_highlights (
      ${idColDef},
      _order      integer NOT NULL,
      _parent_id  ${parentColType} NOT NULL,
      icon        text,
      title       text,
      description text
    )
  `)

  // Replace all trust highlights for this homepage row
  await client.query('DELETE FROM homepage_trust_highlights WHERE _parent_id = $1', [homepageId])
  for (let i = 0; i < TRUST_HIGHLIGHTS.length; i++) {
    const h = TRUST_HIGHLIGHTS[i]
    await client.query(
      'INSERT INTO homepage_trust_highlights (_order, _parent_id, icon, title, description) VALUES ($1,$2,$3,$4,$5)',
      [i + 1, homepageId, h.icon, h.title, h.description],
    )
  }
  console.log('✓ Trust highlights seeded (', TRUST_HIGHLIGHTS.length, 'cards)')

  // Clear hero services — headline is now a complete sentence; typewriter is off
  const svcTable = await client.query(
    `SELECT to_regclass('homepage_hero_services') AS tbl`,
  )
  if (svcTable.rows[0].tbl) {
    await client.query('DELETE FROM homepage_hero_services WHERE _parent_id = $1', [homepageId])
    console.log('✓ Hero services cleared (typewriter disabled)')
  }

  await client.end()
  console.log('Done.')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
