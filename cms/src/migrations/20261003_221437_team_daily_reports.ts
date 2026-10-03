import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_daily_reports_niche" AS ENUM('food', 'beauty', 'health', 'fashion', 'real-estate', 'events', 'fitness', 'other');
  CREATE TYPE "public"."enum__daily_reports_v_version_niche" AS ENUM('food', 'beauty', 'health', 'fashion', 'real-estate', 'events', 'fitness', 'other');
  CREATE TABLE "daily_reports_typed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"value" numeric
  );
  
  CREATE TABLE "daily_reports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"user_id" integer NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"researched_count" numeric,
  	"first_messages_count" numeric,
  	"follow_ups_done_count" numeric,
  	"follow_ups_due_count" numeric,
  	"replies_count" numeric,
  	"city" varchar,
  	"niche" "enum_daily_reports_niche",
  	"replies_summary" varchar,
  	"blockers" varchar,
  	"follow_ups_due_tomorrow" jsonb,
  	"standard" jsonb,
  	"submitted_at" timestamp(3) with time zone,
  	"on_time" boolean,
  	"exam_week" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_daily_reports_v_version_typed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"value" numeric,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_daily_reports_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_user_id" integer NOT NULL,
  	"version_date" timestamp(3) with time zone NOT NULL,
  	"version_researched_count" numeric,
  	"version_first_messages_count" numeric,
  	"version_follow_ups_done_count" numeric,
  	"version_follow_ups_due_count" numeric,
  	"version_replies_count" numeric,
  	"version_city" varchar,
  	"version_niche" "enum__daily_reports_v_version_niche",
  	"version_replies_summary" varchar,
  	"version_blockers" varchar,
  	"version_follow_ups_due_tomorrow" jsonb,
  	"version_standard" jsonb,
  	"version_submitted_at" timestamp(3) with time zone,
  	"version_on_time" boolean,
  	"version_exam_week" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "daily_reports_id" integer;
  ALTER TABLE "daily_reports_typed" ADD CONSTRAINT "daily_reports_typed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."daily_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_daily_reports_v_version_typed" ADD CONSTRAINT "_daily_reports_v_version_typed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_daily_reports_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_daily_reports_v" ADD CONSTRAINT "_daily_reports_v_parent_id_daily_reports_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."daily_reports"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_daily_reports_v" ADD CONSTRAINT "_daily_reports_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "daily_reports_typed_order_idx" ON "daily_reports_typed" USING btree ("_order");
  CREATE INDEX "daily_reports_typed_parent_id_idx" ON "daily_reports_typed" USING btree ("_parent_id");
  CREATE INDEX "daily_reports_user_idx" ON "daily_reports" USING btree ("user_id");
  CREATE INDEX "daily_reports_date_idx" ON "daily_reports" USING btree ("date");
  CREATE INDEX "daily_reports_updated_at_idx" ON "daily_reports" USING btree ("updated_at");
  CREATE INDEX "daily_reports_created_at_idx" ON "daily_reports" USING btree ("created_at");
  CREATE INDEX "_daily_reports_v_version_typed_order_idx" ON "_daily_reports_v_version_typed" USING btree ("_order");
  CREATE INDEX "_daily_reports_v_version_typed_parent_id_idx" ON "_daily_reports_v_version_typed" USING btree ("_parent_id");
  CREATE INDEX "_daily_reports_v_parent_idx" ON "_daily_reports_v" USING btree ("parent_id");
  CREATE INDEX "_daily_reports_v_version_version_user_idx" ON "_daily_reports_v" USING btree ("version_user_id");
  CREATE INDEX "_daily_reports_v_version_version_date_idx" ON "_daily_reports_v" USING btree ("version_date");
  CREATE INDEX "_daily_reports_v_version_version_updated_at_idx" ON "_daily_reports_v" USING btree ("version_updated_at");
  CREATE INDEX "_daily_reports_v_version_version_created_at_idx" ON "_daily_reports_v" USING btree ("version_created_at");
  CREATE INDEX "_daily_reports_v_created_at_idx" ON "_daily_reports_v" USING btree ("created_at");
  CREATE INDEX "_daily_reports_v_updated_at_idx" ON "_daily_reports_v" USING btree ("updated_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_daily_reports_fk" FOREIGN KEY ("daily_reports_id") REFERENCES "public"."daily_reports"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_daily_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("daily_reports_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "daily_reports_typed" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "daily_reports" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_daily_reports_v_version_typed" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_daily_reports_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "daily_reports_typed" CASCADE;
  DROP TABLE "daily_reports" CASCADE;
  DROP TABLE "_daily_reports_v_version_typed" CASCADE;
  DROP TABLE "_daily_reports_v" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_daily_reports_fk";
  
  DROP INDEX "payload_locked_documents_rels_daily_reports_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "daily_reports_id";
  DROP TYPE "public"."enum_daily_reports_niche";
  DROP TYPE "public"."enum__daily_reports_v_version_niche";`)
}
