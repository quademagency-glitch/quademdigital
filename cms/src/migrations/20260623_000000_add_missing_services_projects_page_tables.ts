import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * servicesPage/projectsPage tables already exist in production but with a
 * stale schema (title/subtitle only) from before the globals' field configs
 * were updated to title/description/heading/subheading. That mismatch makes
 * every read 500 with "Something went wrong" (Drizzle selects columns that
 * don't exist). This adds the missing columns and carries the existing
 * subtitle copy into subheading so current content isn't lost.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "services_page" ADD COLUMN IF NOT EXISTS "description" varchar;
  ALTER TABLE "services_page" ADD COLUMN IF NOT EXISTS "heading" varchar;
  ALTER TABLE "services_page" ADD COLUMN IF NOT EXISTS "subheading" varchar;

  ALTER TABLE "projects_page" ADD COLUMN IF NOT EXISTS "description" varchar;
  ALTER TABLE "projects_page" ADD COLUMN IF NOT EXISTS "heading" varchar;
  ALTER TABLE "projects_page" ADD COLUMN IF NOT EXISTS "subheading" varchar;

  -- Carry legacy "subtitle" content into "subheading", but only where that
  -- legacy column still exists. Production has it (a pre-baseline remnant); a
  -- from-scratch replay never creates it, so guard the copy so the migration
  -- chain replays cleanly on a fresh database.
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services_page' AND column_name = 'subtitle') THEN
      UPDATE "services_page" SET "subheading" = "subtitle" WHERE "subheading" IS NULL AND "subtitle" IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects_page' AND column_name = 'subtitle') THEN
      UPDATE "projects_page" SET "subheading" = "subtitle" WHERE "subheading" IS NULL AND "subtitle" IS NOT NULL;
    END IF;
  END $$;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "services_page" DROP COLUMN IF EXISTS "description";
  ALTER TABLE "services_page" DROP COLUMN IF EXISTS "heading";
  ALTER TABLE "services_page" DROP COLUMN IF EXISTS "subheading";

  ALTER TABLE "projects_page" DROP COLUMN IF EXISTS "description";
  ALTER TABLE "projects_page" DROP COLUMN IF EXISTS "heading";
  ALTER TABLE "projects_page" DROP COLUMN IF EXISTS "subheading";`)
}
