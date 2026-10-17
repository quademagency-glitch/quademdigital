import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "deal_id" integer;
  ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "client_id" integer;
  ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "founder_only" boolean DEFAULT false;
  DO $$ BEGIN
    ALTER TABLE "documents" ADD CONSTRAINT "documents_deal_id_proposals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  CREATE INDEX IF NOT EXISTS "documents_deal_idx" ON "documents" USING btree ("deal_id");
  CREATE INDEX IF NOT EXISTS "documents_client_idx" ON "documents" USING btree ("client_id");
  CREATE INDEX IF NOT EXISTS "documents_founder_only_idx" ON "documents" USING btree ("founder_only");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "documents" DROP CONSTRAINT "documents_deal_id_proposals_id_fk";
  
  ALTER TABLE "documents" DROP CONSTRAINT "documents_client_id_clients_id_fk";
  
  DROP INDEX "documents_deal_idx";
  DROP INDEX "documents_client_idx";
  DROP INDEX "documents_founder_only_idx";
  ALTER TABLE "documents" DROP COLUMN "deal_id";
  ALTER TABLE "documents" DROP COLUMN "client_id";
  ALTER TABLE "documents" DROP COLUMN "founder_only";`)
}
