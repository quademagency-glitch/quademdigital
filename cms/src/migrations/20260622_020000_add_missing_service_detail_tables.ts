import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The baseline migration (20260621_172920_initial_baseline) was recorded as
 * already-applied to skip re-creating tables that already existed from the
 * old dev-push setup. But webDesignPage/seoPage/brandIdentityPage/
 * videoProductionPage never actually existed in production (they 500 with
 * "relation does not exist"), so they were silently skipped along with it.
 * This recreates just those 4 globals + their nested array tables, copied
 * verbatim from the baseline's up()/down() SQL.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "video_production_page_services_section_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"icon_svg" varchar
  );

  CREATE TABLE IF NOT EXISTS "video_production_page_process_section_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"number" varchar,
  	"title" varchar,
  	"description" varchar
  );

  CREATE TABLE IF NOT EXISTS "video_production_page_pricing_section_plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );

  CREATE TABLE IF NOT EXISTS "video_production_page_pricing_section_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"price" varchar NOT NULL,
  	"period" varchar,
  	"description" varchar,
  	"is_popular" boolean DEFAULT false
  );

  CREATE TABLE IF NOT EXISTS "video_production_page_faq_section_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "video_production_page" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_badge" varchar DEFAULT '🎬 Video Production',
  	"hero_headline" varchar DEFAULT 'Professional Video Production',
  	"hero_subtitle" varchar DEFAULT 'From concept to final cut — we produce high-quality video content that captures attention, tells your story, and drives results for your brand.',
  	"hero_primary_cta_text" varchar DEFAULT 'Get a Free Quote',
  	"hero_secondary_cta_text" varchar DEFAULT 'View Pricing ↓',
  	"services_section_heading" varchar DEFAULT 'What We Produce',
  	"services_section_subtitle" varchar DEFAULT 'From polished corporate content to high-energy social media videos, we cover it all.',
  	"showreel_heading" varchar DEFAULT 'Our Showreel',
  	"showreel_subtitle" varchar DEFAULT 'A taste of our recent work — from concept to final delivery.',
  	"showreel_video_url" varchar,
  	"showreel_is_coming_soon" boolean DEFAULT true,
  	"process_section_heading" varchar DEFAULT 'Our Production Process',
  	"process_section_subtitle" varchar DEFAULT 'A streamlined workflow that takes your project from idea to screen.',
  	"pricing_section_heading" varchar DEFAULT 'Video Production Pricing',
  	"pricing_section_subtitle" varchar DEFAULT 'Transparent pricing designed for businesses at every stage. All prices are starting points — we tailor every project to your needs.',
  	"pricing_section_note" varchar DEFAULT '* Prices are starting points. Final pricing is determined by project scope, complexity, and timeline.',
  	"faq_section_heading" varchar DEFAULT 'Frequently Asked Questions',
  	"faq_section_subtitle" varchar DEFAULT 'Everything you need to know about our video production services.',
  	"cta_section_heading" varchar DEFAULT 'Ready to bring your vision to life?',
  	"cta_section_subtitle" varchar DEFAULT 'Book a free video consultation and let''s discuss your next project. No commitments — just a conversation about your goals.',
  	"cta_section_primary_button_text" varchar DEFAULT 'Book a Free Consultation',
  	"cta_section_whatsapp_button_text" varchar DEFAULT '💬 Chat on WhatsApp',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );

  CREATE TABLE IF NOT EXISTS "web_design_page_services_section_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"icon_svg" varchar
  );

  CREATE TABLE IF NOT EXISTS "web_design_page_process_section_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"number" varchar,
  	"title" varchar,
  	"description" varchar
  );

  CREATE TABLE IF NOT EXISTS "web_design_page_pricing_section_plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );

  CREATE TABLE IF NOT EXISTS "web_design_page_pricing_section_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"price" varchar NOT NULL,
  	"period" varchar,
  	"description" varchar,
  	"is_popular" boolean DEFAULT false
  );

  CREATE TABLE IF NOT EXISTS "web_design_page_faq_section_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "web_design_page" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_badge" varchar DEFAULT '🖥️ Web Design',
  	"hero_headline" varchar DEFAULT 'Professional Web Design',
  	"hero_subtitle" varchar DEFAULT 'Custom, responsive websites built to convert visitors into loyal customers and grow your business.',
  	"hero_primary_cta_text" varchar DEFAULT 'Get a Free Quote',
  	"hero_secondary_cta_text" varchar DEFAULT 'View Pricing ↓',
  	"services_section_heading" varchar DEFAULT 'Web Design Services',
  	"services_section_subtitle" varchar DEFAULT 'From custom websites to e‑commerce platforms, we craft digital experiences that work.',
  	"showreel_heading" varchar DEFAULT 'Our Showreel',
  	"showreel_subtitle" varchar DEFAULT 'A taste of our web design projects — from concept to launch.',
  	"showreel_video_url" varchar,
  	"showreel_is_coming_soon" boolean DEFAULT true,
  	"process_section_heading" varchar DEFAULT 'Our Design Process',
  	"process_section_subtitle" varchar DEFAULT 'A streamlined workflow that takes your project from idea to launch.',
  	"pricing_section_heading" varchar DEFAULT 'Web Design Pricing',
  	"pricing_section_subtitle" varchar DEFAULT 'Transparent pricing for websites of any scale.',
  	"pricing_section_note" varchar DEFAULT '* Prices are starting points. Final pricing is determined by project scope, complexity, and timeline.',
  	"faq_section_heading" varchar DEFAULT 'Web Design FAQs',
  	"faq_section_subtitle" varchar DEFAULT 'Common questions about our web design services.',
  	"cta_section_heading" varchar DEFAULT 'Ready to launch your website?',
  	"cta_section_subtitle" varchar DEFAULT 'Book a free web design consultation and let''s discuss your project. No commitments — just a conversation about your goals.',
  	"cta_section_primary_button_text" varchar DEFAULT 'Book a Free Consultation',
  	"cta_section_whatsapp_button_text" varchar DEFAULT '💬 Chat on WhatsApp',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );

  CREATE TABLE IF NOT EXISTS "brand_identity_page_services_section_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"icon_svg" varchar
  );

  CREATE TABLE IF NOT EXISTS "brand_identity_page_process_section_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"number" varchar,
  	"title" varchar,
  	"description" varchar
  );

  CREATE TABLE IF NOT EXISTS "brand_identity_page_pricing_section_plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );

  CREATE TABLE IF NOT EXISTS "brand_identity_page_pricing_section_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"price" varchar NOT NULL,
  	"period" varchar,
  	"description" varchar,
  	"is_popular" boolean DEFAULT false
  );

  CREATE TABLE IF NOT EXISTS "brand_identity_page_faq_section_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "brand_identity_page" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_badge" varchar DEFAULT '🎨 Brand Identity',
  	"hero_headline" varchar DEFAULT 'Professional Brand & Graphic Design',
  	"hero_subtitle" varchar DEFAULT 'Distinct visual identities that make your brand memorable and professional.',
  	"hero_primary_cta_text" varchar DEFAULT 'Get a Free Quote',
  	"hero_secondary_cta_text" varchar DEFAULT 'View Pricing ↓',
  	"services_section_heading" varchar DEFAULT 'Brand Design Services',
  	"services_section_subtitle" varchar DEFAULT 'Logo design, brand kits, visual identity systems, and more.',
  	"showreel_heading" varchar DEFAULT 'Our Portfolio Showcase',
  	"showreel_subtitle" varchar DEFAULT 'A glimpse of our branding projects — from concept to delivery.',
  	"showreel_video_url" varchar,
  	"showreel_is_coming_soon" boolean DEFAULT true,
  	"process_section_heading" varchar DEFAULT 'Our Design Process',
  	"process_section_subtitle" varchar DEFAULT 'A streamlined workflow that takes your project from idea to launch.',
  	"pricing_section_heading" varchar DEFAULT 'Brand Identity Pricing',
  	"pricing_section_subtitle" varchar DEFAULT 'Transparent pricing for brand design projects of any scale.',
  	"pricing_section_note" varchar DEFAULT '* Prices are starting points. Final pricing is determined by project scope, complexity, and timeline.',
  	"faq_section_heading" varchar DEFAULT 'Brand Design FAQs',
  	"faq_section_subtitle" varchar DEFAULT 'Common questions about our branding services.',
  	"cta_section_heading" varchar DEFAULT 'Ready to build a memorable brand?',
  	"cta_section_subtitle" varchar DEFAULT 'Book a free branding consultation and let''s discuss your visual identity. No commitments — just a conversation about your goals.',
  	"cta_section_primary_button_text" varchar DEFAULT 'Book a Free Consultation',
  	"cta_section_whatsapp_button_text" varchar DEFAULT '💬 Chat on WhatsApp',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );

  CREATE TABLE IF NOT EXISTS "seo_page_services_section_services_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );

  CREATE TABLE IF NOT EXISTS "seo_page_services_section_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"icon_svg" varchar
  );

  CREATE TABLE IF NOT EXISTS "seo_page_process_section_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"number" varchar,
  	"title" varchar,
  	"description" varchar
  );

  CREATE TABLE IF NOT EXISTS "seo_page_pricing_section_plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );

  CREATE TABLE IF NOT EXISTS "seo_page_pricing_section_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"price" varchar NOT NULL,
  	"period" varchar,
  	"description" varchar,
  	"is_popular" boolean DEFAULT false
  );

  CREATE TABLE IF NOT EXISTS "seo_page_faq_section_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "seo_page" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_badge" varchar DEFAULT '📈 SEO & Content Marketing',
  	"hero_headline" varchar DEFAULT 'Be Found When They Search',
  	"hero_subtitle" varchar DEFAULT 'We don''t just chase vanity metrics. We build data-driven SEO and content strategies that increase your visibility, drive qualified traffic, and generate real revenue.',
  	"hero_primary_cta_text" varchar DEFAULT 'Get a Free SEO Audit',
  	"hero_secondary_cta_text" varchar DEFAULT 'View Pricing',
  	"services_section_heading" varchar DEFAULT 'Our SEO Arsenal',
  	"services_section_subtitle" varchar DEFAULT 'Comprehensive search marketing to dominate every stage of the funnel.',
  	"process_section_heading" varchar DEFAULT 'The Ranking Process',
  	"process_section_subtitle" varchar DEFAULT 'How we take your site from obscurity to the top of the SERPs.',
  	"pricing_section_heading" varchar DEFAULT 'SEO Retainers',
  	"pricing_section_subtitle" varchar DEFAULT 'Transparent monthly pricing. No long-term lock-ins. Proven results.',
  	"pricing_section_note" varchar,
  	"faq_section_heading" varchar DEFAULT 'SEO FAQs',
  	"faq_section_subtitle" varchar DEFAULT 'Everything you need to know about our SEO process.',
  	"cta_section_heading" varchar DEFAULT 'Stop Losing Traffic to Competitors',
  	"cta_section_subtitle" varchar DEFAULT 'Let''s run a comprehensive audit on your website and discover exactly what it takes to get you to page one.',
  	"cta_section_primary_button_text" varchar DEFAULT 'Request Your Free Audit',
  	"cta_section_whatsapp_button_text" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );

  DO $$ BEGIN
   ALTER TABLE "video_production_page_services_section_services" ADD CONSTRAINT "video_production_page_services_section_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."video_production_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "video_production_page_process_section_steps" ADD CONSTRAINT "video_production_page_process_section_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."video_production_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "video_production_page_pricing_section_plans_features" ADD CONSTRAINT "video_production_page_pricing_section_plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."video_production_page_pricing_section_plans"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "video_production_page_pricing_section_plans" ADD CONSTRAINT "video_production_page_pricing_section_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."video_production_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "video_production_page_faq_section_faqs" ADD CONSTRAINT "video_production_page_faq_section_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."video_production_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "web_design_page_services_section_services" ADD CONSTRAINT "web_design_page_services_section_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."web_design_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "web_design_page_process_section_steps" ADD CONSTRAINT "web_design_page_process_section_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."web_design_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "web_design_page_pricing_section_plans_features" ADD CONSTRAINT "web_design_page_pricing_section_plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."web_design_page_pricing_section_plans"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "web_design_page_pricing_section_plans" ADD CONSTRAINT "web_design_page_pricing_section_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."web_design_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "web_design_page_faq_section_faqs" ADD CONSTRAINT "web_design_page_faq_section_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."web_design_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "brand_identity_page_services_section_services" ADD CONSTRAINT "brand_identity_page_services_section_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_identity_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "brand_identity_page_process_section_steps" ADD CONSTRAINT "brand_identity_page_process_section_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_identity_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "brand_identity_page_pricing_section_plans_features" ADD CONSTRAINT "brand_identity_page_pricing_section_plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_identity_page_pricing_section_plans"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "brand_identity_page_pricing_section_plans" ADD CONSTRAINT "brand_identity_page_pricing_section_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_identity_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "brand_identity_page_faq_section_faqs" ADD CONSTRAINT "brand_identity_page_faq_section_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_identity_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "seo_page_services_section_services_features" ADD CONSTRAINT "seo_page_services_section_services_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."seo_page_services_section_services"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "seo_page_services_section_services" ADD CONSTRAINT "seo_page_services_section_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."seo_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "seo_page_process_section_steps" ADD CONSTRAINT "seo_page_process_section_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."seo_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "seo_page_pricing_section_plans_features" ADD CONSTRAINT "seo_page_pricing_section_plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."seo_page_pricing_section_plans"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "seo_page_pricing_section_plans" ADD CONSTRAINT "seo_page_pricing_section_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."seo_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "seo_page_faq_section_faqs" ADD CONSTRAINT "seo_page_faq_section_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."seo_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE INDEX IF NOT EXISTS "video_production_page_services_section_services_order_idx" ON "video_production_page_services_section_services" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "video_production_page_services_section_services_parent_id_idx" ON "video_production_page_services_section_services" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "video_production_page_process_section_steps_order_idx" ON "video_production_page_process_section_steps" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "video_production_page_process_section_steps_parent_id_idx" ON "video_production_page_process_section_steps" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "video_production_page_pricing_section_plans_features_order_idx" ON "video_production_page_pricing_section_plans_features" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "video_production_page_pricing_section_plans_features_parent_id_idx" ON "video_production_page_pricing_section_plans_features" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "video_production_page_pricing_section_plans_order_idx" ON "video_production_page_pricing_section_plans" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "video_production_page_pricing_section_plans_parent_id_idx" ON "video_production_page_pricing_section_plans" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "video_production_page_faq_section_faqs_order_idx" ON "video_production_page_faq_section_faqs" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "video_production_page_faq_section_faqs_parent_id_idx" ON "video_production_page_faq_section_faqs" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "web_design_page_services_section_services_order_idx" ON "web_design_page_services_section_services" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "web_design_page_services_section_services_parent_id_idx" ON "web_design_page_services_section_services" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "web_design_page_process_section_steps_order_idx" ON "web_design_page_process_section_steps" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "web_design_page_process_section_steps_parent_id_idx" ON "web_design_page_process_section_steps" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "web_design_page_pricing_section_plans_features_order_idx" ON "web_design_page_pricing_section_plans_features" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "web_design_page_pricing_section_plans_features_parent_id_idx" ON "web_design_page_pricing_section_plans_features" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "web_design_page_pricing_section_plans_order_idx" ON "web_design_page_pricing_section_plans" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "web_design_page_pricing_section_plans_parent_id_idx" ON "web_design_page_pricing_section_plans" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "web_design_page_faq_section_faqs_order_idx" ON "web_design_page_faq_section_faqs" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "web_design_page_faq_section_faqs_parent_id_idx" ON "web_design_page_faq_section_faqs" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "brand_identity_page_services_section_services_order_idx" ON "brand_identity_page_services_section_services" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "brand_identity_page_services_section_services_parent_id_idx" ON "brand_identity_page_services_section_services" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "brand_identity_page_process_section_steps_order_idx" ON "brand_identity_page_process_section_steps" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "brand_identity_page_process_section_steps_parent_id_idx" ON "brand_identity_page_process_section_steps" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "brand_identity_page_pricing_section_plans_features_order_idx" ON "brand_identity_page_pricing_section_plans_features" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "brand_identity_page_pricing_section_plans_features_parent_id_idx" ON "brand_identity_page_pricing_section_plans_features" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "brand_identity_page_pricing_section_plans_order_idx" ON "brand_identity_page_pricing_section_plans" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "brand_identity_page_pricing_section_plans_parent_id_idx" ON "brand_identity_page_pricing_section_plans" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "brand_identity_page_faq_section_faqs_order_idx" ON "brand_identity_page_faq_section_faqs" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "brand_identity_page_faq_section_faqs_parent_id_idx" ON "brand_identity_page_faq_section_faqs" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "seo_page_services_section_services_features_order_idx" ON "seo_page_services_section_services_features" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "seo_page_services_section_services_features_parent_id_idx" ON "seo_page_services_section_services_features" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "seo_page_services_section_services_order_idx" ON "seo_page_services_section_services" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "seo_page_services_section_services_parent_id_idx" ON "seo_page_services_section_services" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "seo_page_process_section_steps_order_idx" ON "seo_page_process_section_steps" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "seo_page_process_section_steps_parent_id_idx" ON "seo_page_process_section_steps" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "seo_page_pricing_section_plans_features_order_idx" ON "seo_page_pricing_section_plans_features" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "seo_page_pricing_section_plans_features_parent_id_idx" ON "seo_page_pricing_section_plans_features" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "seo_page_pricing_section_plans_order_idx" ON "seo_page_pricing_section_plans" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "seo_page_pricing_section_plans_parent_id_idx" ON "seo_page_pricing_section_plans" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "seo_page_faq_section_faqs_order_idx" ON "seo_page_faq_section_faqs" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "seo_page_faq_section_faqs_parent_id_idx" ON "seo_page_faq_section_faqs" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "video_production_page_services_section_services" CASCADE;
  DROP TABLE IF EXISTS "video_production_page_process_section_steps" CASCADE;
  DROP TABLE IF EXISTS "video_production_page_pricing_section_plans_features" CASCADE;
  DROP TABLE IF EXISTS "video_production_page_pricing_section_plans" CASCADE;
  DROP TABLE IF EXISTS "video_production_page_faq_section_faqs" CASCADE;
  DROP TABLE IF EXISTS "video_production_page" CASCADE;
  DROP TABLE IF EXISTS "web_design_page_services_section_services" CASCADE;
  DROP TABLE IF EXISTS "web_design_page_process_section_steps" CASCADE;
  DROP TABLE IF EXISTS "web_design_page_pricing_section_plans_features" CASCADE;
  DROP TABLE IF EXISTS "web_design_page_pricing_section_plans" CASCADE;
  DROP TABLE IF EXISTS "web_design_page_faq_section_faqs" CASCADE;
  DROP TABLE IF EXISTS "web_design_page" CASCADE;
  DROP TABLE IF EXISTS "brand_identity_page_services_section_services" CASCADE;
  DROP TABLE IF EXISTS "brand_identity_page_process_section_steps" CASCADE;
  DROP TABLE IF EXISTS "brand_identity_page_pricing_section_plans_features" CASCADE;
  DROP TABLE IF EXISTS "brand_identity_page_pricing_section_plans" CASCADE;
  DROP TABLE IF EXISTS "brand_identity_page_faq_section_faqs" CASCADE;
  DROP TABLE IF EXISTS "brand_identity_page" CASCADE;
  DROP TABLE IF EXISTS "seo_page_services_section_services_features" CASCADE;
  DROP TABLE IF EXISTS "seo_page_services_section_services" CASCADE;
  DROP TABLE IF EXISTS "seo_page_process_section_steps" CASCADE;
  DROP TABLE IF EXISTS "seo_page_pricing_section_plans_features" CASCADE;
  DROP TABLE IF EXISTS "seo_page_pricing_section_plans" CASCADE;
  DROP TABLE IF EXISTS "seo_page_faq_section_faqs" CASCADE;
  DROP TABLE IF EXISTS "seo_page" CASCADE;`)
}
