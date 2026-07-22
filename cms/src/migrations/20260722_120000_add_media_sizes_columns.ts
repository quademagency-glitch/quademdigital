import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Media.ts defines `upload.imageSizes` (thumb, thumbnail, card, medium,
 * large, og), but the baseline migration's "media" table only has the
 * legacy single `thumbnail_u_r_l` column — the six `sizes_*` column groups
 * Payload's Postgres adapter generates for imageSizes were never created.
 * Every read of the media collection (and anything populating a relation
 * into it — blogPosts, caseStudies, services, etc.) selects those columns
 * and 500s with "column does not exist".
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumb_url" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumb_width" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumb_height" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumb_mime_type" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumb_filesize" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumb_filename" varchar;

    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_url" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_width" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_height" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_mime_type" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_filesize" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_filename" varchar;

    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_card_url" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_card_width" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_card_height" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_card_mime_type" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_card_filesize" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_card_filename" varchar;

    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_medium_url" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_medium_width" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_medium_height" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_medium_mime_type" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_medium_filesize" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_medium_filename" varchar;

    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_large_url" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_large_width" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_large_height" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_large_mime_type" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_large_filesize" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_large_filename" varchar;

    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_og_url" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_og_width" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_og_height" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_og_mime_type" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_og_filesize" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_og_filename" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumb_url";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumb_width";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumb_height";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumb_mime_type";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumb_filesize";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumb_filename";

    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumbnail_url";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumbnail_width";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumbnail_height";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumbnail_mime_type";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumbnail_filesize";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumbnail_filename";

    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_card_url";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_card_width";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_card_height";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_card_mime_type";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_card_filesize";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_card_filename";

    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_medium_url";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_medium_width";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_medium_height";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_medium_mime_type";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_medium_filesize";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_medium_filename";

    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_large_url";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_large_width";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_large_height";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_large_mime_type";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_large_filesize";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_large_filename";

    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_og_url";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_og_width";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_og_height";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_og_mime_type";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_og_filesize";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_og_filename";
  `)
}
