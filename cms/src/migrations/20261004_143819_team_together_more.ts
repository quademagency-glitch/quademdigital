import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_meetings_kind" AS ENUM('one-to-one', 'office-hours', 'team');
  CREATE TYPE "public"."enum_meetings_repeat" AS ENUM('none', 'weekly', 'fortnightly', 'monthly');
  CREATE TYPE "public"."enum_know_how_kind" AS ENUM('objection', 'message', 'tip');
  CREATE TYPE "public"."enum_know_how_status" AS ENUM('suggested', 'approved', 'declined');
  ALTER TYPE "public"."enum_documents_category" ADD VALUE 'policy' BEFORE 'cost-sheet';
  CREATE TABLE "documents_accepted_by" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"user_id" integer,
  	"at" timestamp(3) with time zone
  );
  
  CREATE TABLE "meetings_actions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"owner_id" integer,
  	"due" timestamp(3) with time zone,
  	"task_id" integer
  );
  
  CREATE TABLE "meetings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"kind" "enum_meetings_kind" DEFAULT 'one-to-one' NOT NULL,
  	"starts_at" timestamp(3) with time zone NOT NULL,
  	"minutes" numeric DEFAULT 30,
  	"repeat" "enum_meetings_repeat" DEFAULT 'none',
  	"meet_link" varchar,
  	"agenda" varchar,
  	"notes" varchar,
  	"next_made_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "meetings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "know_how" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_know_how_kind" DEFAULT 'objection' NOT NULL,
  	"niche" varchar,
  	"status" "enum_know_how_status" DEFAULT 'suggested',
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"suggested_by_id" integer,
  	"decided_by_id" integer,
  	"decided_at" timestamp(3) with time zone,
  	"decision_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "documents" ADD COLUMN "must_accept" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "meetings_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "know_how_id" integer;
  ALTER TABLE "documents_accepted_by" ADD CONSTRAINT "documents_accepted_by_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents_accepted_by" ADD CONSTRAINT "documents_accepted_by_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "meetings_actions" ADD CONSTRAINT "meetings_actions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "meetings_actions" ADD CONSTRAINT "meetings_actions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "meetings_actions" ADD CONSTRAINT "meetings_actions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "meetings" ADD CONSTRAINT "meetings_next_made_id_meetings_id_fk" FOREIGN KEY ("next_made_id") REFERENCES "public"."meetings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "meetings_rels" ADD CONSTRAINT "meetings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "meetings_rels" ADD CONSTRAINT "meetings_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "know_how" ADD CONSTRAINT "know_how_suggested_by_id_users_id_fk" FOREIGN KEY ("suggested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "know_how" ADD CONSTRAINT "know_how_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "documents_accepted_by_order_idx" ON "documents_accepted_by" USING btree ("_order");
  CREATE INDEX "documents_accepted_by_parent_id_idx" ON "documents_accepted_by" USING btree ("_parent_id");
  CREATE INDEX "documents_accepted_by_user_idx" ON "documents_accepted_by" USING btree ("user_id");
  CREATE INDEX "meetings_actions_order_idx" ON "meetings_actions" USING btree ("_order");
  CREATE INDEX "meetings_actions_parent_id_idx" ON "meetings_actions" USING btree ("_parent_id");
  CREATE INDEX "meetings_actions_owner_idx" ON "meetings_actions" USING btree ("owner_id");
  CREATE INDEX "meetings_actions_task_idx" ON "meetings_actions" USING btree ("task_id");
  CREATE INDEX "meetings_starts_at_idx" ON "meetings" USING btree ("starts_at");
  CREATE INDEX "meetings_next_made_idx" ON "meetings" USING btree ("next_made_id");
  CREATE INDEX "meetings_updated_at_idx" ON "meetings" USING btree ("updated_at");
  CREATE INDEX "meetings_created_at_idx" ON "meetings" USING btree ("created_at");
  CREATE INDEX "meetings_rels_order_idx" ON "meetings_rels" USING btree ("order");
  CREATE INDEX "meetings_rels_parent_idx" ON "meetings_rels" USING btree ("parent_id");
  CREATE INDEX "meetings_rels_path_idx" ON "meetings_rels" USING btree ("path");
  CREATE INDEX "meetings_rels_users_id_idx" ON "meetings_rels" USING btree ("users_id");
  CREATE INDEX "know_how_status_idx" ON "know_how" USING btree ("status");
  CREATE INDEX "know_how_suggested_by_idx" ON "know_how" USING btree ("suggested_by_id");
  CREATE INDEX "know_how_decided_by_idx" ON "know_how" USING btree ("decided_by_id");
  CREATE INDEX "know_how_updated_at_idx" ON "know_how" USING btree ("updated_at");
  CREATE INDEX "know_how_created_at_idx" ON "know_how" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_meetings_fk" FOREIGN KEY ("meetings_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_know_how_fk" FOREIGN KEY ("know_how_id") REFERENCES "public"."know_how"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_meetings_id_idx" ON "payload_locked_documents_rels" USING btree ("meetings_id");
  CREATE INDEX "payload_locked_documents_rels_know_how_id_idx" ON "payload_locked_documents_rels" USING btree ("know_how_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "documents_accepted_by" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "meetings_actions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "meetings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "meetings_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "know_how" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "documents_accepted_by" CASCADE;
  DROP TABLE "meetings_actions" CASCADE;
  DROP TABLE "meetings" CASCADE;
  DROP TABLE "meetings_rels" CASCADE;
  DROP TABLE "know_how" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_meetings_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_know_how_fk";
  
  ALTER TABLE "documents" ALTER COLUMN "category" SET DATA TYPE text;
  DROP TYPE "public"."enum_documents_category";
  CREATE TYPE "public"."enum_documents_category" AS ENUM('handbook', 'price-sheet', 'script', 'pitch-example', 'brand', 'training', 'agreement', 'cost-sheet', 'receipt', 'other');
  ALTER TABLE "documents" ALTER COLUMN "category" SET DATA TYPE "public"."enum_documents_category" USING "category"::"public"."enum_documents_category";
  DROP INDEX "payload_locked_documents_rels_meetings_id_idx";
  DROP INDEX "payload_locked_documents_rels_know_how_id_idx";
  ALTER TABLE "documents" DROP COLUMN "must_accept";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "meetings_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "know_how_id";
  DROP TYPE "public"."enum_meetings_kind";
  DROP TYPE "public"."enum_meetings_repeat";
  DROP TYPE "public"."enum_know_how_kind";
  DROP TYPE "public"."enum_know_how_status";`)
}
