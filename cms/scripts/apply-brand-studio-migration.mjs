/**
 * One-shot applier for migration 20260730_000000_add_brand_studio_page.
 *
 * Use this because `pnpm migrate` currently throws `db.execute is not a
 * function` (see cms/CLAUDE.md). Run it against production with Railway:
 *
 *     railway run node scripts/apply-brand-studio-migration.mjs
 *
 * It is safe to re-run: every statement is IF NOT EXISTS / duplicate-guarded,
 * and the payload_migrations row is only inserted if it isn't already there.
 */
import pg from 'pg'

const MIGRATION_NAME = '20260730_000000_add_brand_studio_page'

const UP_SQL = `
CREATE TABLE IF NOT EXISTS "brand_studio_page" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" varchar,
  "description" varchar,
  "settings_whatsapp_number" varchar,
  "settings_calendly_url" varchar,
  "hero_eyebrow" varchar,
  "hero_heading_top" varchar,
  "hero_heading_accent" varchar,
  "hero_subheading" varchar,
  "hero_primary_cta_text" varchar,
  "hero_secondary_cta_text" varchar,
  "hero_trust_text" varchar,
  "how_section_heading" varchar,
  "how_section_subheading" varchar,
  "pricing_section_heading" varchar,
  "pricing_section_subheading" varchar,
  "pricing_section_addons_text" varchar,
  "pricing_section_unsure_text" varchar,
  "why_section_heading" varchar,
  "faq_section_heading" varchar,
  "final_cta_heading" varchar,
  "final_cta_subheading" varchar,
  "final_cta_primary_cta_text" varchar,
  "final_cta_whatsapp_cta_text" varchar,
  "updated_at" timestamp(3) with time zone,
  "created_at" timestamp(3) with time zone
);
ALTER TABLE "brand_studio_page" ADD COLUMN IF NOT EXISTS "title" varchar;
ALTER TABLE "brand_studio_page" ADD COLUMN IF NOT EXISTS "description" varchar;
CREATE TABLE IF NOT EXISTS "brand_studio_page_how_section_steps" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "number" varchar,
  "title" varchar,
  "description" varchar
);
CREATE TABLE IF NOT EXISTS "brand_studio_page_pricing_section_plans" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "name" varchar NOT NULL,
  "price" varchar NOT NULL,
  "blurb" varchar,
  "is_popular" boolean DEFAULT false,
  "cta_text" varchar
);
CREATE TABLE IF NOT EXISTS "brand_studio_page_pricing_section_plans_features" (
  "_order" integer NOT NULL,
  "_parent_id" varchar NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "feature" varchar
);
CREATE TABLE IF NOT EXISTS "brand_studio_page_why_section_items" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "title" varchar,
  "description" varchar
);
CREATE TABLE IF NOT EXISTS "brand_studio_page_faq_section_faqs" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "question" varchar NOT NULL,
  "answer" varchar NOT NULL
);
DO $$ BEGIN
 ALTER TABLE "brand_studio_page_how_section_steps" ADD CONSTRAINT "brand_studio_page_how_section_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_studio_page"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "brand_studio_page_pricing_section_plans" ADD CONSTRAINT "brand_studio_page_pricing_section_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_studio_page"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "brand_studio_page_pricing_section_plans_features" ADD CONSTRAINT "brand_studio_page_pricing_section_plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_studio_page_pricing_section_plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "brand_studio_page_why_section_items" ADD CONSTRAINT "brand_studio_page_why_section_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_studio_page"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "brand_studio_page_faq_section_faqs" ADD CONSTRAINT "brand_studio_page_faq_section_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_studio_page"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "brand_studio_page_how_section_steps_order_idx" ON "brand_studio_page_how_section_steps" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "brand_studio_page_how_section_steps_parent_id_idx" ON "brand_studio_page_how_section_steps" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "brand_studio_page_pricing_section_plans_order_idx" ON "brand_studio_page_pricing_section_plans" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "brand_studio_page_pricing_section_plans_parent_id_idx" ON "brand_studio_page_pricing_section_plans" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "brand_studio_page_pricing_section_plans_features_order_idx" ON "brand_studio_page_pricing_section_plans_features" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "brand_studio_page_pricing_section_plans_features_parent_id_idx" ON "brand_studio_page_pricing_section_plans_features" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "brand_studio_page_why_section_items_order_idx" ON "brand_studio_page_why_section_items" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "brand_studio_page_why_section_items_parent_id_idx" ON "brand_studio_page_why_section_items" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "brand_studio_page_faq_section_faqs_order_idx" ON "brand_studio_page_faq_section_faqs" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "brand_studio_page_faq_section_faqs_parent_id_idx" ON "brand_studio_page_faq_section_faqs" USING btree ("_parent_id");
`

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set. Run this with `railway run` so the env is injected.')
  process.exit(1)
}

const client = new pg.Client({ connectionString })

try {
  await client.connect()
  await client.query('BEGIN')
  await client.query(UP_SQL)

  const existing = await client.query('SELECT 1 FROM payload_migrations WHERE name = $1', [MIGRATION_NAME])
  if (existing.rowCount === 0) {
    const { rows } = await client.query('SELECT COALESCE(MAX(batch), 0) + 1 AS next FROM payload_migrations')
    const nextBatch = rows[0].next
    await client.query('INSERT INTO payload_migrations (name, batch) VALUES ($1, $2)', [MIGRATION_NAME, nextBatch])
    console.log(`Recorded ${MIGRATION_NAME} in payload_migrations (batch ${nextBatch}).`)
  } else {
    console.log(`${MIGRATION_NAME} already recorded in payload_migrations — schema ensured, no new row.`)
  }

  await client.query('COMMIT')
  console.log('Brand Studio schema applied successfully.')
} catch (err) {
  await client.query('ROLLBACK').catch(() => {})
  console.error('Migration failed, rolled back:', err)
  process.exitCode = 1
} finally {
  await client.end()
}
