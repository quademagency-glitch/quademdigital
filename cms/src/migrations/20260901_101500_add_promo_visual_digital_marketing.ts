import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The seventh piece of artwork for the homepage promo cards.
 *
 * Separate from 20260901_094500 rather than folded into it: that one had
 * already run against production, and editing an applied migration means the
 * next machine to replay from scratch gets a different database from this one.
 *
 * Digital Marketing & Social Media was the third service with no card on the
 * homepage. It was in a worse position than the other two, because its card on
 * /services/ pointed at the SEO page: someone reading about social media
 * clicked through to search, and was then asked for a web address and a target
 * keyword by a form built for a different service. That routing is fixed in
 * src/pages/services.astro in the same commit.
 *
 * ALTER TYPE ... ADD VALUE is additive and irreversible in Postgres: there is
 * no DROP VALUE. down() is therefore a no-op rather than a lie.
 *
 * A migration is only half the job here. Until the CMS app on Railway is
 * redeployed with the updated Homepage.ts, Payload will not offer this in the
 * Artwork menu, and a REST write naming it is dropped silently rather than
 * erroring.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TYPE "public"."enum_homepage_promo_sections_visual" ADD VALUE IF NOT EXISTS 'digitalMarketing';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Deliberately empty. See the note above: Postgres cannot remove an enum
  // value, and an unused one is harmless.
}
