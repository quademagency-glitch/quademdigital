import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "messages" ADD COLUMN "reply_to_id" integer;
  ALTER TABLE "messages" ADD COLUMN "reply_to_author" varchar;
  ALTER TABLE "messages" ADD COLUMN "reply_to_text" varchar;
  ALTER TABLE "leads_activity" ADD COLUMN "counts_on" timestamp(3) with time zone;
  ALTER TABLE "leads" ADD COLUMN "counts_on" timestamp(3) with time zone;
  ALTER TABLE "_leads_v_version_activity" ADD COLUMN "counts_on" timestamp(3) with time zone;
  ALTER TABLE "_leads_v" ADD COLUMN "version_counts_on" timestamp(3) with time zone;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_messages_id_fk" FOREIGN KEY ("reply_to_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "messages_reply_to_idx" ON "messages" USING btree ("reply_to_id");
  CREATE INDEX "leads_counts_on_idx" ON "leads" USING btree ("counts_on");
  CREATE INDEX "_leads_v_version_version_counts_on_idx" ON "_leads_v" USING btree ("version_counts_on");`)
  // Every lead so far counts on the day it was logged, as the reports have counted it until now (Accra days are UTC days).
  const filled = await db.execute(sql`
    UPDATE "leads" SET "counts_on" = date_trunc('day', COALESCE("logged_at", "created_at") AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' WHERE "counts_on" IS NULL;`)
  await db.execute(sql`
    UPDATE "_leads_v" SET "version_counts_on" = date_trunc('day', COALESCE("version_logged_at", "created_at") AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' WHERE "version_counts_on" IS NULL;`)
  payload.logger.info(`Leads given the day they count on: ${filled.rowCount ?? 0}`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "messages" DROP CONSTRAINT "messages_reply_to_id_messages_id_fk";
  
  DROP INDEX "messages_reply_to_idx";
  DROP INDEX "leads_counts_on_idx";
  DROP INDEX "_leads_v_version_version_counts_on_idx";
  ALTER TABLE "messages" DROP COLUMN "reply_to_id";
  ALTER TABLE "messages" DROP COLUMN "reply_to_author";
  ALTER TABLE "messages" DROP COLUMN "reply_to_text";
  ALTER TABLE "leads_activity" DROP COLUMN "counts_on";
  ALTER TABLE "leads" DROP COLUMN "counts_on";
  ALTER TABLE "_leads_v_version_activity" DROP COLUMN "counts_on";
  ALTER TABLE "_leads_v" DROP COLUMN "version_counts_on";`)
}
