import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Two columns behind the 4 September 2026 pricing work.
 *
 *   clients.country     the two-letter code that decides an invoice's currency.
 *                       The site has priced every visitor by country for a
 *                       while; the invoice that followed the sale defaulted to
 *                       USD regardless, so a client who agreed to GH₵ 2,500
 *                       could be billed in dollars.
 *
 *   offers.expires_at   when "Limited Time Offer" stops being true. There was
 *                       no way to end an offer, so all three had run
 *                       indefinitely under a badge saying they would not.
 *
 * Both are nullable with no default, so every existing row keeps the behaviour
 * it had: a client with no country is invoiced in USD exactly as before, and an
 * offer with no expiry runs until it is unpublished by hand.
 *
 * `IF NOT EXISTS` because Payload's own schema push may already have added
 * these on a development database, and a migration that cannot be run twice is
 * a migration that blocks a deploy the first time anything is out of step.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "country" varchar;
    ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "expires_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "clients" DROP COLUMN IF EXISTS "country";
    ALTER TABLE "offers" DROP COLUMN IF EXISTS "expires_at";
  `)
}
