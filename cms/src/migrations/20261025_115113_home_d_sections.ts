import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The new home page (approved by Ernest on 24 and 25 October 2026).
 *
 * - homepage: one optional group per section (dHero, dProblem, dSolutions,
 *   dWork, dTestimonials, dProcess, dPrices, dFaq, dContact), including each
 *   section's page title. Empty fields show the approved words that ship with
 *   the site (src/lib/homeD/*.defaults.json).
 * - pricing_plans: addOns (extra convertible prices on a bundle, e.g. the AI
 *   automation system and monthly care) and cardNote (a short note on a card).
 *
 * Generated with storage placeholders, then trimmed: the generator also
 * re-emitted enum values added by the hand-written 20261020 migrations, which
 * are already live, so only this change's statements are kept, each made safe
 * to run twice (IF NOT EXISTS / duplicate_object).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
    CREATE TYPE "public"."enum_pricing_plans_add_ons_cadence" AS ENUM('once', 'monthly');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_homepage_d_work_steps_chips_kind" AS ENUM('client', 'progress', 'live', 'own');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_homepage_d_work_projects_kind" AS ENUM('progress', 'done');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  CREATE TABLE IF NOT EXISTS "pricing_plans_add_ons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"amount" numeric NOT NULL,
  	"cadence" "enum_pricing_plans_add_ons_cadence" DEFAULT 'once' NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_hero_steps_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_hero_steps_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar,
  	"note" varchar
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_hero_proof" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"label" varchar,
  	"step" numeric
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_hero_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"title" varchar,
  	"text" varchar,
  	"word" varchar,
  	"tick" varchar,
  	"tick_name" varchar
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_problem_problems_fix_points" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_problem_problems" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"word" varchar,
  	"title" varchar,
  	"problem" varchar,
  	"fix" varchar,
  	"link_label" varchar,
  	"link_href" varchar,
  	"summary" varchar,
  	"chip_bad" varchar,
  	"chip_good" varchar,
  	"fix_title" varchar,
  	"fix_figure" varchar,
  	"fix_text" varchar,
  	"fix_note" varchar,
  	"recap" varchar
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_problem_speed_table_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"before" varchar,
  	"after" varchar
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_solutions_services_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_solutions_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"tab" varchar,
  	"word" varchar,
  	"title" varchar,
  	"text" varchar,
  	"link_label" varchar,
  	"link_href" varchar,
  	"card_kicker" varchar,
  	"card_figure" varchar,
  	"card_text" varchar,
  	"chip" varchar
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_work_steps_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_work_steps_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar,
  	"note" varchar
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_work_steps_chips" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"kind" "enum_homepage_d_work_steps_chips_kind" DEFAULT 'own'
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_work_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"title" varchar,
  	"text" varchar,
  	"word" varchar
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_work_fixed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_work_results" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"before" varchar,
  	"after" varchar
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_work_projects" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"sub" varchar,
  	"status" varchar,
  	"kind" "enum_homepage_d_work_projects_kind" DEFAULT 'done'
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_process_steps_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_process_steps_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar,
  	"note" varchar
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_process_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"title" varchar,
  	"text" varchar,
  	"word" varchar,
  	"note" varchar
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_process_fixed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  CREATE TABLE IF NOT EXISTS "homepage_d_prices_band_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  ALTER TABLE "pricing_plans" ADD COLUMN IF NOT EXISTS "card_note" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_hero_cta_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_hero_cta_href" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_hero_trust" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_hero_after_title" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_hero_after_text" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_page_title" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_page_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_eyebrow" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_title" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_lead" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_start_word" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_problem_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_fix_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_ghost_text" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_index_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_recap_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_speed_table_heading" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_speed_table_before" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_speed_table_after" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_close_eyebrow" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_close_title" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_close_text" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_close_word" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_cta_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_problem_trust" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_page_title" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_page_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_eyebrow" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_title" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_lead" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_start_word" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_one_off_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_one_off_note" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_monthly_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_monthly_note" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_close_eyebrow" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_close_title" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_close_text" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_custom_text" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_custom_link" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_custom_href" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_custom_chip" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_close_word" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_cta_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_solutions_trust" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_work_page_title" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_work_title_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_work_cta_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_work_cta_href" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_work_trust" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_work_reel_pause" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_work_reel_play" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_work_aria" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_testimonials_page_title" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_testimonials_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_testimonials_chip" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_testimonials_link_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_testimonials_href" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_testimonials_quote_text" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_testimonials_quote_name" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_testimonials_quote_role" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_process_page_title" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_process_title_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_process_cta_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_process_cta_href" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_process_trust" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_process_aria" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_page_title" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_page_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_eyebrow" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_headline" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_sub" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_free_badge" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_free_title" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_free_text" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_free_button" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_free_link" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_one_off_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_one_off_note" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_monthly_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_monthly_note" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_band_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_foot_text" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_foot_custom" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_card_from" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_card_month" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_card_popular" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_card_book" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_card_covers" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_prices_card_add_from" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_faq_page_title" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_faq_page_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_faq_eyebrow" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_faq_headline" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_faq_sub" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_faq_link" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_contact_page_title" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_contact_page_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_contact_eyebrow" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_contact_headline" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_contact_whatsapp_note" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_contact_email_label" varchar;
  ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "d_contact_social_label" varchar;
  DO $$ BEGIN
    ALTER TABLE "pricing_plans_add_ons" ADD CONSTRAINT "pricing_plans_add_ons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pricing_plans"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_hero_steps_links" ADD CONSTRAINT "homepage_d_hero_steps_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_d_hero_steps"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_hero_steps_cards" ADD CONSTRAINT "homepage_d_hero_steps_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_d_hero_steps"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_hero_steps" ADD CONSTRAINT "homepage_d_hero_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_hero_proof" ADD CONSTRAINT "homepage_d_hero_proof_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_problem_problems_fix_points" ADD CONSTRAINT "homepage_d_problem_problems_fix_points_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_d_problem_problems"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_problem_problems" ADD CONSTRAINT "homepage_d_problem_problems_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_problem_speed_table_rows" ADD CONSTRAINT "homepage_d_problem_speed_table_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_solutions_services_tags" ADD CONSTRAINT "homepage_d_solutions_services_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_d_solutions_services"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_solutions_services" ADD CONSTRAINT "homepage_d_solutions_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_work_steps_links" ADD CONSTRAINT "homepage_d_work_steps_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_d_work_steps"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_work_steps_cards" ADD CONSTRAINT "homepage_d_work_steps_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_d_work_steps"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_work_steps_chips" ADD CONSTRAINT "homepage_d_work_steps_chips_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_d_work_steps"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_work_steps" ADD CONSTRAINT "homepage_d_work_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_work_fixed" ADD CONSTRAINT "homepage_d_work_fixed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_work_results" ADD CONSTRAINT "homepage_d_work_results_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_work_projects" ADD CONSTRAINT "homepage_d_work_projects_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_process_steps_links" ADD CONSTRAINT "homepage_d_process_steps_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_d_process_steps"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_process_steps_cards" ADD CONSTRAINT "homepage_d_process_steps_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_d_process_steps"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_process_steps" ADD CONSTRAINT "homepage_d_process_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_process_fixed" ADD CONSTRAINT "homepage_d_process_fixed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "homepage_d_prices_band_items" ADD CONSTRAINT "homepage_d_prices_band_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  CREATE INDEX IF NOT EXISTS "pricing_plans_add_ons_order_idx" ON "pricing_plans_add_ons" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pricing_plans_add_ons_parent_id_idx" ON "pricing_plans_add_ons" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_hero_steps_links_order_idx" ON "homepage_d_hero_steps_links" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_hero_steps_links_parent_id_idx" ON "homepage_d_hero_steps_links" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_hero_steps_cards_order_idx" ON "homepage_d_hero_steps_cards" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_hero_steps_cards_parent_id_idx" ON "homepage_d_hero_steps_cards" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_hero_steps_order_idx" ON "homepage_d_hero_steps" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_hero_steps_parent_id_idx" ON "homepage_d_hero_steps" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_hero_proof_order_idx" ON "homepage_d_hero_proof" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_hero_proof_parent_id_idx" ON "homepage_d_hero_proof" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_problem_problems_fix_points_order_idx" ON "homepage_d_problem_problems_fix_points" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_problem_problems_fix_points_parent_id_idx" ON "homepage_d_problem_problems_fix_points" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_problem_problems_order_idx" ON "homepage_d_problem_problems" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_problem_problems_parent_id_idx" ON "homepage_d_problem_problems" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_problem_speed_table_rows_order_idx" ON "homepage_d_problem_speed_table_rows" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_problem_speed_table_rows_parent_id_idx" ON "homepage_d_problem_speed_table_rows" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_solutions_services_tags_order_idx" ON "homepage_d_solutions_services_tags" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_solutions_services_tags_parent_id_idx" ON "homepage_d_solutions_services_tags" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_solutions_services_order_idx" ON "homepage_d_solutions_services" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_solutions_services_parent_id_idx" ON "homepage_d_solutions_services" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_work_steps_links_order_idx" ON "homepage_d_work_steps_links" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_work_steps_links_parent_id_idx" ON "homepage_d_work_steps_links" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_work_steps_cards_order_idx" ON "homepage_d_work_steps_cards" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_work_steps_cards_parent_id_idx" ON "homepage_d_work_steps_cards" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_work_steps_chips_order_idx" ON "homepage_d_work_steps_chips" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_work_steps_chips_parent_id_idx" ON "homepage_d_work_steps_chips" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_work_steps_order_idx" ON "homepage_d_work_steps" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_work_steps_parent_id_idx" ON "homepage_d_work_steps" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_work_fixed_order_idx" ON "homepage_d_work_fixed" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_work_fixed_parent_id_idx" ON "homepage_d_work_fixed" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_work_results_order_idx" ON "homepage_d_work_results" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_work_results_parent_id_idx" ON "homepage_d_work_results" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_work_projects_order_idx" ON "homepage_d_work_projects" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_work_projects_parent_id_idx" ON "homepage_d_work_projects" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_process_steps_links_order_idx" ON "homepage_d_process_steps_links" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_process_steps_links_parent_id_idx" ON "homepage_d_process_steps_links" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_process_steps_cards_order_idx" ON "homepage_d_process_steps_cards" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_process_steps_cards_parent_id_idx" ON "homepage_d_process_steps_cards" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_process_steps_order_idx" ON "homepage_d_process_steps" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_process_steps_parent_id_idx" ON "homepage_d_process_steps" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_process_fixed_order_idx" ON "homepage_d_process_fixed" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_process_fixed_parent_id_idx" ON "homepage_d_process_fixed" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "homepage_d_prices_band_items_order_idx" ON "homepage_d_prices_band_items" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "homepage_d_prices_band_items_parent_id_idx" ON "homepage_d_prices_band_items" USING btree ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "pricing_plans_add_ons" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_hero_steps_links" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_hero_steps_cards" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_hero_steps" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_hero_proof" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_problem_problems_fix_points" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_problem_problems" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_problem_speed_table_rows" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_solutions_services_tags" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_solutions_services" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_work_steps_links" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_work_steps_cards" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_work_steps_chips" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_work_steps" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_work_fixed" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_work_results" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_work_projects" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_process_steps_links" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_process_steps_cards" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_process_steps" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_process_fixed" CASCADE;
  DROP TABLE IF EXISTS "homepage_d_prices_band_items" CASCADE;
  ALTER TABLE "pricing_plans" DROP COLUMN IF EXISTS "card_note";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_hero_cta_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_hero_cta_href";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_hero_trust";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_hero_after_title";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_hero_after_text";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_page_title";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_page_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_eyebrow";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_title";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_lead";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_start_word";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_problem_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_fix_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_ghost_text";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_index_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_recap_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_speed_table_heading";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_speed_table_before";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_speed_table_after";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_close_eyebrow";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_close_title";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_close_text";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_close_word";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_cta_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_problem_trust";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_page_title";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_page_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_eyebrow";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_title";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_lead";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_start_word";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_one_off_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_one_off_note";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_monthly_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_monthly_note";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_close_eyebrow";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_close_title";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_close_text";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_custom_text";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_custom_link";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_custom_href";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_custom_chip";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_close_word";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_cta_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_solutions_trust";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_work_page_title";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_work_title_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_work_cta_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_work_cta_href";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_work_trust";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_work_reel_pause";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_work_reel_play";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_work_aria";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_testimonials_page_title";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_testimonials_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_testimonials_chip";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_testimonials_link_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_testimonials_href";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_testimonials_quote_text";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_testimonials_quote_name";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_testimonials_quote_role";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_process_page_title";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_process_title_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_process_cta_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_process_cta_href";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_process_trust";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_process_aria";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_page_title";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_page_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_eyebrow";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_headline";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_sub";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_free_badge";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_free_title";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_free_text";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_free_button";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_free_link";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_one_off_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_one_off_note";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_monthly_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_monthly_note";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_band_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_foot_text";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_foot_custom";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_card_from";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_card_month";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_card_popular";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_card_book";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_card_covers";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_prices_card_add_from";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_faq_page_title";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_faq_page_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_faq_eyebrow";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_faq_headline";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_faq_sub";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_faq_link";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_contact_page_title";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_contact_page_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_contact_eyebrow";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_contact_headline";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_contact_whatsapp_note";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_contact_email_label";
  ALTER TABLE "homepage" DROP COLUMN IF EXISTS "d_contact_social_label";
  DROP TYPE IF EXISTS "public"."enum_pricing_plans_add_ons_cadence";
  DROP TYPE IF EXISTS "public"."enum_homepage_d_work_steps_chips_kind";
  DROP TYPE IF EXISTS "public"."enum_homepage_d_work_projects_kind";
  `)
}
