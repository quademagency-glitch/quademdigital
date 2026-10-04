import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "training_modules_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "training_modules_quiz_choices" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "training_modules_quiz" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" numeric
  );
  
  CREATE TABLE "training_modules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"job_role_id" integer NOT NULL,
  	"area" varchar NOT NULL,
  	"order" numeric DEFAULT 1,
  	"active" boolean DEFAULT true,
  	"summary" varchar,
  	"pass_mark" numeric DEFAULT 80,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "training_modules_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"documents_id" integer
  );
  
  CREATE TABLE "training_progress_ticked" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar NOT NULL,
  	"at" timestamp(3) with time zone
  );
  
  CREATE TABLE "training_progress" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"member_id" integer NOT NULL,
  	"module_id" integer NOT NULL,
  	"quiz_score" numeric,
  	"quiz_passed_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone,
  	"signed_off_at" timestamp(3) with time zone,
  	"signed_off_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "training_modules_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "training_progress_id" integer;
  ALTER TABLE "training_modules_items" ADD CONSTRAINT "training_modules_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."training_modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "training_modules_quiz_choices" ADD CONSTRAINT "training_modules_quiz_choices_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."training_modules_quiz"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "training_modules_quiz" ADD CONSTRAINT "training_modules_quiz_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."training_modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "training_modules" ADD CONSTRAINT "training_modules_job_role_id_job_roles_id_fk" FOREIGN KEY ("job_role_id") REFERENCES "public"."job_roles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "training_modules_rels" ADD CONSTRAINT "training_modules_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."training_modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "training_modules_rels" ADD CONSTRAINT "training_modules_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "training_progress_ticked" ADD CONSTRAINT "training_progress_ticked_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."training_progress"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "training_progress" ADD CONSTRAINT "training_progress_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "training_progress" ADD CONSTRAINT "training_progress_module_id_training_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."training_modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "training_progress" ADD CONSTRAINT "training_progress_signed_off_by_id_users_id_fk" FOREIGN KEY ("signed_off_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "training_modules_items_order_idx" ON "training_modules_items" USING btree ("_order");
  CREATE INDEX "training_modules_items_parent_id_idx" ON "training_modules_items" USING btree ("_parent_id");
  CREATE INDEX "training_modules_quiz_choices_order_idx" ON "training_modules_quiz_choices" USING btree ("_order");
  CREATE INDEX "training_modules_quiz_choices_parent_id_idx" ON "training_modules_quiz_choices" USING btree ("_parent_id");
  CREATE INDEX "training_modules_quiz_order_idx" ON "training_modules_quiz" USING btree ("_order");
  CREATE INDEX "training_modules_quiz_parent_id_idx" ON "training_modules_quiz" USING btree ("_parent_id");
  CREATE INDEX "training_modules_job_role_idx" ON "training_modules" USING btree ("job_role_id");
  CREATE INDEX "training_modules_updated_at_idx" ON "training_modules" USING btree ("updated_at");
  CREATE INDEX "training_modules_created_at_idx" ON "training_modules" USING btree ("created_at");
  CREATE INDEX "training_modules_rels_order_idx" ON "training_modules_rels" USING btree ("order");
  CREATE INDEX "training_modules_rels_parent_idx" ON "training_modules_rels" USING btree ("parent_id");
  CREATE INDEX "training_modules_rels_path_idx" ON "training_modules_rels" USING btree ("path");
  CREATE INDEX "training_modules_rels_documents_id_idx" ON "training_modules_rels" USING btree ("documents_id");
  CREATE INDEX "training_progress_ticked_order_idx" ON "training_progress_ticked" USING btree ("_order");
  CREATE INDEX "training_progress_ticked_parent_id_idx" ON "training_progress_ticked" USING btree ("_parent_id");
  CREATE INDEX "training_progress_member_idx" ON "training_progress" USING btree ("member_id");
  CREATE INDEX "training_progress_module_idx" ON "training_progress" USING btree ("module_id");
  CREATE INDEX "training_progress_signed_off_by_idx" ON "training_progress" USING btree ("signed_off_by_id");
  CREATE INDEX "training_progress_updated_at_idx" ON "training_progress" USING btree ("updated_at");
  CREATE INDEX "training_progress_created_at_idx" ON "training_progress" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_training_modules_fk" FOREIGN KEY ("training_modules_id") REFERENCES "public"."training_modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_training_progress_fk" FOREIGN KEY ("training_progress_id") REFERENCES "public"."training_progress"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_training_modules_id_idx" ON "payload_locked_documents_rels" USING btree ("training_modules_id");
  CREATE INDEX "payload_locked_documents_rels_training_progress_id_idx" ON "payload_locked_documents_rels" USING btree ("training_progress_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "training_modules_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "training_modules_quiz_choices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "training_modules_quiz" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "training_modules" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "training_modules_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "training_progress_ticked" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "training_progress" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "training_modules_items" CASCADE;
  DROP TABLE "training_modules_quiz_choices" CASCADE;
  DROP TABLE "training_modules_quiz" CASCADE;
  DROP TABLE "training_modules" CASCADE;
  DROP TABLE "training_modules_rels" CASCADE;
  DROP TABLE "training_progress_ticked" CASCADE;
  DROP TABLE "training_progress" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_training_modules_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_training_progress_fk";
  
  DROP INDEX "payload_locked_documents_rels_training_modules_id_idx";
  DROP INDEX "payload_locked_documents_rels_training_progress_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "training_modules_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "training_progress_id";`)
}
