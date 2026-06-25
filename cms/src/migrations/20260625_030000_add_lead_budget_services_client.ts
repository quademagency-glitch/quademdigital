import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the new Leads fields (budget, servicesInterested, convertedClient)
 * used by the contact-form-to-CRM integration. Same missing-migration class
 * of bug as 20260625_020000 — Payload's dev-mode `push` never reaches prod.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
   CREATE TYPE "public"."enum_leads_budget" AS ENUM('< $2,000', '$2k - $5k', '$5k - $10k', '$10k+');
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "budget" "enum_leads_budget";
  ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "services_interested" jsonb;
  ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "converted_client_id" integer;

  DO $$ BEGIN
   ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_client_id_clients_id_fk" FOREIGN KEY ("converted_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE INDEX IF NOT EXISTS "leads_converted_client_idx" ON "leads" USING btree ("converted_client_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "leads" DROP COLUMN IF EXISTS "budget";
  ALTER TABLE "leads" DROP COLUMN IF EXISTS "services_interested";
  ALTER TABLE "leads" DROP COLUMN IF EXISTS "converted_client_id";
  DROP TYPE IF EXISTS "public"."enum_leads_budget";`)
}
