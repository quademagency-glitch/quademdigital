import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Media.ts grew two things at once:
 *
 *   1. A video pipeline. Uploaded video used to be served exactly as it came
 *      off a camera, which is an editing format, not a delivery one. The new
 *      fields hold what ffmpeg produces from it (poster, mp4, a narrow-screen
 *      mp4, webm) plus the status an editor watches while it runs.
 *   2. AVIF copies of the two largest image sizes, which the Postgres adapter
 *      stores as another two `sizes_*` column groups.
 *
 * The jsonb columns are deliberate. A variant is five fields and there are
 * four of them; twenty more columns on `media` to hold data no query ever
 * filters on would be twenty more things every read of this table drags
 * along.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
     CREATE TYPE "public"."enum_media_video_usage" AS ENUM('background', 'playable');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
     CREATE TYPE "public"."enum_media_video_status" AS ENUM('pending', 'processing', 'ready', 'oversize', 'failed');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "video_usage" "enum_media_video_usage" DEFAULT 'background';
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "video_status" "enum_media_video_status";
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "video_error" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "video_poster" jsonb;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "video_mp4" jsonb;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "video_mobile" jsonb;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "video_webm" jsonb;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "video_duration" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "video_width" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "video_height" numeric;

    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_medium_avif_url" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_medium_avif_width" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_medium_avif_height" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_medium_avif_mime_type" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_medium_avif_filesize" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_medium_avif_filename" varchar;

    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_large_avif_url" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_large_avif_width" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_large_avif_height" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_large_avif_mime_type" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_large_avif_filesize" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_large_avif_filename" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "media" DROP COLUMN IF EXISTS "video_usage";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "video_status";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "video_error";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "video_poster";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "video_mp4";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "video_mobile";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "video_webm";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "video_duration";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "video_width";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "video_height";

    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_medium_avif_url";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_medium_avif_width";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_medium_avif_height";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_medium_avif_mime_type";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_medium_avif_filesize";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_medium_avif_filename";

    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_large_avif_url";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_large_avif_width";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_large_avif_height";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_large_avif_mime_type";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_large_avif_filesize";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_large_avif_filename";

    DROP TYPE IF EXISTS "public"."enum_media_video_status";
    DROP TYPE IF EXISTS "public"."enum_media_video_usage";
  `)
}
