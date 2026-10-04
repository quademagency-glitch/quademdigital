import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_time_off_kind" AS ENUM('time-off', 'exam', 'sick');
  CREATE TYPE "public"."enum_time_off_status" AS ENUM('requested', 'approved', 'declined', 'cancelled');
  CREATE TYPE "public"."enum_ops_settings_public_holidays_country" AS ENUM('GH', 'NG', 'KE', 'ZA', 'GB', 'US');
  CREATE TYPE "public"."enum__ops_settings_v_version_public_holidays_country" AS ENUM('GH', 'NG', 'KE', 'ZA', 'GB', 'US');
  CREATE TABLE "time_off" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"member_id" integer,
  	"kind" "enum_time_off_kind" DEFAULT 'time-off' NOT NULL,
  	"status" "enum_time_off_status" DEFAULT 'requested',
  	"from" timestamp(3) with time zone NOT NULL,
  	"to" timestamp(3) with time zone NOT NULL,
  	"working_days" numeric,
  	"note" varchar,
  	"doctor_note_id" integer,
  	"decided_by_id" integer,
  	"decided_at" timestamp(3) with time zone,
  	"decision_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ops_settings_public_holidays" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"country" "enum_ops_settings_public_holidays_country" NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"name" varchar NOT NULL
  );
  
  CREATE TABLE "_ops_settings_v_version_public_holidays" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"country" "enum__ops_settings_v_version_public_holidays_country" NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"name" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  ALTER TABLE "terms_templates" ADD COLUMN "leave_days_per_year" numeric;
  ALTER TABLE "member_terms" ADD COLUMN "leave_days_per_year" numeric;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "time_off_id" integer;
  ALTER TABLE "time_off" ADD CONSTRAINT "time_off_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "time_off" ADD CONSTRAINT "time_off_doctor_note_id_documents_id_fk" FOREIGN KEY ("doctor_note_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "time_off" ADD CONSTRAINT "time_off_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ops_settings_public_holidays" ADD CONSTRAINT "ops_settings_public_holidays_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ops_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ops_settings_v_version_public_holidays" ADD CONSTRAINT "_ops_settings_v_version_public_holidays_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_ops_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "time_off_member_idx" ON "time_off" USING btree ("member_id");
  CREATE INDEX "time_off_status_idx" ON "time_off" USING btree ("status");
  CREATE INDEX "time_off_from_idx" ON "time_off" USING btree ("from");
  CREATE INDEX "time_off_to_idx" ON "time_off" USING btree ("to");
  CREATE INDEX "time_off_doctor_note_idx" ON "time_off" USING btree ("doctor_note_id");
  CREATE INDEX "time_off_decided_by_idx" ON "time_off" USING btree ("decided_by_id");
  CREATE INDEX "time_off_updated_at_idx" ON "time_off" USING btree ("updated_at");
  CREATE INDEX "time_off_created_at_idx" ON "time_off" USING btree ("created_at");
  CREATE INDEX "ops_settings_public_holidays_order_idx" ON "ops_settings_public_holidays" USING btree ("_order");
  CREATE INDEX "ops_settings_public_holidays_parent_id_idx" ON "ops_settings_public_holidays" USING btree ("_parent_id");
  CREATE INDEX "_ops_settings_v_version_public_holidays_order_idx" ON "_ops_settings_v_version_public_holidays" USING btree ("_order");
  CREATE INDEX "_ops_settings_v_version_public_holidays_parent_id_idx" ON "_ops_settings_v_version_public_holidays" USING btree ("_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_time_off_fk" FOREIGN KEY ("time_off_id") REFERENCES "public"."time_off"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_time_off_id_idx" ON "payload_locked_documents_rels" USING btree ("time_off_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "time_off" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ops_settings_public_holidays" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_ops_settings_v_version_public_holidays" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "time_off" CASCADE;
  DROP TABLE "ops_settings_public_holidays" CASCADE;
  DROP TABLE "_ops_settings_v_version_public_holidays" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_time_off_fk";
  
  DROP INDEX "payload_locked_documents_rels_time_off_id_idx";
  ALTER TABLE "terms_templates" DROP COLUMN "leave_days_per_year";
  ALTER TABLE "member_terms" DROP COLUMN "leave_days_per_year";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "time_off_id";
  DROP TYPE "public"."enum_time_off_kind";
  DROP TYPE "public"."enum_time_off_status";
  DROP TYPE "public"."enum_ops_settings_public_holidays_country";
  DROP TYPE "public"."enum__ops_settings_v_version_public_holidays_country";`)
}
