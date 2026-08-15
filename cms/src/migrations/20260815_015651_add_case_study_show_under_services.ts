import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds CaseStudies.showUnderServices — the hasMany select that decides which
 * service pages a project is featured on.
 *
 * Hand-trimmed. `migrate:create` diffed against the 20260801 rebaseline
 * snapshot, which predates the invoice-payment, invoice-deposit and
 * lead-source migrations (none of them wrote a snapshot), so the generated
 * file also re-issued all of their statements. Those are already applied in
 * production and would have errored on replay, so only the case-studies
 * objects are kept here. The accompanying .json snapshot is the freshly
 * generated one and does record the full current schema, so the next
 * migrate:create diffs against reality.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
   CREATE TYPE "public"."enum_case_studies_show_under_services" AS ENUM('web-design', 'seo', 'brand-identity', 'video-production', 'digital-marketing');
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE TABLE IF NOT EXISTS "case_studies_show_under_services" (
    "order" integer NOT NULL,
    "parent_id" integer NOT NULL,
    "value" "enum_case_studies_show_under_services",
    "id" serial PRIMARY KEY NOT NULL
  );

  DO $$ BEGIN
   ALTER TABLE "case_studies_show_under_services" ADD CONSTRAINT "case_studies_show_under_services_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."case_studies"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE INDEX IF NOT EXISTS "case_studies_show_under_services_order_idx" ON "case_studies_show_under_services" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "case_studies_show_under_services_parent_idx" ON "case_studies_show_under_services" USING btree ("parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "case_studies_show_under_services" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_case_studies_show_under_services";`)
}
