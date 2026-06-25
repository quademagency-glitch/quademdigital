import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * EmailCampaigns has had a `client` relationship field since 09d12490, but
 * no migration ever added the column — same missing-migration class of bug
 * as 20260625_010000. Caught by `pnpm smoke-test` against production.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "client_id" integer;

  DO $$ BEGIN
   ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE INDEX IF NOT EXISTS "email_campaigns_client_idx" ON "email_campaigns" USING btree ("client_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "email_campaigns" DROP COLUMN IF EXISTS "client_id";`)
}
