import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_documents_kind" AS ENUM('library', 'personal', 'record');
  CREATE TYPE "public"."enum_documents_category" AS ENUM('handbook', 'price-sheet', 'script', 'pitch-example', 'brand', 'training', 'agreement', 'cost-sheet', 'receipt', 'other');
  CREATE TABLE "documents_opened_by" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"user_id" integer,
  	"at" timestamp(3) with time zone
  );
  
  CREATE TABLE "documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"kind" "enum_documents_kind" DEFAULT 'library' NOT NULL,
  	"category" "enum_documents_category",
  	"note" varchar,
  	"member_id" integer,
  	"lead_id" integer,
  	"task_id" integer,
  	"replaces_id" integer,
  	"version" numeric,
  	"current" boolean DEFAULT true,
  	"tell_team" boolean DEFAULT false,
  	"uploaded_by_id" integer,
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
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "documents_id" integer;
  ALTER TABLE "documents_opened_by" ADD CONSTRAINT "documents_opened_by_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents_opened_by" ADD CONSTRAINT "documents_opened_by_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_replaces_id_documents_id_fk" FOREIGN KEY ("replaces_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "documents_opened_by_order_idx" ON "documents_opened_by" USING btree ("_order");
  CREATE INDEX "documents_opened_by_parent_id_idx" ON "documents_opened_by" USING btree ("_parent_id");
  CREATE INDEX "documents_opened_by_user_idx" ON "documents_opened_by" USING btree ("user_id");
  CREATE INDEX "documents_kind_idx" ON "documents" USING btree ("kind");
  CREATE INDEX "documents_member_idx" ON "documents" USING btree ("member_id");
  CREATE INDEX "documents_lead_idx" ON "documents" USING btree ("lead_id");
  CREATE INDEX "documents_task_idx" ON "documents" USING btree ("task_id");
  CREATE INDEX "documents_replaces_idx" ON "documents" USING btree ("replaces_id");
  CREATE INDEX "documents_current_idx" ON "documents" USING btree ("current");
  CREATE INDEX "documents_uploaded_by_idx" ON "documents" USING btree ("uploaded_by_id");
  CREATE INDEX "documents_updated_at_idx" ON "documents" USING btree ("updated_at");
  CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at");
  CREATE UNIQUE INDEX "documents_filename_idx" ON "documents" USING btree ("filename");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("documents_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "documents_opened_by" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "documents" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "documents_opened_by" CASCADE;
  DROP TABLE "documents" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_documents_fk";
  
  DROP INDEX "payload_locked_documents_rels_documents_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "documents_id";
  DROP TYPE "public"."enum_documents_kind";
  DROP TYPE "public"."enum_documents_category";`)
}
