import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The footer tagline in the results-led voice of the services restructure
 * (Ernest, 20 October 2026: "go").
 *
 * Before: "Premium design and smart strategy for brands that want to grow."
 * After:  "Websites, AI video, search and ads that bring in customers."
 * The same line the international page's footer already uses.
 *
 * A migration because siteSettings is admin-only to write and the site's API
 * key is the editor's (as 20261019_120000_services_restructure_links).
 * Guarded: it changes the tagline only while it still reads exactly as
 * before, so an edit made in the admin since is left alone and the replay on
 * every Railway boot does nothing the second time.
 */

const BEFORE = 'Premium design and smart strategy for brands that want to grow.'
const AFTER = 'Websites, AI video, search and ads that bring in customers.'
const q = (v: string) => `'${v.replace(/'/g, "''")}'`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`UPDATE "site_settings" SET "footer_tagline" = ${q(AFTER)} WHERE "footer_tagline" = ${q(BEFORE)};`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`UPDATE "site_settings" SET "footer_tagline" = ${q(BEFORE)} WHERE "footer_tagline" = ${q(AFTER)};`))
}
