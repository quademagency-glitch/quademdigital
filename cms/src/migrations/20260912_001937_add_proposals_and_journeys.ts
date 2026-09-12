import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Proposals, journey templates and per-client journey steps.
 *
 * Three collections behind one flow: upload the proposal PDF, check what was
 * read out of it, and one button creates the client (which fires the existing
 * client-won automation), drafts an invoice and copies a journey template onto
 * the client as dated steps. See cms/src/collections/Proposals.ts.
 *
 * GENERATED, THEN TRIMMED, AND WHY THAT WAS NECESSARY
 *
 * `migrate:create` diffs the whole in-code schema against the newest snapshot,
 * and the newest snapshot was 20260902: six migrations since then were
 * hand-written and wrote none. So the generated file also carried `pitches`,
 * `pitch_assets`, `offers.expires_at`, `clients.country`,
 * `_clients_v.version_country` and two lock columns, all of which are already
 * on production and would have failed on `CREATE TABLE` the moment this ran.
 * Everything already applied has been removed here; only the new objects are
 * left, and the generated `.json` snapshot is kept alongside, which is what
 * stops the next generator run repeating the whole exercise.
 *
 * Idempotent throughout (IF NOT EXISTS, and the duplicate_object guard for
 * constraints and types), per cms/CLAUDE.md, so a partial run can be re-run.
 *
 * `payload_locked_documents_rels` gets one column per new collection. A table
 * created without it reads and saves fine and then 500s on every edit and
 * delete, which is exactly what `20260904_163000_pitches_lock_column` had to
 * fix after the fact.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
    CREATE TYPE "public"."enum_proposals_service" AS ENUM('web-design', 'digital-marketing', 'branding', 'video-production', 'seo-paid-ads', 'social-media', 'multiple');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_proposals_status" AS ENUM('parsing', 'needs-review', 'provisioned', 'failed');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_journey_templates_steps_owner" AS ENUM('quadem', 'client');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_journey_templates_steps_stage" AS ENUM('onboarding', 'design', 'development', 'review', 'completed', 'retainer');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_journey_templates_service" AS ENUM('web-design', 'digital-marketing', 'branding', 'video-production', 'seo-paid-ads', 'social-media', 'multiple');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_client_journey_steps_status" AS ENUM('todo', 'in-progress', 'done', 'blocked');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_client_journey_steps_owner" AS ENUM('quadem', 'client');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_client_journey_steps_stage" AS ENUM('onboarding', 'design', 'development', 'review', 'completed', 'retainer');
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE TABLE IF NOT EXISTS "journey_templates" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar NOT NULL,
    "service" "enum_journey_templates_service",
    "is_default" boolean DEFAULT false,
    "summary" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "journey_templates_steps" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "title" varchar NOT NULL,
    "detail" varchar,
    "owner" "enum_journey_templates_steps_owner" DEFAULT 'quadem',
    "stage" "enum_journey_templates_steps_stage" DEFAULT 'onboarding',
    "due_offset_days" numeric DEFAULT 0,
    "client_visible" boolean DEFAULT true
  );

  CREATE TABLE IF NOT EXISTS "client_journey_steps" (
    "id" serial PRIMARY KEY NOT NULL,
    "client_id" integer NOT NULL,
    "title" varchar NOT NULL,
    "detail" varchar,
    "status" "enum_client_journey_steps_status" DEFAULT 'todo',
    "owner" "enum_client_journey_steps_owner" DEFAULT 'quadem',
    "stage" "enum_client_journey_steps_stage" DEFAULT 'onboarding',
    "due_date" timestamp(3) with time zone,
    "completed_at" timestamp(3) with time zone,
    "client_visible" boolean DEFAULT true,
    "order" numeric DEFAULT 0,
    "source_template_id" integer,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "proposals" (
    "id" serial PRIMARY KEY NOT NULL,
    "client_name" varchar,
    "contact_name" varchar,
    "client_email" varchar,
    "phone" varchar,
    "country" varchar,
    "service" "enum_proposals_service",
    "package_name" varchar,
    "currency" varchar,
    "total" numeric,
    "recurring" boolean DEFAULT false,
    "deposit_percent" numeric,
    "start_date" timestamp(3) with time zone,
    "duration_months" numeric,
    "payment_terms" varchar,
    "special_terms" varchar,
    "summary" varchar,
    "journey_template_id" integer,
    "status" "enum_proposals_status" DEFAULT 'parsing',
    "parsed_at" timestamp(3) with time zone,
    "parse_error" varchar,
    "client_id" integer,
    "invoice_id" integer,
    "provisioned_at" timestamp(3) with time zone,
    "provision_log" varchar,
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

  CREATE TABLE IF NOT EXISTS "proposals_deliverables" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "item" varchar NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "proposals_line_items" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "description" varchar NOT NULL,
    "quantity" numeric DEFAULT 1 NOT NULL,
    "rate" numeric NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "proposals_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "journey_templates_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "client_journey_steps_id" integer;

  DO $$ BEGIN
    ALTER TABLE "proposals_deliverables" ADD CONSTRAINT "proposals_deliverables_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "proposals_line_items" ADD CONSTRAINT "proposals_line_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "proposals" ADD CONSTRAINT "proposals_journey_template_id_journey_templates_id_fk" FOREIGN KEY ("journey_template_id") REFERENCES "public"."journey_templates"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "proposals" ADD CONSTRAINT "proposals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "proposals" ADD CONSTRAINT "proposals_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "journey_templates_steps" ADD CONSTRAINT "journey_templates_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."journey_templates"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "client_journey_steps" ADD CONSTRAINT "client_journey_steps_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "client_journey_steps" ADD CONSTRAINT "client_journey_steps_source_template_id_journey_templates_id_fk" FOREIGN KEY ("source_template_id") REFERENCES "public"."journey_templates"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_proposals_fk" FOREIGN KEY ("proposals_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_journey_templates_fk" FOREIGN KEY ("journey_templates_id") REFERENCES "public"."journey_templates"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_client_journey_steps_fk" FOREIGN KEY ("client_journey_steps_id") REFERENCES "public"."client_journey_steps"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE INDEX IF NOT EXISTS "proposals_deliverables_order_idx" ON "proposals_deliverables" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "proposals_deliverables_parent_id_idx" ON "proposals_deliverables" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "proposals_line_items_order_idx" ON "proposals_line_items" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "proposals_line_items_parent_id_idx" ON "proposals_line_items" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "proposals_journey_template_idx" ON "proposals" USING btree ("journey_template_id");
  CREATE INDEX IF NOT EXISTS "proposals_client_idx" ON "proposals" USING btree ("client_id");
  CREATE INDEX IF NOT EXISTS "proposals_invoice_idx" ON "proposals" USING btree ("invoice_id");
  CREATE INDEX IF NOT EXISTS "proposals_updated_at_idx" ON "proposals" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "proposals_created_at_idx" ON "proposals" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "proposals_filename_idx" ON "proposals" USING btree ("filename");
  CREATE INDEX IF NOT EXISTS "journey_templates_steps_order_idx" ON "journey_templates_steps" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "journey_templates_steps_parent_id_idx" ON "journey_templates_steps" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "journey_templates_updated_at_idx" ON "journey_templates" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "journey_templates_created_at_idx" ON "journey_templates" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "client_journey_steps_client_idx" ON "client_journey_steps" USING btree ("client_id");
  CREATE INDEX IF NOT EXISTS "client_journey_steps_due_date_idx" ON "client_journey_steps" USING btree ("due_date");
  CREATE INDEX IF NOT EXISTS "client_journey_steps_source_template_idx" ON "client_journey_steps" USING btree ("source_template_id");
  CREATE INDEX IF NOT EXISTS "client_journey_steps_updated_at_idx" ON "client_journey_steps" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "client_journey_steps_created_at_idx" ON "client_journey_steps" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_proposals_id_idx" ON "payload_locked_documents_rels" USING btree ("proposals_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_journey_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("journey_templates_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_client_journey_steps_id_idx" ON "payload_locked_documents_rels" USING btree ("client_journey_steps_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_proposals_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_journey_templates_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_client_journey_steps_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_proposals_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_journey_templates_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_client_journey_steps_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "proposals_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "journey_templates_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "client_journey_steps_id";

  DROP TABLE IF EXISTS "proposals_deliverables" CASCADE;
  DROP TABLE IF EXISTS "proposals_line_items" CASCADE;
  DROP TABLE IF EXISTS "proposals" CASCADE;
  DROP TABLE IF EXISTS "client_journey_steps" CASCADE;
  DROP TABLE IF EXISTS "journey_templates_steps" CASCADE;
  DROP TABLE IF EXISTS "journey_templates" CASCADE;

  DROP TYPE IF EXISTS "public"."enum_proposals_service";
  DROP TYPE IF EXISTS "public"."enum_proposals_status";
  DROP TYPE IF EXISTS "public"."enum_journey_templates_steps_owner";
  DROP TYPE IF EXISTS "public"."enum_journey_templates_steps_stage";
  DROP TYPE IF EXISTS "public"."enum_journey_templates_service";
  DROP TYPE IF EXISTS "public"."enum_client_journey_steps_status";
  DROP TYPE IF EXISTS "public"."enum_client_journey_steps_owner";
  DROP TYPE IF EXISTS "public"."enum_client_journey_steps_stage";`)
}
