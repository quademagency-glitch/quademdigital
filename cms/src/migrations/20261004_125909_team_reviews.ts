import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_monthly_reviews_training_progress" AS ENUM('not-started', 'in-progress', 'done');
  CREATE TYPE "public"."enum_monthly_reviews_status" AS ENUM('open', 'agreed');
  CREATE TYPE "public"."enum_monthly_reviews_missed_level" AS ENUM('none', 'meeting', 'end');
  CREATE TYPE "public"."enum_monthly_reviews_ready_for_trial" AS ENUM('not-yet', 'yes');
  CREATE TYPE "public"."enum_warnings_kind" AS ENUM('warning', 'notice', 'missed-meeting', 'missed-end');
  CREATE TYPE "public"."enum_appraisals_status" AS ENUM('self', 'review', 'done');
  CREATE TYPE "public"."enum_appraisals_outcome" AS ENUM('satisfactory', 'needs-improvement', 'unsatisfactory');
  CREATE TYPE "public"."enum_goals_status" AS ENUM('open', 'done', 'missed', 'dropped');
  CREATE TABLE "job_roles_training_areas" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL
  );
  
  CREATE TABLE "monthly_reviews_training" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"area" varchar NOT NULL,
  	"progress" "enum_monthly_reviews_training_progress",
  	"note" varchar
  );
  
  CREATE TABLE "monthly_reviews" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"member_id" integer NOT NULL,
  	"month" varchar NOT NULL,
  	"month_number" numeric,
  	"status" "enum_monthly_reviews_status" DEFAULT 'open',
  	"figures_working_days" numeric,
  	"figures_days_off" numeric,
  	"figures_reports_sent" numeric,
  	"figures_reports_on_time" numeric,
  	"figures_researched" numeric,
  	"figures_first_messages" numeric,
  	"figures_follow_ups" numeric,
  	"figures_replies" numeric,
  	"figures_proposals_sent" numeric,
  	"figures_counted_sourced" numeric,
  	"figures_counted_handed" numeric,
  	"figures_commission_g_h_s_minor" numeric,
  	"figures_currency" varchar,
  	"figures_fx_rate" numeric,
  	"figures_commission_local_minor" numeric,
  	"missed_counter" numeric,
  	"missed_level" "enum_monthly_reviews_missed_level",
  	"missed_note" varchar,
  	"what_worked" varchar,
  	"got_in_the_way" varchar,
  	"changes_next_month" varchar,
  	"ready_for_trial" "enum_monthly_reviews_ready_for_trial",
  	"member_agreed_at" timestamp(3) with time zone,
  	"admin_agreed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "warnings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"member_id" integer NOT NULL,
  	"kind" "enum_warnings_kind" DEFAULT 'warning' NOT NULL,
  	"date" timestamp(3) with time zone,
  	"reason" varchar NOT NULL,
  	"detail" varchar,
  	"issued_by_id" integer,
  	"review_id" integer,
  	"read_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "appraisals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"member_id" integer NOT NULL,
  	"period" varchar,
  	"due_date" timestamp(3) with time zone,
  	"status" "enum_appraisals_status" DEFAULT 'self',
  	"self_assessment" varchar,
  	"self_sent_at" timestamp(3) with time zone,
  	"admin_assessment" varchar,
  	"outcome" "enum_appraisals_outcome",
  	"raise_percent" numeric,
  	"raise_from" timestamp(3) with time zone,
  	"closed_at" timestamp(3) with time zone,
  	"terms_created_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "goals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"member_id" integer NOT NULL,
  	"due_date" timestamp(3) with time zone,
  	"status" "enum_goals_status" DEFAULT 'open',
  	"target" numeric,
  	"progress" numeric DEFAULT 0,
  	"unit" varchar,
  	"set_by_id" integer,
  	"note" varchar,
  	"closed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "monthly_reviews_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "warnings_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "appraisals_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "goals_id" integer;
  ALTER TABLE "job_roles_training_areas" ADD CONSTRAINT "job_roles_training_areas_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."job_roles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "monthly_reviews_training" ADD CONSTRAINT "monthly_reviews_training_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."monthly_reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "monthly_reviews" ADD CONSTRAINT "monthly_reviews_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "warnings" ADD CONSTRAINT "warnings_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "warnings" ADD CONSTRAINT "warnings_issued_by_id_users_id_fk" FOREIGN KEY ("issued_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "warnings" ADD CONSTRAINT "warnings_review_id_monthly_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."monthly_reviews"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_terms_created_id_member_terms_id_fk" FOREIGN KEY ("terms_created_id") REFERENCES "public"."member_terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "goals" ADD CONSTRAINT "goals_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "goals" ADD CONSTRAINT "goals_set_by_id_users_id_fk" FOREIGN KEY ("set_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "job_roles_training_areas_order_idx" ON "job_roles_training_areas" USING btree ("_order");
  CREATE INDEX "job_roles_training_areas_parent_id_idx" ON "job_roles_training_areas" USING btree ("_parent_id");
  CREATE INDEX "monthly_reviews_training_order_idx" ON "monthly_reviews_training" USING btree ("_order");
  CREATE INDEX "monthly_reviews_training_parent_id_idx" ON "monthly_reviews_training" USING btree ("_parent_id");
  CREATE INDEX "monthly_reviews_member_idx" ON "monthly_reviews" USING btree ("member_id");
  CREATE INDEX "monthly_reviews_month_idx" ON "monthly_reviews" USING btree ("month");
  CREATE INDEX "monthly_reviews_status_idx" ON "monthly_reviews" USING btree ("status");
  CREATE INDEX "monthly_reviews_updated_at_idx" ON "monthly_reviews" USING btree ("updated_at");
  CREATE INDEX "monthly_reviews_created_at_idx" ON "monthly_reviews" USING btree ("created_at");
  CREATE INDEX "warnings_member_idx" ON "warnings" USING btree ("member_id");
  CREATE INDEX "warnings_date_idx" ON "warnings" USING btree ("date");
  CREATE INDEX "warnings_issued_by_idx" ON "warnings" USING btree ("issued_by_id");
  CREATE INDEX "warnings_review_idx" ON "warnings" USING btree ("review_id");
  CREATE INDEX "warnings_updated_at_idx" ON "warnings" USING btree ("updated_at");
  CREATE INDEX "warnings_created_at_idx" ON "warnings" USING btree ("created_at");
  CREATE INDEX "appraisals_member_idx" ON "appraisals" USING btree ("member_id");
  CREATE INDEX "appraisals_status_idx" ON "appraisals" USING btree ("status");
  CREATE INDEX "appraisals_terms_created_idx" ON "appraisals" USING btree ("terms_created_id");
  CREATE INDEX "appraisals_updated_at_idx" ON "appraisals" USING btree ("updated_at");
  CREATE INDEX "appraisals_created_at_idx" ON "appraisals" USING btree ("created_at");
  CREATE INDEX "goals_member_idx" ON "goals" USING btree ("member_id");
  CREATE INDEX "goals_due_date_idx" ON "goals" USING btree ("due_date");
  CREATE INDEX "goals_status_idx" ON "goals" USING btree ("status");
  CREATE INDEX "goals_set_by_idx" ON "goals" USING btree ("set_by_id");
  CREATE INDEX "goals_updated_at_idx" ON "goals" USING btree ("updated_at");
  CREATE INDEX "goals_created_at_idx" ON "goals" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_monthly_reviews_fk" FOREIGN KEY ("monthly_reviews_id") REFERENCES "public"."monthly_reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_warnings_fk" FOREIGN KEY ("warnings_id") REFERENCES "public"."warnings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_appraisals_fk" FOREIGN KEY ("appraisals_id") REFERENCES "public"."appraisals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_goals_fk" FOREIGN KEY ("goals_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_monthly_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("monthly_reviews_id");
  CREATE INDEX "payload_locked_documents_rels_warnings_id_idx" ON "payload_locked_documents_rels" USING btree ("warnings_id");
  CREATE INDEX "payload_locked_documents_rels_appraisals_id_idx" ON "payload_locked_documents_rels" USING btree ("appraisals_id");
  CREATE INDEX "payload_locked_documents_rels_goals_id_idx" ON "payload_locked_documents_rels" USING btree ("goals_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "job_roles_training_areas" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "monthly_reviews_training" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "monthly_reviews" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "warnings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "appraisals" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "goals" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "job_roles_training_areas" CASCADE;
  DROP TABLE "monthly_reviews_training" CASCADE;
  DROP TABLE "monthly_reviews" CASCADE;
  DROP TABLE "warnings" CASCADE;
  DROP TABLE "appraisals" CASCADE;
  DROP TABLE "goals" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_monthly_reviews_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_warnings_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_appraisals_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_goals_fk";
  
  DROP INDEX "payload_locked_documents_rels_monthly_reviews_id_idx";
  DROP INDEX "payload_locked_documents_rels_warnings_id_idx";
  DROP INDEX "payload_locked_documents_rels_appraisals_id_idx";
  DROP INDEX "payload_locked_documents_rels_goals_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "monthly_reviews_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "warnings_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "appraisals_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "goals_id";
  DROP TYPE "public"."enum_monthly_reviews_training_progress";
  DROP TYPE "public"."enum_monthly_reviews_status";
  DROP TYPE "public"."enum_monthly_reviews_missed_level";
  DROP TYPE "public"."enum_monthly_reviews_ready_for_trial";
  DROP TYPE "public"."enum_warnings_kind";
  DROP TYPE "public"."enum_appraisals_status";
  DROP TYPE "public"."enum_appraisals_outcome";
  DROP TYPE "public"."enum_goals_status";`)
}
