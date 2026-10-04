import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "audit_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"action" varchar NOT NULL,
  	"summary" varchar NOT NULL,
  	"actor_id" integer,
  	"person_id" integer,
  	"subject_type" varchar,
  	"subject_id" varchar,
  	"reason" varchar,
  	"changes" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "leads" ADD COLUMN "updated_by_id" integer;
  ALTER TABLE "_leads_v" ADD COLUMN "version_updated_by_id" integer;
  ALTER TABLE "clients" ADD COLUMN "updated_by_id" integer;
  ALTER TABLE "_clients_v" ADD COLUMN "version_updated_by_id" integer;
  ALTER TABLE "proposals" ADD COLUMN "updated_by_id" integer;
  ALTER TABLE "invoices" ADD COLUMN "updated_by_id" integer;
  ALTER TABLE "_invoices_v" ADD COLUMN "version_updated_by_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "audit_log_id" integer;
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_person_id_users_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");
  CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");
  CREATE INDEX "audit_log_person_idx" ON "audit_log" USING btree ("person_id");
  CREATE INDEX "audit_log_subject_type_idx" ON "audit_log" USING btree ("subject_type");
  CREATE INDEX "audit_log_subject_id_idx" ON "audit_log" USING btree ("subject_id");
  CREATE INDEX "audit_log_updated_at_idx" ON "audit_log" USING btree ("updated_at");
  CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");
  ALTER TABLE "leads" ADD CONSTRAINT "leads_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_leads_v" ADD CONSTRAINT "_leads_v_version_updated_by_id_users_id_fk" FOREIGN KEY ("version_updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clients" ADD CONSTRAINT "clients_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_clients_v" ADD CONSTRAINT "_clients_v_version_updated_by_id_users_id_fk" FOREIGN KEY ("version_updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "proposals" ADD CONSTRAINT "proposals_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_invoices_v" ADD CONSTRAINT "_invoices_v_version_updated_by_id_users_id_fk" FOREIGN KEY ("version_updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_log_fk" FOREIGN KEY ("audit_log_id") REFERENCES "public"."audit_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "leads_updated_by_idx" ON "leads" USING btree ("updated_by_id");
  CREATE INDEX "_leads_v_version_version_updated_by_idx" ON "_leads_v" USING btree ("version_updated_by_id");
  CREATE INDEX "clients_updated_by_idx" ON "clients" USING btree ("updated_by_id");
  CREATE INDEX "_clients_v_version_version_updated_by_idx" ON "_clients_v" USING btree ("version_updated_by_id");
  CREATE INDEX "proposals_updated_by_idx" ON "proposals" USING btree ("updated_by_id");
  CREATE INDEX "invoices_updated_by_idx" ON "invoices" USING btree ("updated_by_id");
  CREATE INDEX "_invoices_v_version_version_updated_by_idx" ON "_invoices_v" USING btree ("version_updated_by_id");
  CREATE INDEX "payload_locked_documents_rels_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_log_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "audit_log" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "audit_log" CASCADE;
  ALTER TABLE "leads" DROP CONSTRAINT "leads_updated_by_id_users_id_fk";
  
  ALTER TABLE "_leads_v" DROP CONSTRAINT "_leads_v_version_updated_by_id_users_id_fk";
  
  ALTER TABLE "clients" DROP CONSTRAINT "clients_updated_by_id_users_id_fk";
  
  ALTER TABLE "_clients_v" DROP CONSTRAINT "_clients_v_version_updated_by_id_users_id_fk";
  
  ALTER TABLE "proposals" DROP CONSTRAINT "proposals_updated_by_id_users_id_fk";
  
  ALTER TABLE "invoices" DROP CONSTRAINT "invoices_updated_by_id_users_id_fk";
  
  ALTER TABLE "_invoices_v" DROP CONSTRAINT "_invoices_v_version_updated_by_id_users_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_audit_log_fk";
  
  DROP INDEX "leads_updated_by_idx";
  DROP INDEX "_leads_v_version_version_updated_by_idx";
  DROP INDEX "clients_updated_by_idx";
  DROP INDEX "_clients_v_version_version_updated_by_idx";
  DROP INDEX "proposals_updated_by_idx";
  DROP INDEX "invoices_updated_by_idx";
  DROP INDEX "_invoices_v_version_version_updated_by_idx";
  DROP INDEX "payload_locked_documents_rels_audit_log_id_idx";
  ALTER TABLE "leads" DROP COLUMN "updated_by_id";
  ALTER TABLE "_leads_v" DROP COLUMN "version_updated_by_id";
  ALTER TABLE "clients" DROP COLUMN "updated_by_id";
  ALTER TABLE "_clients_v" DROP COLUMN "version_updated_by_id";
  ALTER TABLE "proposals" DROP COLUMN "updated_by_id";
  ALTER TABLE "invoices" DROP COLUMN "updated_by_id";
  ALTER TABLE "_invoices_v" DROP COLUMN "version_updated_by_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "audit_log_id";`)
}
