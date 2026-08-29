import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
  Point the site's contact address at the inbox that is actually read.

  siteSettings.email was info@quademdigital.com while the outreach pages, the
  privacy copy and every unsubscribe route told recipients to write to
  ernest@quademdigital.com to be removed. Those two have to agree before a
  single cold email goes out: the removal address is a legal promise, and a
  promise pointing at an unmonitored inbox is worse than no promise, because it
  looks like compliance while quietly swallowing the requests.

  A migration rather than a REST call for the same reason as the address:
  siteSettings is admin-only to write because it holds the bank account an
  invoice tells a client to pay into, and the site's API key is the editor
  account.

  The WHERE clause is the safety. Railway replays migrations on boot, so an
  unguarded UPDATE would drag the address back to ernest@ every deploy after any
  future change. This only ever moves the one value it was written to move.
*/

const OLD_EMAIL = 'info@quademdigital.com'
const NEW_EMAIL = 'ernest@quademdigital.com'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "site_settings"
       SET "email" = ${NEW_EMAIL}
     WHERE "email" IS NULL OR btrim("email") = '' OR btrim("email") = ${OLD_EMAIL};
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "site_settings"
       SET "email" = ${OLD_EMAIL}
     WHERE btrim("email") = ${NEW_EMAIL};
  `)
}
