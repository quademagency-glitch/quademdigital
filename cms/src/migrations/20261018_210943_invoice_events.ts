import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    CREATE TYPE "public"."enum_invoice_events_kind" AS ENUM('issued', 'emailed', 'resent', 'reminder', 'whatsapp', 'failed', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'viewed');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  CREATE TABLE IF NOT EXISTS "invoice_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"invoice_id" integer NOT NULL,
  	"kind" "enum_invoice_events_kind" NOT NULL,
  	"at" timestamp(3) with time zone NOT NULL,
  	"to" varchar,
  	"send_id" varchar,
  	"pdf" boolean DEFAULT false,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "invoice_events_id" integer;
  DO $$ BEGIN
    ALTER TABLE "invoice_events" ADD CONSTRAINT "invoice_events_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  CREATE INDEX IF NOT EXISTS "invoice_events_invoice_idx" ON "invoice_events" USING btree ("invoice_id");
  CREATE INDEX IF NOT EXISTS "invoice_events_kind_idx" ON "invoice_events" USING btree ("kind");
  CREATE INDEX IF NOT EXISTS "invoice_events_at_idx" ON "invoice_events" USING btree ("at");
  CREATE INDEX IF NOT EXISTS "invoice_events_send_id_idx" ON "invoice_events" USING btree ("send_id");
  CREATE INDEX IF NOT EXISTS "invoice_events_updated_at_idx" ON "invoice_events" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "invoice_events_created_at_idx" ON "invoice_events" USING btree ("created_at");
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invoice_events_fk" FOREIGN KEY ("invoice_events_id") REFERENCES "public"."invoice_events"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_invoice_events_id_idx" ON "payload_locked_documents_rels" USING btree ("invoice_events_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "invoice_events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "invoice_events" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_invoice_events_fk";
  
  DROP INDEX "payload_locked_documents_rels_invoice_events_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "invoice_events_id";
  DROP TYPE "public"."enum_invoice_events_kind";`)
}
