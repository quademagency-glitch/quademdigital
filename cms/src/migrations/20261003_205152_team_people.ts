import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_status_log_status" AS ENUM('invited', 'active', 'on-leave', 'on-notice', 'ended');
  CREATE TYPE "public"."enum_users_status" AS ENUM('invited', 'active', 'on-leave', 'on-notice', 'ended');
  CREATE TYPE "public"."enum_users_currency" AS ENUM('GHS', 'NGN', 'USD', 'KES', 'ZAR', 'GBP', 'EUR');
  CREATE TYPE "public"."enum_users_look" AS ENUM('system', 'paper', 'night');
  CREATE TYPE "public"."enum_job_roles_report_counts_source" AS ENUM('typed', 'researched', 'firstMessages', 'followUps', 'replies');
  CREATE TYPE "public"."enum_terms_templates_currency" AS ENUM('GHS', 'NGN', 'USD', 'KES', 'ZAR', 'GBP', 'EUR');
  CREATE TYPE "public"."enum_member_terms_currency" AS ENUM('GHS', 'NGN', 'USD', 'KES', 'ZAR', 'GBP', 'EUR');
  CREATE TABLE "users_status_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"status" "enum_users_status_log_status",
  	"from" timestamp(3) with time zone,
  	"reason" varchar,
  	"by_id" integer,
  	"at" timestamp(3) with time zone
  );
  
  CREATE TABLE "job_roles_report_counts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"source" "enum_job_roles_report_counts_source" DEFAULT 'typed' NOT NULL,
  	"target" numeric,
  	"amber_from" numeric
  );
  
  CREATE TABLE "job_roles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"active" boolean DEFAULT true,
  	"modules_pipeline" boolean DEFAULT false,
  	"modules_quote_requests" boolean DEFAULT false,
  	"modules_commission" boolean DEFAULT false,
  	"modules_data_allowance" boolean DEFAULT false,
  	"modules_client_projects" boolean DEFAULT false,
  	"default_terms_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "terms_templates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"notes" varchar,
  	"currency" "enum_terms_templates_currency",
  	"commission_share" varchar,
  	"commission_retainer_from_month" numeric,
  	"commission_retainer_rate" varchar,
  	"commission_after_salary_rate" varchar,
  	"salary_trigger_monthly_g_h_s_minor" numeric,
  	"salary_trigger_months" numeric,
  	"salary_amount_minor" numeric,
  	"salary_yearly_raise_percent" numeric,
  	"founding_partner_total_g_h_s_minor" numeric,
  	"founding_partner_retainer_g_h_s_minor" numeric,
  	"founding_partner_within_months" numeric,
  	"data_allowance_amount_minor" numeric,
  	"data_allowance_reports_needed" numeric,
  	"targets_counted_deals_per_month" numeric,
  	"missed_months_grace_months" numeric,
  	"missed_months_meeting_at" numeric,
  	"missed_months_end_at" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "member_terms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"effective_from" timestamp(3) with time zone NOT NULL,
  	"reason" varchar NOT NULL,
  	"template_id" integer,
  	"changed_by_id" integer,
  	"currency" "enum_member_terms_currency",
  	"commission_share" varchar,
  	"commission_retainer_from_month" numeric,
  	"commission_retainer_rate" varchar,
  	"commission_after_salary_rate" varchar,
  	"salary_trigger_monthly_g_h_s_minor" numeric,
  	"salary_trigger_months" numeric,
  	"salary_amount_minor" numeric,
  	"salary_yearly_raise_percent" numeric,
  	"founding_partner_total_g_h_s_minor" numeric,
  	"founding_partner_retainer_g_h_s_minor" numeric,
  	"founding_partner_within_months" numeric,
  	"data_allowance_amount_minor" numeric,
  	"data_allowance_reports_needed" numeric,
  	"targets_counted_deals_per_month" numeric,
  	"missed_months_grace_months" numeric,
  	"missed_months_meeting_at" numeric,
  	"missed_months_end_at" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "job_role_id" integer;
  ALTER TABLE "users" ADD COLUMN "job_title" varchar;
  ALTER TABLE "users" ADD COLUMN "status" "enum_users_status";
  ALTER TABLE "users" ADD COLUMN "status_since" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "status_reason" varchar;
  ALTER TABLE "users" ADD COLUMN "is_manager" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "manager_id" integer;
  ALTER TABLE "users" ADD COLUMN "start_date" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "trial_ends_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "ended_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "agreement_ref" varchar;
  ALTER TABLE "users" ADD COLUMN "country" varchar;
  ALTER TABLE "users" ADD COLUMN "currency" "enum_users_currency";
  ALTER TABLE "users" ADD COLUMN "phone" varchar;
  ALTER TABLE "users" ADD COLUMN "greytag" varchar;
  ALTER TABLE "users" ADD COLUMN "city" varchar;
  ALTER TABLE "users" ADD COLUMN "emergency_contact_name" varchar;
  ALTER TABLE "users" ADD COLUMN "emergency_contact_phone" varchar;
  ALTER TABLE "users" ADD COLUMN "emergency_contact_relationship" varchar;
  ALTER TABLE "users" ADD COLUMN "look" "enum_users_look" DEFAULT 'system';
  ALTER TABLE "users" ADD COLUMN "client_work_confirmed_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "salary_start_date" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "job_roles_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "terms_templates_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "member_terms_id" integer;
  ALTER TABLE "users_status_log" ADD CONSTRAINT "users_status_log_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_status_log" ADD CONSTRAINT "users_status_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "job_roles_report_counts" ADD CONSTRAINT "job_roles_report_counts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."job_roles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "job_roles" ADD CONSTRAINT "job_roles_default_terms_id_terms_templates_id_fk" FOREIGN KEY ("default_terms_id") REFERENCES "public"."terms_templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_terms" ADD CONSTRAINT "member_terms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_terms" ADD CONSTRAINT "member_terms_template_id_terms_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."terms_templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_terms" ADD CONSTRAINT "member_terms_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_status_log_order_idx" ON "users_status_log" USING btree ("_order");
  CREATE INDEX "users_status_log_parent_id_idx" ON "users_status_log" USING btree ("_parent_id");
  CREATE INDEX "users_status_log_by_idx" ON "users_status_log" USING btree ("by_id");
  CREATE INDEX "job_roles_report_counts_order_idx" ON "job_roles_report_counts" USING btree ("_order");
  CREATE INDEX "job_roles_report_counts_parent_id_idx" ON "job_roles_report_counts" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "job_roles_name_idx" ON "job_roles" USING btree ("name");
  CREATE INDEX "job_roles_default_terms_idx" ON "job_roles" USING btree ("default_terms_id");
  CREATE INDEX "job_roles_updated_at_idx" ON "job_roles" USING btree ("updated_at");
  CREATE INDEX "job_roles_created_at_idx" ON "job_roles" USING btree ("created_at");
  CREATE UNIQUE INDEX "terms_templates_name_idx" ON "terms_templates" USING btree ("name");
  CREATE INDEX "terms_templates_updated_at_idx" ON "terms_templates" USING btree ("updated_at");
  CREATE INDEX "terms_templates_created_at_idx" ON "terms_templates" USING btree ("created_at");
  CREATE INDEX "member_terms_user_idx" ON "member_terms" USING btree ("user_id");
  CREATE INDEX "member_terms_effective_from_idx" ON "member_terms" USING btree ("effective_from");
  CREATE INDEX "member_terms_template_idx" ON "member_terms" USING btree ("template_id");
  CREATE INDEX "member_terms_changed_by_idx" ON "member_terms" USING btree ("changed_by_id");
  CREATE INDEX "member_terms_updated_at_idx" ON "member_terms" USING btree ("updated_at");
  CREATE INDEX "member_terms_created_at_idx" ON "member_terms" USING btree ("created_at");
  ALTER TABLE "users" ADD CONSTRAINT "users_job_role_id_job_roles_id_fk" FOREIGN KEY ("job_role_id") REFERENCES "public"."job_roles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_job_roles_fk" FOREIGN KEY ("job_roles_id") REFERENCES "public"."job_roles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_terms_templates_fk" FOREIGN KEY ("terms_templates_id") REFERENCES "public"."terms_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_member_terms_fk" FOREIGN KEY ("member_terms_id") REFERENCES "public"."member_terms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_job_role_idx" ON "users" USING btree ("job_role_id");
  CREATE INDEX "users_status_idx" ON "users" USING btree ("status");
  CREATE INDEX "users_manager_idx" ON "users" USING btree ("manager_id");
  CREATE INDEX "payload_locked_documents_rels_job_roles_id_idx" ON "payload_locked_documents_rels" USING btree ("job_roles_id");
  CREATE INDEX "payload_locked_documents_rels_terms_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("terms_templates_id");
  CREATE INDEX "payload_locked_documents_rels_member_terms_id_idx" ON "payload_locked_documents_rels" USING btree ("member_terms_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_status_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "job_roles_report_counts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "job_roles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "terms_templates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "member_terms" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "users_status_log" CASCADE;
  DROP TABLE "job_roles_report_counts" CASCADE;
  DROP TABLE "job_roles" CASCADE;
  DROP TABLE "terms_templates" CASCADE;
  DROP TABLE "member_terms" CASCADE;
  ALTER TABLE "users" DROP CONSTRAINT "users_job_role_id_job_roles_id_fk";
  
  ALTER TABLE "users" DROP CONSTRAINT "users_manager_id_users_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_job_roles_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_terms_templates_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_member_terms_fk";
  
  DROP INDEX "users_job_role_idx";
  DROP INDEX "users_status_idx";
  DROP INDEX "users_manager_idx";
  DROP INDEX "payload_locked_documents_rels_job_roles_id_idx";
  DROP INDEX "payload_locked_documents_rels_terms_templates_id_idx";
  DROP INDEX "payload_locked_documents_rels_member_terms_id_idx";
  ALTER TABLE "users" DROP COLUMN "job_role_id";
  ALTER TABLE "users" DROP COLUMN "job_title";
  ALTER TABLE "users" DROP COLUMN "status";
  ALTER TABLE "users" DROP COLUMN "status_since";
  ALTER TABLE "users" DROP COLUMN "status_reason";
  ALTER TABLE "users" DROP COLUMN "is_manager";
  ALTER TABLE "users" DROP COLUMN "manager_id";
  ALTER TABLE "users" DROP COLUMN "start_date";
  ALTER TABLE "users" DROP COLUMN "trial_ends_at";
  ALTER TABLE "users" DROP COLUMN "ended_at";
  ALTER TABLE "users" DROP COLUMN "agreement_ref";
  ALTER TABLE "users" DROP COLUMN "country";
  ALTER TABLE "users" DROP COLUMN "currency";
  ALTER TABLE "users" DROP COLUMN "phone";
  ALTER TABLE "users" DROP COLUMN "greytag";
  ALTER TABLE "users" DROP COLUMN "city";
  ALTER TABLE "users" DROP COLUMN "emergency_contact_name";
  ALTER TABLE "users" DROP COLUMN "emergency_contact_phone";
  ALTER TABLE "users" DROP COLUMN "emergency_contact_relationship";
  ALTER TABLE "users" DROP COLUMN "look";
  ALTER TABLE "users" DROP COLUMN "client_work_confirmed_at";
  ALTER TABLE "users" DROP COLUMN "salary_start_date";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "job_roles_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "terms_templates_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "member_terms_id";
  DROP TYPE "public"."enum_users_status_log_status";
  DROP TYPE "public"."enum_users_status";
  DROP TYPE "public"."enum_users_currency";
  DROP TYPE "public"."enum_users_look";
  DROP TYPE "public"."enum_job_roles_report_counts_source";
  DROP TYPE "public"."enum_terms_templates_currency";
  DROP TYPE "public"."enum_member_terms_currency";`)
}
