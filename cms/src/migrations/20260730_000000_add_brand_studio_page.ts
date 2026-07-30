import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the `brandStudioPage` global (src/globals/BrandStudioPage.ts) to Postgres.
 * Production push is a no-op (push only runs in development), so the live DB
 * needs these tables created explicitly or every read of the global 500s.
 *
 * Table shapes mirror the existing brand_identity_page global (hero group +
 * pricing plans with a nested features array + steps/faqs arrays). Everything
 * is IF NOT EXISTS / wrapped in duplicate_object guards so it is safe to re-run.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "brand_studio_page" (
  	"id" serial PRIMARY KEY NOT NULL,
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
  CREATE INDEX IF NOT EXISTS "brand_studio_page_faq_section_faqs_parent_id_idx" ON "brand_studio_page_faq_section_faqs" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "brand_studio_page_how_section_steps" CASCADE;
  DROP TABLE IF EXISTS "brand_studio_page_pricing_section_plans_features" CASCADE;
  DROP TABLE IF EXISTS "brand_studio_page_pricing_section_plans" CASCADE;
  DROP TABLE IF EXISTS "brand_studio_page_why_section_items" CASCADE;
  DROP TABLE IF EXISTS "brand_studio_page_faq_section_faqs" CASCADE;
  DROP TABLE IF EXISTS "brand_studio_page" CASCADE;`)
}
