import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_job_roles_report_counts_proof" AS ENUM('none', 'words', 'link', 'file');
  CREATE TYPE "public"."enum_job_roles_report_counts_screenshot" AS ENUM('no', 'optional', 'required');
  CREATE TYPE "public"."enum_report_excusals_reason" AS ENUM('training', 'client', 'other');
  CREATE TYPE "public"."enum_report_excusals_status" AS ENUM('requested', 'approved', 'declined');
  CREATE TABLE "report_excusals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"reason" "enum_report_excusals_reason" NOT NULL,
  	"status" "enum_report_excusals_status" DEFAULT 'requested',
  	"note" varchar,
  	"decided_by_id" integer,
  	"decided_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "work_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"count" varchar NOT NULL,
  	"quantity" numeric DEFAULT 1,
  	"text" varchar,
  	"link" varchar,
  	"prefix" varchar DEFAULT 'work',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  ALTER TABLE "job_roles_report_counts" ADD COLUMN "proof" "enum_job_roles_report_counts_proof" DEFAULT 'none';
  ALTER TABLE "job_roles_report_counts" ADD COLUMN "proof_required" boolean DEFAULT true;
  ALTER TABLE "job_roles_report_counts" ADD COLUMN "screenshot" "enum_job_roles_report_counts_screenshot" DEFAULT 'no';
  ALTER TABLE "daily_reports" ADD COLUMN "checked_at" timestamp(3) with time zone;
  ALTER TABLE "daily_reports" ADD COLUMN "checked_by_id" integer;
  ALTER TABLE "_daily_reports_v" ADD COLUMN "version_checked_at" timestamp(3) with time zone;
  ALTER TABLE "_daily_reports_v" ADD COLUMN "version_checked_by_id" integer;
  ALTER TABLE "comments" ADD COLUMN "report_id" integer;
  ALTER TABLE "leads_activity" ADD COLUMN "proof_id" integer;
  ALTER TABLE "_leads_v_version_activity" ADD COLUMN "proof_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "report_excusals_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "work_items_id" integer;
  ALTER TABLE "report_excusals" ADD CONSTRAINT "report_excusals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "report_excusals" ADD CONSTRAINT "report_excusals_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "work_items" ADD CONSTRAINT "work_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "report_excusals_user_idx" ON "report_excusals" USING btree ("user_id");
  CREATE INDEX "report_excusals_date_idx" ON "report_excusals" USING btree ("date");
  CREATE INDEX "report_excusals_status_idx" ON "report_excusals" USING btree ("status");
  CREATE INDEX "report_excusals_decided_by_idx" ON "report_excusals" USING btree ("decided_by_id");
  CREATE INDEX "report_excusals_updated_at_idx" ON "report_excusals" USING btree ("updated_at");
  CREATE INDEX "report_excusals_created_at_idx" ON "report_excusals" USING btree ("created_at");
  CREATE INDEX "work_items_user_idx" ON "work_items" USING btree ("user_id");
  CREATE INDEX "work_items_date_idx" ON "work_items" USING btree ("date");
  CREATE INDEX "work_items_updated_at_idx" ON "work_items" USING btree ("updated_at");
  CREATE INDEX "work_items_created_at_idx" ON "work_items" USING btree ("created_at");
  CREATE UNIQUE INDEX "work_items_filename_idx" ON "work_items" USING btree ("filename");
  ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_checked_by_id_users_id_fk" FOREIGN KEY ("checked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_daily_reports_v" ADD CONSTRAINT "_daily_reports_v_version_checked_by_id_users_id_fk" FOREIGN KEY ("version_checked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_report_id_daily_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."daily_reports"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "leads_activity" ADD CONSTRAINT "leads_activity_proof_id_documents_id_fk" FOREIGN KEY ("proof_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_leads_v_version_activity" ADD CONSTRAINT "_leads_v_version_activity_proof_id_documents_id_fk" FOREIGN KEY ("proof_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_report_excusals_fk" FOREIGN KEY ("report_excusals_id") REFERENCES "public"."report_excusals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_work_items_fk" FOREIGN KEY ("work_items_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "daily_reports_checked_by_idx" ON "daily_reports" USING btree ("checked_by_id");
  CREATE INDEX "_daily_reports_v_version_version_checked_by_idx" ON "_daily_reports_v" USING btree ("version_checked_by_id");
  CREATE INDEX "comments_report_idx" ON "comments" USING btree ("report_id");
  CREATE INDEX "leads_activity_proof_idx" ON "leads_activity" USING btree ("proof_id");
  CREATE INDEX "_leads_v_version_activity_proof_idx" ON "_leads_v_version_activity" USING btree ("proof_id");
  CREATE INDEX "payload_locked_documents_rels_report_excusals_id_idx" ON "payload_locked_documents_rels" USING btree ("report_excusals_id");
  CREATE INDEX "payload_locked_documents_rels_work_items_id_idx" ON "payload_locked_documents_rels" USING btree ("work_items_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "report_excusals" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "work_items" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "report_excusals" CASCADE;
  DROP TABLE "work_items" CASCADE;
  ALTER TABLE "daily_reports" DROP CONSTRAINT "daily_reports_checked_by_id_users_id_fk";
  
  ALTER TABLE "_daily_reports_v" DROP CONSTRAINT "_daily_reports_v_version_checked_by_id_users_id_fk";
  
  ALTER TABLE "comments" DROP CONSTRAINT "comments_report_id_daily_reports_id_fk";
  
  ALTER TABLE "leads_activity" DROP CONSTRAINT "leads_activity_proof_id_documents_id_fk";
  
  ALTER TABLE "_leads_v_version_activity" DROP CONSTRAINT "_leads_v_version_activity_proof_id_documents_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_report_excusals_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_work_items_fk";
  
  DROP INDEX "daily_reports_checked_by_idx";
  DROP INDEX "_daily_reports_v_version_version_checked_by_idx";
  DROP INDEX "comments_report_idx";
  DROP INDEX "leads_activity_proof_idx";
  DROP INDEX "_leads_v_version_activity_proof_idx";
  DROP INDEX "payload_locked_documents_rels_report_excusals_id_idx";
  DROP INDEX "payload_locked_documents_rels_work_items_id_idx";
  ALTER TABLE "job_roles_report_counts" DROP COLUMN "proof";
  ALTER TABLE "job_roles_report_counts" DROP COLUMN "proof_required";
  ALTER TABLE "job_roles_report_counts" DROP COLUMN "screenshot";
  ALTER TABLE "daily_reports" DROP COLUMN "checked_at";
  ALTER TABLE "daily_reports" DROP COLUMN "checked_by_id";
  ALTER TABLE "_daily_reports_v" DROP COLUMN "version_checked_at";
  ALTER TABLE "_daily_reports_v" DROP COLUMN "version_checked_by_id";
  ALTER TABLE "comments" DROP COLUMN "report_id";
  ALTER TABLE "leads_activity" DROP COLUMN "proof_id";
  ALTER TABLE "_leads_v_version_activity" DROP COLUMN "proof_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "report_excusals_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "work_items_id";
  DROP TYPE "public"."enum_job_roles_report_counts_proof";
  DROP TYPE "public"."enum_job_roles_report_counts_screenshot";
  DROP TYPE "public"."enum_report_excusals_reason";
  DROP TYPE "public"."enum_report_excusals_status";`)
}
