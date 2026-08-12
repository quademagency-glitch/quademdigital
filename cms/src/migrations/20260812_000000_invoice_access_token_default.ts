import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Guarantee every invoice has an access token, at the database level.
 *
 * 20260811 backfilled tokens for the rows that existed when it ran, and the
 * collection has a beforeChange hook for new ones. That leaves a gap: any
 * invoice created after the migration but before the CMS is redeployed with
 * the new field config gets a NULL token, because Payload does not yet know
 * the field exists. The invoice page requires a matching token, so such an
 * invoice would 404 on its emailed link permanently. This was not theoretical
 * — it happened to the first invoice created after the migration.
 *
 * A column DEFAULT closes it. gen_random_uuid() is VOLATILE, so it is
 * evaluated per row and every insert gets a distinct value — the unique
 * partial index is unaffected. (An earlier note in the plan claimed a default
 * would make every row identical; that is true only of a constant default.)
 *
 * Belt and braces: the app hook still runs, and now the database backstops it.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "invoices"
      ALTER COLUMN "access_token"
      SET DEFAULT replace(gen_random_uuid()::text, '-', '')
               || replace(gen_random_uuid()::text, '-', '');
  `)

  // Re-runnable: catches anything created in the gap described above.
  await db.execute(sql`
    UPDATE "invoices"
    SET "access_token" = replace(gen_random_uuid()::text, '-', '')
                      || replace(gen_random_uuid()::text, '-', ''),
        "token_issued_at" = COALESCE("token_issued_at", now())
    WHERE "access_token" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "invoices" ALTER COLUMN "access_token" DROP DEFAULT;
  `)
}
