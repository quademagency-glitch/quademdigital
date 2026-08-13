import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Deposits, partial payments and overdue chasing.
 *
 * Two gaps this closes:
 *
 *  1. The invoice model had no notion of a deposit or a partial payment —
 *     settlement was all-or-nothing and refused anything under the full total.
 *     A 50% deposit before work starts is the largest available improvement to
 *     cash timing, and it doubles as qualification.
 *
 *  2. The `overdue` status existed and nothing ever computed or acted on it,
 *     so nothing chased an unpaid invoice.
 *
 *   deposit_percent          0–100. 0 (or null) means "full payment only".
 *   deposit_minor            derived from amount_minor; what a deposit charge
 *                            must cover. Stored rather than recomputed so the
 *                            figure the client was shown is the figure
 *                            settlement checks.
 *   amount_paid_minor        running total actually collected.
 *   balance_reference        second Paystack reference (deposit, then balance).
 *                            Deliberately a column rather than a payments array:
 *                            a Payload array means a child table this migration
 *                            would have to hand-build to Payload's exact shape,
 *                            and the business case is two payments, not N.
 *   last_reminder_at /
 *   reminder_count           so a reminder is sent once per stage, not once per
 *                            cron tick.
 *
 * Order matters, same as 20260811: add nullable, backfill, then index. The
 * unique index on balance_reference is partial so the rows that have no second
 * payment (all of them, today) don't collide on NULL.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "deposit_percent" numeric;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "deposit_minor" integer;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "amount_paid_minor" integer;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "balance_reference" varchar;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "balance_amount_minor" integer;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "last_reminder_at" timestamp(3) with time zone;
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "reminder_count" integer;
  `)

  // Existing rows: no deposit required, and whatever was already collected.
  // An invoice already marked paid has, by definition, been paid in full — its
  // amount_minor is the authoritative total, so use that rather than
  // paystack_amount_minor, which is null for anything settled outside Paystack.
  await db.execute(sql`
    UPDATE "invoices"
    SET "deposit_percent"   = COALESCE("deposit_percent", 0),
        "reminder_count"    = COALESCE("reminder_count", 0),
        "amount_paid_minor" = COALESCE(
          "amount_paid_minor",
          -- ::text cast is required: "status" is a Postgres enum
          -- (enum_invoices_status) and lower() has no enum overload.
          CASE WHEN lower("status"::text) = 'paid' THEN COALESCE("amount_minor", 0) ELSE 0 END
        );
  `)

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "invoices_balance_reference_idx"
      ON "invoices" ("balance_reference")
      WHERE "balance_reference" IS NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS "invoices_balance_reference_idx";`)
  await db.execute(sql`
    ALTER TABLE "invoices" DROP COLUMN IF EXISTS "deposit_percent";
    ALTER TABLE "invoices" DROP COLUMN IF EXISTS "deposit_minor";
    ALTER TABLE "invoices" DROP COLUMN IF EXISTS "amount_paid_minor";
    ALTER TABLE "invoices" DROP COLUMN IF EXISTS "balance_reference";
    ALTER TABLE "invoices" DROP COLUMN IF EXISTS "balance_amount_minor";
    ALTER TABLE "invoices" DROP COLUMN IF EXISTS "last_reminder_at";
    ALTER TABLE "invoices" DROP COLUMN IF EXISTS "reminder_count";
  `)
}
