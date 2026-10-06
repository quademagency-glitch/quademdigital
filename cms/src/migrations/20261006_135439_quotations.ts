import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "proposals_line_items" ADD COLUMN "plan_id" integer;
  ALTER TABLE "proposals" ADD COLUMN "quote_number" varchar;
  ALTER TABLE "proposals" ADD COLUMN "quote_sent_at" timestamp(3) with time zone;
  ALTER TABLE "proposals" ADD COLUMN "valid_until" timestamp(3) with time zone;
  ALTER TABLE "proposals" ADD COLUMN "quote_token" varchar;
  ALTER TABLE "proposals" ADD COLUMN "quote_viewed_at" timestamp(3) with time zone;
  ALTER TABLE "proposals" ADD COLUMN "quote_view_count" numeric DEFAULT 0;
  ALTER TABLE "proposals" ADD COLUMN "accepted_via" varchar;
  ALTER TABLE "proposals" ADD COLUMN "accepted_name" varchar;
  ALTER TABLE "proposals" ADD COLUMN "accepted_from" varchar;
  ALTER TABLE "proposals" ADD COLUMN "declined_at" timestamp(3) with time zone;
  ALTER TABLE "proposals" ADD COLUMN "decline_reason" varchar;
  ALTER TABLE "proposals" ADD COLUMN "discussion_notes" varchar;
  ALTER TABLE "proposals" ADD COLUMN "suggestion_note" varchar;
  ALTER TABLE "proposals_line_items" ADD CONSTRAINT "proposals_line_items_plan_id_pricing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."pricing_plans"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "proposals_line_items_plan_idx" ON "proposals_line_items" USING btree ("plan_id");
  CREATE UNIQUE INDEX "proposals_quote_number_idx" ON "proposals" USING btree ("quote_number");
  CREATE UNIQUE INDEX "proposals_quote_token_idx" ON "proposals" USING btree ("quote_token");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "proposals_line_items" DROP CONSTRAINT "proposals_line_items_plan_id_pricing_plans_id_fk";
  
  DROP INDEX "proposals_line_items_plan_idx";
  DROP INDEX "proposals_quote_number_idx";
  DROP INDEX "proposals_quote_token_idx";
  ALTER TABLE "proposals_line_items" DROP COLUMN "plan_id";
  ALTER TABLE "proposals" DROP COLUMN "quote_number";
  ALTER TABLE "proposals" DROP COLUMN "quote_sent_at";
  ALTER TABLE "proposals" DROP COLUMN "valid_until";
  ALTER TABLE "proposals" DROP COLUMN "quote_token";
  ALTER TABLE "proposals" DROP COLUMN "quote_viewed_at";
  ALTER TABLE "proposals" DROP COLUMN "quote_view_count";
  ALTER TABLE "proposals" DROP COLUMN "accepted_via";
  ALTER TABLE "proposals" DROP COLUMN "accepted_name";
  ALTER TABLE "proposals" DROP COLUMN "accepted_from";
  ALTER TABLE "proposals" DROP COLUMN "declined_at";
  ALTER TABLE "proposals" DROP COLUMN "decline_reason";
  ALTER TABLE "proposals" DROP COLUMN "discussion_notes";
  ALTER TABLE "proposals" DROP COLUMN "suggestion_note";`)
}
