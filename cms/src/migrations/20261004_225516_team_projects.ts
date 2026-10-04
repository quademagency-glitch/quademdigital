import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tasks_priority" AS ENUM('low', 'normal', 'high', 'urgent');
  CREATE TYPE "public"."enum_tasks_repeat" AS ENUM('none', 'daily', 'weekly', 'monthly');
  CREATE TYPE "public"."enum_projects_status" AS ENUM('planning', 'active', 'review', 'paused', 'done');
  CREATE TYPE "public"."enum_deliverables_status" AS ENUM('todo', 'doing', 'review', 'done');
  CREATE TABLE "tasks_checklist" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"done" boolean DEFAULT false,
  	"done_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "projects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"client_id" integer,
  	"client_name" varchar,
  	"status" "enum_projects_status" DEFAULT 'planning' NOT NULL,
  	"start_date" timestamp(3) with time zone,
  	"due_date" timestamp(3) with time zone,
  	"lead_id" integer,
  	"description" varchar,
  	"deal_id" integer,
  	"done_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "projects_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "deliverables" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"project_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"owner_id" integer,
  	"due_at" timestamp(3) with time zone,
  	"status" "enum_deliverables_status" DEFAULT 'todo' NOT NULL,
  	"note" varchar,
  	"order" numeric,
  	"done_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "tasks" ADD COLUMN "priority" "enum_tasks_priority" DEFAULT 'normal';
  ALTER TABLE "tasks" ADD COLUMN "repeat" "enum_tasks_repeat" DEFAULT 'none';
  ALTER TABLE "comments" ADD COLUMN "project_id" integer;
  ALTER TABLE "documents" ADD COLUMN "project_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "projects_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "deliverables_id" integer;
  ALTER TABLE "tasks_checklist" ADD CONSTRAINT "tasks_checklist_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "projects" ADD CONSTRAINT "projects_lead_id_users_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "projects" ADD CONSTRAINT "projects_deal_id_proposals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "tasks_checklist_order_idx" ON "tasks_checklist" USING btree ("_order");
  CREATE INDEX "tasks_checklist_parent_id_idx" ON "tasks_checklist" USING btree ("_parent_id");
  CREATE INDEX "projects_client_idx" ON "projects" USING btree ("client_id");
  CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");
  CREATE INDEX "projects_lead_idx" ON "projects" USING btree ("lead_id");
  CREATE INDEX "projects_deal_idx" ON "projects" USING btree ("deal_id");
  CREATE INDEX "projects_updated_at_idx" ON "projects" USING btree ("updated_at");
  CREATE INDEX "projects_created_at_idx" ON "projects" USING btree ("created_at");
  CREATE INDEX "projects_rels_order_idx" ON "projects_rels" USING btree ("order");
  CREATE INDEX "projects_rels_parent_idx" ON "projects_rels" USING btree ("parent_id");
  CREATE INDEX "projects_rels_path_idx" ON "projects_rels" USING btree ("path");
  CREATE INDEX "projects_rels_users_id_idx" ON "projects_rels" USING btree ("users_id");
  CREATE INDEX "deliverables_project_idx" ON "deliverables" USING btree ("project_id");
  CREATE INDEX "deliverables_owner_idx" ON "deliverables" USING btree ("owner_id");
  CREATE INDEX "deliverables_due_at_idx" ON "deliverables" USING btree ("due_at");
  CREATE INDEX "deliverables_status_idx" ON "deliverables" USING btree ("status");
  CREATE INDEX "deliverables_updated_at_idx" ON "deliverables" USING btree ("updated_at");
  CREATE INDEX "deliverables_created_at_idx" ON "deliverables" USING btree ("created_at");
  ALTER TABLE "comments" ADD CONSTRAINT "comments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_deliverables_fk" FOREIGN KEY ("deliverables_id") REFERENCES "public"."deliverables"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "tasks_priority_idx" ON "tasks" USING btree ("priority");
  CREATE INDEX "comments_project_idx" ON "comments" USING btree ("project_id");
  CREATE INDEX "documents_project_idx" ON "documents" USING btree ("project_id");
  CREATE INDEX "payload_locked_documents_rels_projects_id_idx" ON "payload_locked_documents_rels" USING btree ("projects_id");
  CREATE INDEX "payload_locked_documents_rels_deliverables_id_idx" ON "payload_locked_documents_rels" USING btree ("deliverables_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tasks_checklist" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "projects" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "projects_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "deliverables" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "tasks_checklist" CASCADE;
  DROP TABLE "projects" CASCADE;
  DROP TABLE "projects_rels" CASCADE;
  DROP TABLE "deliverables" CASCADE;
  ALTER TABLE "comments" DROP CONSTRAINT "comments_project_id_projects_id_fk";
  
  ALTER TABLE "documents" DROP CONSTRAINT "documents_project_id_projects_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_projects_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_deliverables_fk";
  
  DROP INDEX "tasks_priority_idx";
  DROP INDEX "comments_project_idx";
  DROP INDEX "documents_project_idx";
  DROP INDEX "payload_locked_documents_rels_projects_id_idx";
  DROP INDEX "payload_locked_documents_rels_deliverables_id_idx";
  ALTER TABLE "tasks" DROP COLUMN "priority";
  ALTER TABLE "tasks" DROP COLUMN "repeat";
  ALTER TABLE "comments" DROP COLUMN "project_id";
  ALTER TABLE "documents" DROP COLUMN "project_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "projects_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "deliverables_id";
  DROP TYPE "public"."enum_tasks_priority";
  DROP TYPE "public"."enum_tasks_repeat";
  DROP TYPE "public"."enum_projects_status";
  DROP TYPE "public"."enum_deliverables_status";`)
}
