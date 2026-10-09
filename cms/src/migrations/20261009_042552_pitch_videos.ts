import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
  Video pitches (9 October 2026): a pitch can be a recorded video as well as a
  page (src/collections/Pitches.ts, lib/pitchVideos.ts), and a team member has
  a WhatsApp number for the clients they send videos to.

  Only adds. Existing pitches become kind 'page' with approval 'not-needed', so
  every pitch already sent carries on exactly as it was. Generated, then made
  safe to run twice.
*/
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
    CREATE TYPE "public"."enum_pitches_kind" AS ENUM('page', 'video');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_pitches_approval" AS ENUM('not-needed', 'waiting', 'approved', 'sent-back');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_pitches_video_status" AS ENUM('pending', 'processing', 'ready', 'failed');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "whatsapp" varchar;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "kind" "enum_pitches_kind" DEFAULT 'page';
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "sent_by_id" integer;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "message" varchar;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "approval" "enum_pitches_approval" DEFAULT 'not-needed';
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "approval_note" varchar;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "video_status" "enum_pitches_video_status" DEFAULT 'pending';
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "video_error" varchar;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "video_progress" numeric;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "video_source_key" varchar;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "video_original_key" varchar;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "video_mp4_key" varchar;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "video_poster_key" varchar;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "video_share_key" varchar;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "video_mime" varchar;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "video_bytes" numeric;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "video_duration_seconds" numeric;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "video_width" numeric;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "video_height" numeric;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "video_processed_at" timestamp(3) with time zone;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "video_attempts" numeric DEFAULT 0;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "video_heartbeat_at" timestamp(3) with time zone;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "video_incoming" jsonb;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "watch_play_count" numeric DEFAULT 0;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "watch_watched_percent" numeric DEFAULT 0;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "watch_first_played_at" timestamp(3) with time zone;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "watch_last_played_at" timestamp(3) with time zone;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "slides" jsonb;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "deck_key" varchar;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "deck_pages" numeric;
  ALTER TABLE "pitches" ADD COLUMN IF NOT EXISTS "deck_downloadable" boolean DEFAULT true;
  DO $$ BEGIN
    ALTER TABLE "pitches" ADD CONSTRAINT "pitches_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  CREATE INDEX IF NOT EXISTS "pitches_kind_idx" ON "pitches" USING btree ("kind");
  CREATE INDEX IF NOT EXISTS "pitches_sent_by_idx" ON "pitches" USING btree ("sent_by_id");
  CREATE INDEX IF NOT EXISTS "pitches_approval_idx" ON "pitches" USING btree ("approval");
  CREATE INDEX IF NOT EXISTS "pitches_video_video_status_idx" ON "pitches" USING btree ("video_status");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pitches" DROP CONSTRAINT "pitches_sent_by_id_users_id_fk";
  
  DROP INDEX "pitches_kind_idx";
  DROP INDEX "pitches_sent_by_idx";
  DROP INDEX "pitches_approval_idx";
  DROP INDEX "pitches_video_video_status_idx";
  ALTER TABLE "users" DROP COLUMN "whatsapp";
  ALTER TABLE "pitches" DROP COLUMN "kind";
  ALTER TABLE "pitches" DROP COLUMN "sent_by_id";
  ALTER TABLE "pitches" DROP COLUMN "message";
  ALTER TABLE "pitches" DROP COLUMN "approval";
  ALTER TABLE "pitches" DROP COLUMN "approval_note";
  ALTER TABLE "pitches" DROP COLUMN "video_status";
  ALTER TABLE "pitches" DROP COLUMN "video_error";
  ALTER TABLE "pitches" DROP COLUMN "video_progress";
  ALTER TABLE "pitches" DROP COLUMN "video_source_key";
  ALTER TABLE "pitches" DROP COLUMN "video_original_key";
  ALTER TABLE "pitches" DROP COLUMN "video_mp4_key";
  ALTER TABLE "pitches" DROP COLUMN "video_poster_key";
  ALTER TABLE "pitches" DROP COLUMN "video_share_key";
  ALTER TABLE "pitches" DROP COLUMN "video_mime";
  ALTER TABLE "pitches" DROP COLUMN "video_bytes";
  ALTER TABLE "pitches" DROP COLUMN "video_duration_seconds";
  ALTER TABLE "pitches" DROP COLUMN "video_width";
  ALTER TABLE "pitches" DROP COLUMN "video_height";
  ALTER TABLE "pitches" DROP COLUMN "video_processed_at";
  ALTER TABLE "pitches" DROP COLUMN "video_attempts";
  ALTER TABLE "pitches" DROP COLUMN "video_heartbeat_at";
  ALTER TABLE "pitches" DROP COLUMN "video_incoming";
  ALTER TABLE "pitches" DROP COLUMN "watch_play_count";
  ALTER TABLE "pitches" DROP COLUMN "watch_watched_percent";
  ALTER TABLE "pitches" DROP COLUMN "watch_first_played_at";
  ALTER TABLE "pitches" DROP COLUMN "watch_last_played_at";
  ALTER TABLE "pitches" DROP COLUMN "slides";
  ALTER TABLE "pitches" DROP COLUMN "deck_key";
  ALTER TABLE "pitches" DROP COLUMN "deck_pages";
  ALTER TABLE "pitches" DROP COLUMN "deck_downloadable";
  DROP TYPE "public"."enum_pitches_kind";
  DROP TYPE "public"."enum_pitches_approval";
  DROP TYPE "public"."enum_pitches_video_status";`)
}
