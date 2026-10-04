import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_openings_status" AS ENUM('draft', 'open', 'closed');
  CREATE TYPE "public"."enum_applicants_notes_stage" AS ENUM('applied', 'screened', 'interview', 'trial', 'offer', 'hired', 'not-hired');
  CREATE TYPE "public"."enum_applicants_stage" AS ENUM('applied', 'screened', 'interview', 'trial', 'offer', 'hired', 'not-hired');
  CREATE TYPE "public"."enum_applicants_heard_from" AS ENUM('website', 'linkedin', 'whatsapp', 'instagram', 'x', 'referral', 'job-board', 'other');
  ALTER TYPE "public"."enum_documents_kind" ADD VALUE 'applicant';
  ALTER TYPE "public"."enum_documents_category" ADD VALUE 'cv' BEFORE 'other';
  CREATE TABLE "openings_questions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"required" boolean DEFAULT false
  );
  
  CREATE TABLE "openings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"status" "enum_openings_status" DEFAULT 'draft' NOT NULL,
  	"slug" varchar,
  	"closes_at" timestamp(3) with time zone,
  	"job_role_id" integer,
  	"location" varchar,
  	"country" varchar,
  	"summary" varchar,
  	"description" varchar,
  	"cv_required" boolean DEFAULT true,
  	"terms_template_id" integer,
  	"opened_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "applicants_answers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "applicants_portfolio" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar
  );
  
  CREATE TABLE "applicants_notes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"stage" "enum_applicants_notes_stage",
  	"score" numeric,
  	"text" varchar,
  	"by_id" integer,
  	"at" timestamp(3) with time zone
  );
  
  CREATE TABLE "applicants_interviews" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"at" timestamp(3) with time zone,
  	"minutes" numeric,
  	"meet_link" varchar,
  	"invited_at" timestamp(3) with time zone,
  	"by_id" integer
  );
  
  CREATE TABLE "applicants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"phone" varchar,
  	"opening_id" integer NOT NULL,
  	"country" varchar,
  	"city" varchar,
  	"stage" "enum_applicants_stage" DEFAULT 'applied' NOT NULL,
  	"stage_since" timestamp(3) with time zone,
  	"hired_as_id" integer,
  	"heard_from" "enum_applicants_heard_from",
  	"heard_from_note" varchar,
  	"offer_terms_template_id" integer,
  	"offer_start_date" timestamp(3) with time zone,
  	"offer_sent_at" timestamp(3) with time zone,
  	"not_hired_sent_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "job_roles" ADD COLUMN "offer_letter" varchar;
  ALTER TABLE "documents" ADD COLUMN "applicant_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "openings_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "applicants_id" integer;
  ALTER TABLE "ops_settings" ADD COLUMN "hiring_meet_link" varchar;
  ALTER TABLE "ops_settings" ADD COLUMN "hiring_not_hired_subject" varchar DEFAULT 'Your application to Quadem: {title}';
  ALTER TABLE "ops_settings" ADD COLUMN "hiring_not_hired_body" varchar DEFAULT 'Dear {firstName},
  
  Thank you for applying to be our {title}, and for the time you gave it.
  
  We have decided not to go ahead with your application this time. It was not an easy choice, and it is no reflection on you as a person.
  
  We will keep your details, and if a role opens that suits you better we may get in touch. We wish you every success.
  
  Kind regards,
  Ernest
  Quadem Digital';
  ALTER TABLE "_ops_settings_v" ADD COLUMN "version_hiring_meet_link" varchar;
  ALTER TABLE "_ops_settings_v" ADD COLUMN "version_hiring_not_hired_subject" varchar DEFAULT 'Your application to Quadem: {title}';
  ALTER TABLE "_ops_settings_v" ADD COLUMN "version_hiring_not_hired_body" varchar DEFAULT 'Dear {firstName},
  
  Thank you for applying to be our {title}, and for the time you gave it.
  
  We have decided not to go ahead with your application this time. It was not an easy choice, and it is no reflection on you as a person.
  
  We will keep your details, and if a role opens that suits you better we may get in touch. We wish you every success.
  
  Kind regards,
  Ernest
  Quadem Digital';
  ALTER TABLE "openings_questions" ADD CONSTRAINT "openings_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."openings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "openings" ADD CONSTRAINT "openings_job_role_id_job_roles_id_fk" FOREIGN KEY ("job_role_id") REFERENCES "public"."job_roles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "openings" ADD CONSTRAINT "openings_terms_template_id_terms_templates_id_fk" FOREIGN KEY ("terms_template_id") REFERENCES "public"."terms_templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "applicants_answers" ADD CONSTRAINT "applicants_answers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."applicants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "applicants_portfolio" ADD CONSTRAINT "applicants_portfolio_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."applicants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "applicants_notes" ADD CONSTRAINT "applicants_notes_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "applicants_notes" ADD CONSTRAINT "applicants_notes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."applicants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "applicants_interviews" ADD CONSTRAINT "applicants_interviews_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "applicants_interviews" ADD CONSTRAINT "applicants_interviews_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."applicants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "applicants" ADD CONSTRAINT "applicants_opening_id_openings_id_fk" FOREIGN KEY ("opening_id") REFERENCES "public"."openings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "applicants" ADD CONSTRAINT "applicants_hired_as_id_users_id_fk" FOREIGN KEY ("hired_as_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "applicants" ADD CONSTRAINT "applicants_offer_terms_template_id_terms_templates_id_fk" FOREIGN KEY ("offer_terms_template_id") REFERENCES "public"."terms_templates"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "openings_questions_order_idx" ON "openings_questions" USING btree ("_order");
  CREATE INDEX "openings_questions_parent_id_idx" ON "openings_questions" USING btree ("_parent_id");
  CREATE INDEX "openings_status_idx" ON "openings" USING btree ("status");
  CREATE UNIQUE INDEX "openings_slug_idx" ON "openings" USING btree ("slug");
  CREATE INDEX "openings_job_role_idx" ON "openings" USING btree ("job_role_id");
  CREATE INDEX "openings_terms_template_idx" ON "openings" USING btree ("terms_template_id");
  CREATE INDEX "openings_updated_at_idx" ON "openings" USING btree ("updated_at");
  CREATE INDEX "openings_created_at_idx" ON "openings" USING btree ("created_at");
  CREATE INDEX "applicants_answers_order_idx" ON "applicants_answers" USING btree ("_order");
  CREATE INDEX "applicants_answers_parent_id_idx" ON "applicants_answers" USING btree ("_parent_id");
  CREATE INDEX "applicants_portfolio_order_idx" ON "applicants_portfolio" USING btree ("_order");
  CREATE INDEX "applicants_portfolio_parent_id_idx" ON "applicants_portfolio" USING btree ("_parent_id");
  CREATE INDEX "applicants_notes_order_idx" ON "applicants_notes" USING btree ("_order");
  CREATE INDEX "applicants_notes_parent_id_idx" ON "applicants_notes" USING btree ("_parent_id");
  CREATE INDEX "applicants_notes_by_idx" ON "applicants_notes" USING btree ("by_id");
  CREATE INDEX "applicants_interviews_order_idx" ON "applicants_interviews" USING btree ("_order");
  CREATE INDEX "applicants_interviews_parent_id_idx" ON "applicants_interviews" USING btree ("_parent_id");
  CREATE INDEX "applicants_interviews_by_idx" ON "applicants_interviews" USING btree ("by_id");
  CREATE INDEX "applicants_email_idx" ON "applicants" USING btree ("email");
  CREATE INDEX "applicants_opening_idx" ON "applicants" USING btree ("opening_id");
  CREATE INDEX "applicants_stage_idx" ON "applicants" USING btree ("stage");
  CREATE INDEX "applicants_hired_as_idx" ON "applicants" USING btree ("hired_as_id");
  CREATE INDEX "applicants_offer_offer_terms_template_idx" ON "applicants" USING btree ("offer_terms_template_id");
  CREATE INDEX "applicants_updated_at_idx" ON "applicants" USING btree ("updated_at");
  CREATE INDEX "applicants_created_at_idx" ON "applicants" USING btree ("created_at");
  ALTER TABLE "documents" ADD CONSTRAINT "documents_applicant_id_applicants_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."applicants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_openings_fk" FOREIGN KEY ("openings_id") REFERENCES "public"."openings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_applicants_fk" FOREIGN KEY ("applicants_id") REFERENCES "public"."applicants"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "documents_applicant_idx" ON "documents" USING btree ("applicant_id");
  CREATE INDEX "payload_locked_documents_rels_openings_id_idx" ON "payload_locked_documents_rels" USING btree ("openings_id");
  CREATE INDEX "payload_locked_documents_rels_applicants_id_idx" ON "payload_locked_documents_rels" USING btree ("applicants_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "openings_questions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "openings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "applicants_answers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "applicants_portfolio" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "applicants_notes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "applicants_interviews" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "applicants" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "openings_questions" CASCADE;
  DROP TABLE "openings" CASCADE;
  DROP TABLE "applicants_answers" CASCADE;
  DROP TABLE "applicants_portfolio" CASCADE;
  DROP TABLE "applicants_notes" CASCADE;
  DROP TABLE "applicants_interviews" CASCADE;
  DROP TABLE "applicants" CASCADE;
  ALTER TABLE "documents" DROP CONSTRAINT "documents_applicant_id_applicants_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_openings_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_applicants_fk";
  
  ALTER TABLE "documents" ALTER COLUMN "kind" SET DATA TYPE text;
  ALTER TABLE "documents" ALTER COLUMN "kind" SET DEFAULT 'library'::text;
  DROP TYPE "public"."enum_documents_kind";
  CREATE TYPE "public"."enum_documents_kind" AS ENUM('library', 'personal', 'record');
  ALTER TABLE "documents" ALTER COLUMN "kind" SET DEFAULT 'library'::"public"."enum_documents_kind";
  ALTER TABLE "documents" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_documents_kind" USING "kind"::"public"."enum_documents_kind";
  ALTER TABLE "documents" ALTER COLUMN "category" SET DATA TYPE text;
  DROP TYPE "public"."enum_documents_category";
  CREATE TYPE "public"."enum_documents_category" AS ENUM('handbook', 'price-sheet', 'script', 'pitch-example', 'brand', 'training', 'agreement', 'policy', 'cost-sheet', 'receipt', 'other');
  ALTER TABLE "documents" ALTER COLUMN "category" SET DATA TYPE "public"."enum_documents_category" USING "category"::"public"."enum_documents_category";
  DROP INDEX "documents_applicant_idx";
  DROP INDEX "payload_locked_documents_rels_openings_id_idx";
  DROP INDEX "payload_locked_documents_rels_applicants_id_idx";
  ALTER TABLE "job_roles" DROP COLUMN "offer_letter";
  ALTER TABLE "documents" DROP COLUMN "applicant_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "openings_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "applicants_id";
  ALTER TABLE "ops_settings" DROP COLUMN "hiring_meet_link";
  ALTER TABLE "ops_settings" DROP COLUMN "hiring_not_hired_subject";
  ALTER TABLE "ops_settings" DROP COLUMN "hiring_not_hired_body";
  ALTER TABLE "_ops_settings_v" DROP COLUMN "version_hiring_meet_link";
  ALTER TABLE "_ops_settings_v" DROP COLUMN "version_hiring_not_hired_subject";
  ALTER TABLE "_ops_settings_v" DROP COLUMN "version_hiring_not_hired_body";
  DROP TYPE "public"."enum_openings_status";
  DROP TYPE "public"."enum_applicants_notes_stage";
  DROP TYPE "public"."enum_applicants_stage";
  DROP TYPE "public"."enum_applicants_heard_from";`)
}
