import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * How many times a pitch has been opened, and when.
 *
 * Between sending a sample site and hearing back there is one thing worth
 * knowing, and the CMS could not answer it. These three columns are written by
 * the page itself: the served document carries a beacon that posts to
 * /api/pitch-view/ on the site, which is what makes the count people rather
 * than crawlers.
 *
 * `view_count` defaults to 0 rather than null so the list column reads "0"
 * instead of an empty cell, which is a different and more worrying thing to
 * see next to a pitch you sent yesterday.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "view_count" numeric DEFAULT 0;
    ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "first_viewed_at" timestamp(3) with time zone;
    ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "last_viewed_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pitches" DROP COLUMN IF EXISTS "view_count";
    ALTER TABLE "pitches" DROP COLUMN IF EXISTS "first_viewed_at";
    ALTER TABLE "pitches" DROP COLUMN IF EXISTS "last_viewed_at";
  `)
}
