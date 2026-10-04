import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_quote_requests_must_do" AS ENUM('enquiries', 'sell-online', 'bookings', 'other');
  CREATE TYPE "public"."enum_quote_requests_status" AS ENUM('new', 'priced', 'sent', 'accepted', 'declined');
  CREATE TYPE "public"."enum_quote_requests_has_website" AS ENUM('none', 'broken', 'working');
  CREATE TYPE "public"."enum_quote_requests_users" AS ENUM('customers', 'staff', 'both');
  CREATE TYPE "public"."enum_quote_requests_pricing" AS ENUM('package', 'custom');
  CREATE TYPE "public"."enum_pricing_plans_kind" AS ENUM('bundle', 'package');
  CREATE TABLE "quote_requests_must_do" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_quote_requests_must_do",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "quote_requests_examples_they_like" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "quote_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"lead_id" integer NOT NULL,
  	"requested_by_id" integer,
  	"status" "enum_quote_requests_status" DEFAULT 'new',
  	"has_website" "enum_quote_requests_has_website",
  	"users" "enum_quote_requests_users",
  	"features_requested" varchar NOT NULL,
  	"deadline" timestamp(3) with time zone,
  	"budget_mentioned" varchar,
  	"pricing" "enum_quote_requests_pricing",
  	"quoted_currency" varchar,
  	"quoted_amount_minor" numeric,
  	"fx_rate" numeric,
  	"price_note" varchar,
  	"approved_by_id" integer,
  	"approved_at" timestamp(3) with time zone,
  	"deal_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "quote_requests_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pricing_plans_id" integer
  );
  
  ALTER TABLE "pricing_plans" ADD COLUMN "kind" "enum_pricing_plans_kind" DEFAULT 'bundle';
  ALTER TABLE "pricing_plans" ADD COLUMN "service_id" integer;
  ALTER TABLE "pricing_plans" ADD COLUMN "custom" boolean DEFAULT false;
  ALTER TABLE "pricing_plans" ADD COLUMN "active" boolean DEFAULT true;
  ALTER TABLE "pricing_plans" ADD COLUMN "calculator_from" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "quote_requests_id" integer;
  ALTER TABLE "quote_requests_must_do" ADD CONSTRAINT "quote_requests_must_do_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."quote_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quote_requests_examples_they_like" ADD CONSTRAINT "quote_requests_examples_they_like_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quote_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_deal_id_proposals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quote_requests_rels" ADD CONSTRAINT "quote_requests_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."quote_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quote_requests_rels" ADD CONSTRAINT "quote_requests_rels_pricing_plans_fk" FOREIGN KEY ("pricing_plans_id") REFERENCES "public"."pricing_plans"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "quote_requests_must_do_order_idx" ON "quote_requests_must_do" USING btree ("order");
  CREATE INDEX "quote_requests_must_do_parent_idx" ON "quote_requests_must_do" USING btree ("parent_id");
  CREATE INDEX "quote_requests_examples_they_like_order_idx" ON "quote_requests_examples_they_like" USING btree ("_order");
  CREATE INDEX "quote_requests_examples_they_like_parent_id_idx" ON "quote_requests_examples_they_like" USING btree ("_parent_id");
  CREATE INDEX "quote_requests_lead_idx" ON "quote_requests" USING btree ("lead_id");
  CREATE INDEX "quote_requests_requested_by_idx" ON "quote_requests" USING btree ("requested_by_id");
  CREATE INDEX "quote_requests_status_idx" ON "quote_requests" USING btree ("status");
  CREATE INDEX "quote_requests_approved_by_idx" ON "quote_requests" USING btree ("approved_by_id");
  CREATE INDEX "quote_requests_deal_idx" ON "quote_requests" USING btree ("deal_id");
  CREATE INDEX "quote_requests_updated_at_idx" ON "quote_requests" USING btree ("updated_at");
  CREATE INDEX "quote_requests_created_at_idx" ON "quote_requests" USING btree ("created_at");
  CREATE INDEX "quote_requests_rels_order_idx" ON "quote_requests_rels" USING btree ("order");
  CREATE INDEX "quote_requests_rels_parent_idx" ON "quote_requests_rels" USING btree ("parent_id");
  CREATE INDEX "quote_requests_rels_path_idx" ON "quote_requests_rels" USING btree ("path");
  CREATE INDEX "quote_requests_rels_pricing_plans_id_idx" ON "quote_requests_rels" USING btree ("pricing_plans_id");
  ALTER TABLE "pricing_plans" ADD CONSTRAINT "pricing_plans_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quote_requests_fk" FOREIGN KEY ("quote_requests_id") REFERENCES "public"."quote_requests"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pricing_plans_service_idx" ON "pricing_plans" USING btree ("service_id");
  CREATE INDEX "payload_locked_documents_rels_quote_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("quote_requests_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "quote_requests_must_do" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quote_requests_examples_they_like" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quote_requests" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quote_requests_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "quote_requests_must_do" CASCADE;
  DROP TABLE "quote_requests_examples_they_like" CASCADE;
  DROP TABLE "quote_requests" CASCADE;
  DROP TABLE "quote_requests_rels" CASCADE;
  ALTER TABLE "pricing_plans" DROP CONSTRAINT "pricing_plans_service_id_services_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_quote_requests_fk";
  
  DROP INDEX "pricing_plans_service_idx";
  DROP INDEX "payload_locked_documents_rels_quote_requests_id_idx";
  ALTER TABLE "pricing_plans" DROP COLUMN "kind";
  ALTER TABLE "pricing_plans" DROP COLUMN "service_id";
  ALTER TABLE "pricing_plans" DROP COLUMN "custom";
  ALTER TABLE "pricing_plans" DROP COLUMN "active";
  ALTER TABLE "pricing_plans" DROP COLUMN "calculator_from";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "quote_requests_id";
  DROP TYPE "public"."enum_quote_requests_must_do";
  DROP TYPE "public"."enum_quote_requests_status";
  DROP TYPE "public"."enum_quote_requests_has_website";
  DROP TYPE "public"."enum_quote_requests_users";
  DROP TYPE "public"."enum_quote_requests_pricing";
  DROP TYPE "public"."enum_pricing_plans_kind";`)
}
