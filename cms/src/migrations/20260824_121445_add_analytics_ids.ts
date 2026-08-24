import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Tracking codes on Site Settings.
 *
 * These were literals in `BaseLayout.astro`, three of them inside an
 * `is:inline` script, so changing a Google Analytics property or adding a tool
 * meant a code change and a deploy.
 *
 * Seeded with the codes that were already running, so the admin shows what the
 * site actually uses rather than four empty boxes nobody could fill in from
 * memory. The layout still falls back to the same values if a box is cleared,
 * and refuses anything that is not the right shape for its field, because a
 * typo here would kill measurement with nothing visible on the page to show it.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "analytics_gtm_id" varchar;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "analytics_ga4_id" varchar;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "analytics_ahrefs_key" varchar;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "analytics_metricool_hash" varchar;`)

  /*
    Fill in what is live. Only where the column is still null, so re-running
    this cannot overwrite a code Ernest has since changed in the admin.
  */
  await db.execute(sql`
    UPDATE "site_settings" SET
      "analytics_gtm_id" = COALESCE("analytics_gtm_id", 'GTM-5CPTKQDB'),
      "analytics_ga4_id" = COALESCE("analytics_ga4_id", 'G-VWQNS4KFSX'),
      "analytics_ahrefs_key" = COALESCE("analytics_ahrefs_key", 'rLG9enHa3Ne7Ob/OK/j4uQ'),
      "analytics_metricool_hash" = COALESCE("analytics_metricool_hash", 'bcdd5bfa41ecd1f677666e2700228d65')`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "analytics_gtm_id";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "analytics_ga4_id";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "analytics_ahrefs_key";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "analytics_metricool_hash";`)
}
