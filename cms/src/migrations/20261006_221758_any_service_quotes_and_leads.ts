import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_quote_requests_services" AS ENUM('web-design', 'digital-marketing', 'branding', 'video-production', 'seo-paid-ads', 'social-media', 'custom');
  ALTER TYPE "public"."enum_leads_qualification" ADD VALUE IF NOT EXISTS 'outdated-site';
  ALTER TYPE "public"."enum_leads_qualification" ADD VALUE IF NOT EXISTS 'weak-social';
  ALTER TYPE "public"."enum_leads_qualification" ADD VALUE IF NOT EXISTS 'weak-brand';
  ALTER TYPE "public"."enum_leads_qualification" ADD VALUE IF NOT EXISTS 'not-found';
  ALTER TYPE "public"."enum_leads_qualification" ADD VALUE IF NOT EXISTS 'no-video';
  ALTER TYPE "public"."enum_leads_qualification" ADD VALUE IF NOT EXISTS 'other';
  ALTER TYPE "public"."enum__leads_v_version_qualification" ADD VALUE IF NOT EXISTS 'outdated-site';
  ALTER TYPE "public"."enum__leads_v_version_qualification" ADD VALUE IF NOT EXISTS 'weak-social';
  ALTER TYPE "public"."enum__leads_v_version_qualification" ADD VALUE IF NOT EXISTS 'weak-brand';
  ALTER TYPE "public"."enum__leads_v_version_qualification" ADD VALUE IF NOT EXISTS 'not-found';
  ALTER TYPE "public"."enum__leads_v_version_qualification" ADD VALUE IF NOT EXISTS 'no-video';
  ALTER TYPE "public"."enum__leads_v_version_qualification" ADD VALUE IF NOT EXISTS 'other';
  CREATE TABLE "quote_requests_services" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_quote_requests_services",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "quote_requests" ADD COLUMN "what_they_have" varchar;
  ALTER TABLE "quote_requests_services" ADD CONSTRAINT "quote_requests_services_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."quote_requests"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "quote_requests_services_order_idx" ON "quote_requests_services" USING btree ("order");
  CREATE INDEX "quote_requests_services_parent_idx" ON "quote_requests_services" USING btree ("parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "quote_requests_services" CASCADE;
  ALTER TABLE "leads" ALTER COLUMN "qualification" SET DATA TYPE text;
  DROP TYPE "public"."enum_leads_qualification";
  CREATE TYPE "public"."enum_leads_qualification" AS ENUM('no-website', 'domain-dead', 'parked', 'error-page', 'social-only');
  ALTER TABLE "leads" ALTER COLUMN "qualification" SET DATA TYPE "public"."enum_leads_qualification" USING "qualification"::"public"."enum_leads_qualification";
  ALTER TABLE "_leads_v" ALTER COLUMN "version_qualification" SET DATA TYPE text;
  DROP TYPE "public"."enum__leads_v_version_qualification";
  CREATE TYPE "public"."enum__leads_v_version_qualification" AS ENUM('no-website', 'domain-dead', 'parked', 'error-page', 'social-only');
  ALTER TABLE "_leads_v" ALTER COLUMN "version_qualification" SET DATA TYPE "public"."enum__leads_v_version_qualification" USING "version_qualification"::"public"."enum__leads_v_version_qualification";
  ALTER TABLE "quote_requests" DROP COLUMN "what_they_have";
  DROP TYPE "public"."enum_quote_requests_services";`)
}
