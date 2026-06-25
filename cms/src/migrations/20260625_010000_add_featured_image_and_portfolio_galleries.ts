import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Commit 5225e5f8 added `featuredImage` to Services and `media` / `portfolioGallery`
 * fields to the Brand Identity, SEO, Video Production, and Web Design page globals,
 * but no migration was ever generated for them — production push is a no-op (push
 * only runs in development), so the live DB never got these columns/tables.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "featured_image_id" integer;
  ALTER TABLE "brand_identity_page" ADD COLUMN IF NOT EXISTS "hero_media_id" integer;
  ALTER TABLE "brand_identity_page" ADD COLUMN IF NOT EXISTS "portfolio_gallery_heading" varchar DEFAULT 'Our Work Gallery';
  ALTER TABLE "brand_identity_page" ADD COLUMN IF NOT EXISTS "portfolio_gallery_subtitle" varchar DEFAULT 'Explore some of our recent brand identity projects.';
  ALTER TABLE "seo_page" ADD COLUMN IF NOT EXISTS "hero_media_id" integer;
  ALTER TABLE "seo_page" ADD COLUMN IF NOT EXISTS "portfolio_gallery_heading" varchar DEFAULT 'SEO Case Studies & Results';
  ALTER TABLE "seo_page" ADD COLUMN IF NOT EXISTS "portfolio_gallery_subtitle" varchar DEFAULT 'See how we have driven traffic and revenue for our clients.';
  ALTER TABLE "video_production_page" ADD COLUMN IF NOT EXISTS "hero_media_id" integer;
  ALTER TABLE "video_production_page" ADD COLUMN IF NOT EXISTS "portfolio_gallery_heading" varchar DEFAULT 'Our Work Gallery';
  ALTER TABLE "video_production_page" ADD COLUMN IF NOT EXISTS "portfolio_gallery_subtitle" varchar DEFAULT 'Explore some of our recent video production projects.';
  ALTER TABLE "web_design_page" ADD COLUMN IF NOT EXISTS "hero_media_id" integer;
  ALTER TABLE "web_design_page" ADD COLUMN IF NOT EXISTS "portfolio_gallery_heading" varchar DEFAULT 'Our Work Gallery';
  ALTER TABLE "web_design_page" ADD COLUMN IF NOT EXISTS "portfolio_gallery_subtitle" varchar DEFAULT 'Explore some of our recent web design projects.';

  CREATE TABLE IF NOT EXISTS "brand_identity_page_portfolio_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "seo_page_portfolio_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "video_production_page_portfolio_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "web_design_page_portfolio_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );

  DO $$ BEGIN
   ALTER TABLE "services" ADD CONSTRAINT "services_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "brand_identity_page" ADD CONSTRAINT "brand_identity_page_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "seo_page" ADD CONSTRAINT "seo_page_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "video_production_page" ADD CONSTRAINT "video_production_page_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "web_design_page" ADD CONSTRAINT "web_design_page_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "brand_identity_page_portfolio_gallery_images" ADD CONSTRAINT "brand_identity_page_portfolio_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_identity_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "brand_identity_page_portfolio_gallery_images" ADD CONSTRAINT "brand_identity_page_portfolio_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "seo_page_portfolio_gallery_images" ADD CONSTRAINT "seo_page_portfolio_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."seo_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "seo_page_portfolio_gallery_images" ADD CONSTRAINT "seo_page_portfolio_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "video_production_page_portfolio_gallery_images" ADD CONSTRAINT "video_production_page_portfolio_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."video_production_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "video_production_page_portfolio_gallery_images" ADD CONSTRAINT "video_production_page_portfolio_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "web_design_page_portfolio_gallery_images" ADD CONSTRAINT "web_design_page_portfolio_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."web_design_page"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
   ALTER TABLE "web_design_page_portfolio_gallery_images" ADD CONSTRAINT "web_design_page_portfolio_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE INDEX IF NOT EXISTS "services_featured_image_idx" ON "services" USING btree ("featured_image_id");
  CREATE INDEX IF NOT EXISTS "brand_identity_page_hero_media_idx" ON "brand_identity_page" USING btree ("hero_media_id");
  CREATE INDEX IF NOT EXISTS "seo_page_hero_media_idx" ON "seo_page" USING btree ("hero_media_id");
  CREATE INDEX IF NOT EXISTS "video_production_page_hero_media_idx" ON "video_production_page" USING btree ("hero_media_id");
  CREATE INDEX IF NOT EXISTS "web_design_page_hero_media_idx" ON "web_design_page" USING btree ("hero_media_id");
  CREATE INDEX IF NOT EXISTS "brand_identity_page_portfolio_gallery_images_order_idx" ON "brand_identity_page_portfolio_gallery_images" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "brand_identity_page_portfolio_gallery_images_parent_id_idx" ON "brand_identity_page_portfolio_gallery_images" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "brand_identity_page_portfolio_gallery_images_image_idx" ON "brand_identity_page_portfolio_gallery_images" USING btree ("image_id");
  CREATE INDEX IF NOT EXISTS "seo_page_portfolio_gallery_images_order_idx" ON "seo_page_portfolio_gallery_images" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "seo_page_portfolio_gallery_images_parent_id_idx" ON "seo_page_portfolio_gallery_images" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "seo_page_portfolio_gallery_images_image_idx" ON "seo_page_portfolio_gallery_images" USING btree ("image_id");
  CREATE INDEX IF NOT EXISTS "video_production_page_portfolio_gallery_images_order_idx" ON "video_production_page_portfolio_gallery_images" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "video_production_page_portfolio_gallery_images_parent_id_idx" ON "video_production_page_portfolio_gallery_images" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "video_production_page_portfolio_gallery_images_image_idx" ON "video_production_page_portfolio_gallery_images" USING btree ("image_id");
  CREATE INDEX IF NOT EXISTS "web_design_page_portfolio_gallery_images_order_idx" ON "web_design_page_portfolio_gallery_images" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "web_design_page_portfolio_gallery_images_parent_id_idx" ON "web_design_page_portfolio_gallery_images" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "web_design_page_portfolio_gallery_images_image_idx" ON "web_design_page_portfolio_gallery_images" USING btree ("image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "brand_identity_page_portfolio_gallery_images" CASCADE;
  DROP TABLE IF EXISTS "seo_page_portfolio_gallery_images" CASCADE;
  DROP TABLE IF EXISTS "video_production_page_portfolio_gallery_images" CASCADE;
  DROP TABLE IF EXISTS "web_design_page_portfolio_gallery_images" CASCADE;
  ALTER TABLE "services" DROP COLUMN IF EXISTS "featured_image_id";
  ALTER TABLE "brand_identity_page" DROP COLUMN IF EXISTS "hero_media_id";
  ALTER TABLE "brand_identity_page" DROP COLUMN IF EXISTS "portfolio_gallery_heading";
  ALTER TABLE "brand_identity_page" DROP COLUMN IF EXISTS "portfolio_gallery_subtitle";
  ALTER TABLE "seo_page" DROP COLUMN IF EXISTS "hero_media_id";
  ALTER TABLE "seo_page" DROP COLUMN IF EXISTS "portfolio_gallery_heading";
  ALTER TABLE "seo_page" DROP COLUMN IF EXISTS "portfolio_gallery_subtitle";
  ALTER TABLE "video_production_page" DROP COLUMN IF EXISTS "hero_media_id";
  ALTER TABLE "video_production_page" DROP COLUMN IF EXISTS "portfolio_gallery_heading";
  ALTER TABLE "video_production_page" DROP COLUMN IF EXISTS "portfolio_gallery_subtitle";
  ALTER TABLE "web_design_page" DROP COLUMN IF EXISTS "hero_media_id";
  ALTER TABLE "web_design_page" DROP COLUMN IF EXISTS "portfolio_gallery_heading";
  ALTER TABLE "web_design_page" DROP COLUMN IF EXISTS "portfolio_gallery_subtitle";`)
}
