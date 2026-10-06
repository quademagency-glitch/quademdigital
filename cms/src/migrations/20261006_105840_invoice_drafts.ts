import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "invoices" ADD COLUMN "issued_at" timestamp(3) with time zone;
  ALTER TABLE "invoices" ADD COLUMN "last_sent_at" timestamp(3) with time zone;
  ALTER TABLE "invoices" ADD COLUMN "draft_note" varchar;
  ALTER TABLE "_invoices_v" ADD COLUMN "version_issued_at" timestamp(3) with time zone;
  ALTER TABLE "_invoices_v" ADD COLUMN "version_last_sent_at" timestamp(3) with time zone;
  ALTER TABLE "_invoices_v" ADD COLUMN "version_draft_note" varchar;
  CREATE INDEX "invoices_issued_at_idx" ON "invoices" USING btree ("issued_at");
  CREATE INDEX "_invoices_v_version_version_issued_at_idx" ON "_invoices_v" USING btree ("version_issued_at");`)
  // Every invoice that exists already counts as issued: clients, their invoice
  // links and the reminders keep seeing exactly what they saw before. Only
  // invoices created from now on start as drafts.
  await db.execute(sql`UPDATE "invoices" SET "issued_at" = COALESCE("date_issued", "created_at") WHERE "issued_at" IS NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "invoices_issued_at_idx";
  DROP INDEX "_invoices_v_version_version_issued_at_idx";
  ALTER TABLE "invoices" DROP COLUMN "issued_at";
  ALTER TABLE "invoices" DROP COLUMN "last_sent_at";
  ALTER TABLE "invoices" DROP COLUMN "draft_note";
  ALTER TABLE "_invoices_v" DROP COLUMN "version_issued_at";
  ALTER TABLE "_invoices_v" DROP COLUMN "version_last_sent_at";
  ALTER TABLE "_invoices_v" DROP COLUMN "version_draft_note";`)
}
