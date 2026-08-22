import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The AI Video & Reels page had no way to put a reel on itself.
 *
 * Its showreel section accepted a YouTube or Vimeo URL and nothing else, so
 * the one page selling short-form video could only ever embed somebody else's
 * player, send its visitors off to another site, and load their tracking to do
 * it. `showreel_video_file_id` lets the reel be uploaded here, where it gets
 * transcoded like any other video and plays from this domain.
 *
 * Mirrors `hero_media_id` on the same table, including ON DELETE SET NULL: a
 * deleted media item should empty the slot, never take the page's whole row
 * with it.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "video_production_page" ADD COLUMN IF NOT EXISTS "showreel_video_file_id" integer;

    DO $$ BEGIN
     ALTER TABLE "video_production_page"
       ADD CONSTRAINT "video_production_page_showreel_video_file_id_media_id_fk"
       FOREIGN KEY ("showreel_video_file_id") REFERENCES "public"."media"("id")
       ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "video_production_page"
      DROP CONSTRAINT IF EXISTS "video_production_page_showreel_video_file_id_media_id_fk";
    ALTER TABLE "video_production_page" DROP COLUMN IF EXISTS "showreel_video_file_id";
  `)
}
