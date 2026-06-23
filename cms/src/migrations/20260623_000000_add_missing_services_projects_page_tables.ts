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
  UPDATE "services_page" SET "subheading" = "subtitle" WHERE "subheading" IS NULL AND "subtitle" IS NOT NULL;

  ALTER TABLE "projects_page" ADD COLUMN IF NOT EXISTS "description" varchar;
  ALTER TABLE "projects_page" ADD COLUMN IF NOT EXISTS "heading" varchar;
  ALTER TABLE "projects_page" ADD COLUMN IF NOT EXISTS "subheading" varchar;
  UPDATE "projects_page" SET "subheading" = "subtitle" WHERE "subheading" IS NULL AND "subtitle" IS NOT NULL;`)
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
