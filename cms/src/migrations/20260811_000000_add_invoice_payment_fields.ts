import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the columns the Paystack settlement path and the invoice access gate
 * need.
 *
 * Background: verification previously trusted a browser-supplied documentId and
 * checked only that *some* Paystack transaction succeeded — never the amount,
 * the currency, whether the reference belonged to this invoice, or whether it
 * had already been used. And invoice pages were readable by anyone who guessed
 * a hand-typed invoiceId. Both need durable columns:
 *
 *   access_token           unguessable component of the invoice link
 *   amount_minor           authoritative total in minor units, so settlement
 *                          never recomputes from a browser-supplied figure
 *   paystack_reference     idempotency key — a reference settles exactly once
 *   paystack_amount_minor  what Paystack actually took, for reconciliation
 *   paystack_status        audit trail
 *   paid_at / token_issued_at  timestamps
 *
 * ORDER MATTERS inside up(). Columns are added nullable with no defaults, then
 * backfilled per row, and only then indexed. A column-level default would give
 * every existing row an identical token and fail the unique index immediately;
 * creating a non-partial unique index up front would fail on any row the
 * backfill missed. The indexes are therefore partial (WHERE ... IS NOT NULL).
 *
 * The access_token backfill runs in SQL rather than over the REST API on
 * purpose: src/lib/payload.ts notes the CMS instance is small and prone to
 * overload under bursts, and this touches every invoice row.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Columns, all nullable, no defaults.
  await db.execute(sql`
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "access_token" varchar;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "token_issued_at" timestamp(3) with time zone;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "amount_minor" integer;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paid_at" timestamp(3) with time zone;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paystack_reference" varchar;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paystack_amount_minor" integer;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paystack_status" varchar;
  `)

  // 2. Authoritative total, in minor units, from the line items.
  //    Mirrors the page arithmetic exactly: sum(rate * quantity), then tax,
  //    then round once at the end — the same Math.round(total * 100) the
  //    Paystack charge uses, so settlement can compare byte-for-byte.
  await db.execute(sql`
    UPDATE "invoices" AS inv
    SET "amount_minor" = ROUND(
      COALESCE((
        SELECT SUM(it."rate" * it."quantity")
        FROM "invoices_items" AS it
        WHERE it."_parent_id" = inv."id"
      ), 0) * (1 + COALESCE(inv."tax_rate", 0) / 100.0) * 100
    )
    WHERE inv."amount_minor" IS NULL;
  `)

  // 3. Normalise currency. It is free text, and Paystack matches case-sensitively.
  await db.execute(sql`
    UPDATE "invoices"
    SET "currency" = UPPER(TRIM(COALESCE(NULLIF("currency", ''), 'USD')))
    WHERE "currency" IS DISTINCT FROM UPPER(TRIM(COALESCE(NULLIF("currency", ''), 'USD')));
  `)

  // 4. Per-row token. gen_random_uuid() is core in PG13+, so no pgcrypto needed.
  //    Two concatenated UUIDs = 64 hex chars.
  await db.execute(sql`
    UPDATE "invoices"
    SET "access_token" = replace(gen_random_uuid()::text, '-', '')
                      || replace(gen_random_uuid()::text, '-', ''),
        "token_issued_at" = now()
    WHERE "access_token" IS NULL;
  `)

  // 5. Anything already marked paid gets a best-effort paid_at.
  await db.execute(sql`
    UPDATE "invoices"
    SET "paid_at" = "updated_at"
    WHERE "status" = 'paid' AND "paid_at" IS NULL;
  `)

  // 6. Indexes last, and partial so a missed row cannot fail the migration.
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "invoices_access_token_idx"
      ON "invoices" ("access_token") WHERE "access_token" IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS "invoices_paystack_reference_idx"
      ON "invoices" ("paystack_reference") WHERE "paystack_reference" IS NOT NULL;
    CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" ("status");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "invoices_access_token_idx";
    DROP INDEX IF EXISTS "invoices_paystack_reference_idx";
    DROP INDEX IF EXISTS "invoices_status_idx";
    ALTER TABLE "invoices" DROP COLUMN IF EXISTS "access_token";
    ALTER TABLE "invoices" DROP COLUMN IF EXISTS "token_issued_at";
    ALTER TABLE "invoices" DROP COLUMN IF EXISTS "amount_minor";
    ALTER TABLE "invoices" DROP COLUMN IF EXISTS "paid_at";
    ALTER TABLE "invoices" DROP COLUMN IF EXISTS "paystack_reference";
    ALTER TABLE "invoices" DROP COLUMN IF EXISTS "paystack_amount_minor";
    ALTER TABLE "invoices" DROP COLUMN IF EXISTS "paystack_status";
  `)
}
