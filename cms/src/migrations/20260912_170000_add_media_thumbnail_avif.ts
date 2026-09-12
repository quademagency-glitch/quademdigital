import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * A 400px AVIF, so the AVIF ladder does not start at 800.
 *
 * Every image on this site is offered as AVIF first and webp second, and the
 * AVIF list held only `medium` (800) and `large` (1200). A browser picks from
 * within one format's list, so however small the box, the smallest AVIF on
 * offer was 800px wide. The homepage hero paints the founder's portrait as a
 * 74px circle on a phone and was pulling the 800px file for it.
 *
 * It is worse for the 22 images of 113 whose source is narrower than 1200. They
 * have no `large` at all, because `withoutEnlargement` refuses to upscale, so
 * their AVIF list was a single entry and the `sizes` attribute could not change
 * anything at any viewport. Blog and case study covers in that group run 48KB
 * to 72KB.
 *
 * Columns only. Existing rows keep a null thumbnailAvif, which the site reads as
 * "not available" and simply omits from the srcset, so nothing breaks while the
 * derivatives are backfilled. `cms/scripts/regenerate-avif-thumbnails.mjs` is
 * what fills them in.
 *
 * `media` keeps no versions, so this is one set of columns rather than two.
 *
 * Idempotent, per cms/CLAUDE.md, so a partial run can be re-run.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_avif_url" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_avif_width" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_avif_height" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_avif_mime_type" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_avif_filesize" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_avif_filename" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumbnail_avif_url";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumbnail_avif_width";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumbnail_avif_height";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumbnail_avif_mime_type";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumbnail_avif_filesize";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumbnail_avif_filename";
  `)
}
