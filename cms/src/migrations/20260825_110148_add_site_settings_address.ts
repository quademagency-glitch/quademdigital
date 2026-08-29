import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
  The postal address, added to Site Settings and seeded with the real one.

  Schema and data in one file, and the data half is deliberately a migration
  rather than an API call, for the same reason as the nav and footer seed:
  siteSettings is admin-only to write because it holds the bank account an
  invoice tells a client to pay into, and the site's API key belongs to the
  editor account. A migration is the one path that can seed it, and it leaves a
  record.

  Why the site needs this at all: the outbound campaign sends roughly a thousand
  commercial emails, US anti-spam law wants a real physical address in each one,
  and there was no address anywhere on the site. The only occurrence was
  "Accra, Ghana" inside an invoice template, which is a country.

  The WHERE clause on the seed is the entire safety of this file. Railway
  replays migrations on boot. Without it, the day the address is swapped for a
  PO box every deploy would silently put the old one back, on a public page and
  in every email that quotes the site.
*/

const ADDRESS = '18th Ahmadiyyah Avenue, Lakeside, Accra, Ghana'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "address" varchar;
  `)

  // Seed only when empty, so an edit made in the admin always wins.
  await db.execute(sql`
    UPDATE "site_settings"
       SET "address" = ${ADDRESS}
     WHERE "address" IS NULL OR btrim("address") = '';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "address";
  `)
}
