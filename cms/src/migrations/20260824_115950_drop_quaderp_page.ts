import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Drop the QuadERP page tables.
 *
 * QuadERP has its own site at quaderp.app, confirmed by Ernest on 2026-08-24,
 * so quademdigital.com never got a QuadERP page. The `quaderpPage` global was
 * fully defined and migrated and fetched by nothing: both QuadERP links on the
 * site, in the nav and in the footer, point straight at quaderp.app.
 *
 * Dropped rather than left behind, which is a departure from the deferred-drop
 * policy in CLAUDE.md. That policy exists for objects whose use is unconfirmed;
 * here nothing read them, six of the seven tables were empty, and the seventh
 * held one row of placeholder copy that its own `pricingNote` described as
 * placeholder. The copy is kept in `docs/quaderp-page-copy.md`.
 *
 * `down()` rebuilds the schema, column defaults included, but not that row.
 * Restore it from the doc if it is ever wanted.
 *
 * Note this also removes the last live reference to Formspree in any config:
 * `formspree_endpoint` here still pointed at the form service the site stopped
 * using when forms moved to /api/submit-form.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE IF EXISTS "quaderp_page_trust_badges" CASCADE;
  DROP TABLE IF EXISTS "quaderp_page_features" CASCADE;
  DROP TABLE IF EXISTS "quaderp_page_showcase_items_bullet_points" CASCADE;
  DROP TABLE IF EXISTS "quaderp_page_showcase_items" CASCADE;
  DROP TABLE IF EXISTS "quaderp_page_pricing_plans_features" CASCADE;
  DROP TABLE IF EXISTS "quaderp_page_pricing_plans" CASCADE;
  DROP TABLE IF EXISTS "quaderp_page" CASCADE;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "quaderp_page_trust_badges" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"badge" varchar
  );
  
  CREATE TABLE "quaderp_page_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"icon" varchar
  );
  
  CREATE TABLE "quaderp_page_showcase_items_bullet_points" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"point" varchar
  );
  
  CREATE TABLE "quaderp_page_showcase_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"heading" varchar,
  	"heading_gradient" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "quaderp_page_pricing_plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );
  
  CREATE TABLE "quaderp_page_pricing_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"price" varchar,
  	"period" varchar,
  	"description" varchar,
  	"is_popular" boolean,
  	"button_text" varchar
  );
  
  CREATE TABLE "quaderp_page" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_badge" varchar DEFAULT '🚀 Introducing QuadERP',
  	"hero_title" varchar DEFAULT 'Take Control of Your',
  	"hero_title_gradient" varchar DEFAULT 'Store Operations',
  	"hero_subtitle" varchar DEFAULT 'Real-time sales tracking, smart inventory management, staff oversight, and theft prevention, all in one powerful platform built for modern retail.',
  	"features_heading" varchar DEFAULT 'Everything You Need to Run Your Store',
  	"features_subtitle" varchar DEFAULT 'Powerful tools designed for retail businesses of every size, from single shops to multi-location chains.',
  	"showcase_heading" varchar DEFAULT 'See QuadERP in Action',
  	"pricing_heading" varchar DEFAULT 'Simple, Transparent Pricing',
  	"pricing_subtitle" varchar DEFAULT 'Start free. Scale as you grow. No hidden fees, ever.',
  	"pricing_note" varchar DEFAULT '🔒 All plans include a 14-day free trial. Prices are placeholder and subject to change.',
  	"contact_heading" varchar DEFAULT 'Get Started With QuadERP',
  	"contact_subtitle" varchar DEFAULT 'Tell us about your business and we''ll set you up with the perfect plan.',
  	"formspree_endpoint" varchar DEFAULT 'https://formspree.io/f/xgobwrdw',
  	"calendly_url" varchar DEFAULT 'https://calendly.com/quademdigitalenterprise/quaderp-demo-call',
  	"whatsapp_number" varchar DEFAULT '233530890302',
  	"whatsapp_message" varchar DEFAULT 'Hi Quadem! I''m interested in QuadERP for my store. Can we talk?',
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "quaderp_page_trust_badges" ADD CONSTRAINT "quaderp_page_trust_badges_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quaderp_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quaderp_page_features" ADD CONSTRAINT "quaderp_page_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quaderp_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quaderp_page_showcase_items_bullet_points" ADD CONSTRAINT "quaderp_page_showcase_items_bullet_points_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quaderp_page_showcase_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quaderp_page_showcase_items" ADD CONSTRAINT "quaderp_page_showcase_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quaderp_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quaderp_page_pricing_plans_features" ADD CONSTRAINT "quaderp_page_pricing_plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quaderp_page_pricing_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quaderp_page_pricing_plans" ADD CONSTRAINT "quaderp_page_pricing_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quaderp_page"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "quaderp_page_trust_badges_order_idx" ON "quaderp_page_trust_badges" USING btree ("_order");
  CREATE INDEX "quaderp_page_trust_badges_parent_id_idx" ON "quaderp_page_trust_badges" USING btree ("_parent_id");
  CREATE INDEX "quaderp_page_features_order_idx" ON "quaderp_page_features" USING btree ("_order");
  CREATE INDEX "quaderp_page_features_parent_id_idx" ON "quaderp_page_features" USING btree ("_parent_id");
  CREATE INDEX "quaderp_page_showcase_items_bullet_points_order_idx" ON "quaderp_page_showcase_items_bullet_points" USING btree ("_order");
  CREATE INDEX "quaderp_page_showcase_items_bullet_points_parent_id_idx" ON "quaderp_page_showcase_items_bullet_points" USING btree ("_parent_id");
  CREATE INDEX "quaderp_page_showcase_items_order_idx" ON "quaderp_page_showcase_items" USING btree ("_order");
  CREATE INDEX "quaderp_page_showcase_items_parent_id_idx" ON "quaderp_page_showcase_items" USING btree ("_parent_id");
  CREATE INDEX "quaderp_page_pricing_plans_features_order_idx" ON "quaderp_page_pricing_plans_features" USING btree ("_order");
  CREATE INDEX "quaderp_page_pricing_plans_features_parent_id_idx" ON "quaderp_page_pricing_plans_features" USING btree ("_parent_id");
  CREATE INDEX "quaderp_page_pricing_plans_order_idx" ON "quaderp_page_pricing_plans" USING btree ("_order");
  CREATE INDEX "quaderp_page_pricing_plans_parent_id_idx" ON "quaderp_page_pricing_plans" USING btree ("_parent_id");`)
}
