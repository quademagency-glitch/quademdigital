import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Two more pieces of artwork for the homepage promo cards.
 *
 * AI Automation and Fieldwork are both live services with their own pages, but
 * neither had a card on the homepage, so the only route to them from the front
 * page was the Services link in the footer. The two Astro components exist now;
 * this is the CMS half.
 *
 * `promoSections.visual` is a Payload select, which in Postgres is an enum. A
 * value the type does not carry is rejected on write, so the two new options in
 * Homepage.ts cannot be chosen until this runs.
 *
 * ALTER TYPE ... ADD VALUE is additive and irreversible in Postgres: there is
 * no DROP VALUE. down() is therefore a no-op rather than a lie. Dropping and
 * recreating the type would mean rewriting every row that already uses it, to
 * undo something that costs nothing to leave in place.
 *
 * A migration is only half the job here. Until the CMS app on Railway is
 * redeployed with the updated Homepage.ts, Payload will not offer these two in
 * the Artwork menu, and a REST write naming them is dropped silently rather
 * than erroring.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TYPE "public"."enum_homepage_promo_sections_visual" ADD VALUE IF NOT EXISTS 'aiAutomation';
  ALTER TYPE "public"."enum_homepage_promo_sections_visual" ADD VALUE IF NOT EXISTS 'fieldwork';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Deliberately empty. See the note above: Postgres cannot remove an enum
  // value, and an unused one is harmless.
}
