import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Re-enables @payloadcms/plugin-seo, which adds `meta.title`, `meta.description`
 * and `meta.image` to five collections and nine page globals.
 *
 * Three of those tables already have the columns. The plugin was enabled here
 * once before and later removed from the plugins array, and destructive drops
 * are deferred by policy, so `blog_posts`, `pages` and `services` still carry
 * `meta_title` / `meta_description` / `meta_image_id`, along with the matching
 * `version_meta_*` columns on `_blog_posts_v` and `_pages_v`. This migration
 * reuses them rather than recreating them, which is why every statement is
 * guarded: on production the first three tables are already done and those
 * statements are no-ops.
 *
 * Hand-written rather than generated. `payload migrate:create` cannot run
 * unattended here: the stale drizzle snapshot makes it prompt about renaming
 * the leftover `brand_studio_page*` tables, and it re-emits statements from
 * earlier migrations. See cms/CLAUDE.md.
 *
 * Column shapes copied from what production already has, so the three existing
 * tables and the eleven new ones end up identical: varchar for the two text
 * fields, integer FK to media with ON DELETE SET NULL for the image, and the
 * `<table>_meta_meta_image_idx` index Payload expects.
 *
 * Note on localisation: the plugin ships these fields as `localized: true`,
 * which under this config would have put them in `<table>_locales` side tables
 * and orphaned the existing columns. payload.config.ts strips that flag. If the
 * site ever goes multilingual, that is a data migration, not a config change.
 */

const TABLES = [
  'case_studies',
  'offers',
  'homepage',
  'about',
  'contact_page',
  'services_page',
  'projects_page',
  'video_production_page',
  'web_design_page',
  'brand_identity_page',
  'seo_page',
  // Already present in production, listed so a database built from scratch
  // (and the from-scratch replay check) ends up in the same place.
  'blog_posts',
  'pages',
  'services',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const table of TABLES) {
    await db.execute(sql.raw(`
      ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "meta_title" varchar;
      ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "meta_description" varchar;
      ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "meta_image_id" integer;

      DO $$ BEGIN
        ALTER TABLE "${table}"
          ADD CONSTRAINT "${table}_meta_image_id_media_id_fk"
          FOREIGN KEY ("meta_image_id") REFERENCES "media"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      CREATE INDEX IF NOT EXISTS "${table}_meta_meta_image_idx"
        ON "${table}" USING btree ("meta_image_id");
    `))
  }
}

/**
 * Drops only what `up` could have added. The three pre-existing tables are left
 * alone: their columns predate this migration and may hold data that was
 * written before it ran, so removing them here would destroy content this
 * migration never created.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  const added = TABLES.filter((t) => !['blog_posts', 'pages', 'services'].includes(t))
  for (const table of added) {
    await db.execute(sql.raw(`
      DROP INDEX IF EXISTS "${table}_meta_meta_image_idx";
      ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${table}_meta_image_id_media_id_fk";
      ALTER TABLE "${table}" DROP COLUMN IF EXISTS "meta_image_id";
      ALTER TABLE "${table}" DROP COLUMN IF EXISTS "meta_description";
      ALTER TABLE "${table}" DROP COLUMN IF EXISTS "meta_title";
    `))
  }
}
