import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The column that made every write to a client fail.
 *
 * `clients` keeps versions (`versions: { maxPerDoc: 50 }`), so Payload mirrors
 * every field of the collection into `_clients_v` as `version_<field>` and
 * writes a row there on each save. 20260904_120000_add_client_country_and_offer_expiry
 * added `clients.country` and stopped at the main table, so `version_country`
 * never existed.
 *
 * The effect was not subtle and was not limited to versions. From 4 September
 * 2026 every create, every update and every delete on a client answered
 * HTTP 500 "Something went wrong", because all three touch `_clients_v`, while
 * reading a client kept working perfectly: the main table was complete, so the
 * list and the edit screen loaded and only acting on them failed. Reading
 * `/api/clients/versions` 500'd for the same reason and is the quickest way to
 * spot this shape of breakage: compare it against another versioned collection,
 * `leads` or `invoices`, which both answer 200.
 *
 * THE RULE THIS BROKE, WHICH IS ALREADY IN cms/CLAUDE.md
 *
 * A field added to a versioned collection needs TWO columns, not one. Adding it
 * to the collection table alone leaves reads working and writes dead, which is
 * the worst possible split because nothing looks wrong until somebody tries to
 * save. `payload migrate:create` emits both; this one was hand-written and
 * emitted one.
 *
 * Nullable with no default, matching the main table, so no existing version row
 * changes meaning.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "_clients_v" ADD COLUMN IF NOT EXISTS "version_country" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "_clients_v" DROP COLUMN IF EXISTS "version_country";
  `)
}
