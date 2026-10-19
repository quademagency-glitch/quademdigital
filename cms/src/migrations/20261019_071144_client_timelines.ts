import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
  Client timelines made and emailed by themselves (lib/clientTimeline.ts):
  the clients.timelineEmails switch, the timeline-emails record of each email,
  and the daily job's slug in the jobs enums.

  The switch defaults to on for clients made from now on. Clients that exist
  when this runs are switched off, so the release emails nobody unannounced:
  Ernest turns them on one by one from the client's page. That update runs
  only in the step that adds the column, so running this again never switches
  off a client he has since turned on.
*/
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
    CREATE TYPE "public"."enum_timeline_emails_kind" AS ENUM('plan', 'update');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE IF NOT EXISTS 'clientTimelineEmails' BEFORE 'schedulePublish';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE IF NOT EXISTS 'clientTimelineEmails' BEFORE 'schedulePublish';
  CREATE TABLE IF NOT EXISTS "timeline_emails" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"client_id" integer NOT NULL,
  	"kind" "enum_timeline_emails_kind" NOT NULL,
  	"sent_at" timestamp(3) with time zone NOT NULL,
  	"to" varchar,
  	"subject" varchar,
  	"summary" varchar,
  	"snapshot" jsonb,
  	"send_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'timeline_emails') THEN
      ALTER TABLE "clients" ADD COLUMN "timeline_emails" boolean DEFAULT true;
      UPDATE "clients" SET "timeline_emails" = false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '_clients_v' AND column_name = 'version_timeline_emails') THEN
      ALTER TABLE "_clients_v" ADD COLUMN "version_timeline_emails" boolean DEFAULT true;
      UPDATE "_clients_v" SET "version_timeline_emails" = false;
    END IF;
  END $$;

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "timeline_emails_id" integer;
  DO $$ BEGIN
    ALTER TABLE "timeline_emails" ADD CONSTRAINT "timeline_emails_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  CREATE INDEX IF NOT EXISTS "timeline_emails_client_idx" ON "timeline_emails" USING btree ("client_id");
  CREATE INDEX IF NOT EXISTS "timeline_emails_sent_at_idx" ON "timeline_emails" USING btree ("sent_at");
  CREATE INDEX IF NOT EXISTS "timeline_emails_updated_at_idx" ON "timeline_emails" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "timeline_emails_created_at_idx" ON "timeline_emails" USING btree ("created_at");
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_timeline_emails_fk" FOREIGN KEY ("timeline_emails_id") REFERENCES "public"."timeline_emails"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_timeline_emails_id_idx" ON "payload_locked_documents_rels" USING btree ("timeline_emails_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "timeline_emails" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "timeline_emails" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_timeline_emails_fk";

  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'operationsHealth', 'clientOnboarding', 'teamReminders', 'recordInvoicePayment', 'signingRounds', 'sendAgreementForSigning', 'paymentReceipt', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'operationsHealth', 'clientOnboarding', 'teamReminders', 'recordInvoicePayment', 'signingRounds', 'sendAgreementForSigning', 'paymentReceipt', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "payload_locked_documents_rels_timeline_emails_id_idx";
  ALTER TABLE "clients" DROP COLUMN "timeline_emails";
  ALTER TABLE "_clients_v" DROP COLUMN "version_timeline_emails";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "timeline_emails_id";
  DROP TYPE "public"."enum_timeline_emails_kind";`)
}
