import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_leads_qualification" ADD VALUE 'ads-untargeted' BEFORE 'other';
  ALTER TYPE "public"."enum_leads_status" ADD VALUE 'stopped' BEFORE 'archived';
  ALTER TYPE "public"."enum__leads_v_version_qualification" ADD VALUE 'ads-untargeted' BEFORE 'other';
  ALTER TYPE "public"."enum__leads_v_version_status" ADD VALUE 'stopped' BEFORE 'archived';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "leads" ALTER COLUMN "qualification" SET DATA TYPE text;
  DROP TYPE "public"."enum_leads_qualification";
  CREATE TYPE "public"."enum_leads_qualification" AS ENUM('no-website', 'domain-dead', 'parked', 'error-page', 'social-only', 'outdated-site', 'weak-social', 'weak-brand', 'not-found', 'no-video', 'other');
  ALTER TABLE "leads" ALTER COLUMN "qualification" SET DATA TYPE "public"."enum_leads_qualification" USING "qualification"::"public"."enum_leads_qualification";
  ALTER TABLE "leads" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'new'::text;
  DROP TYPE "public"."enum_leads_status";
  CREATE TYPE "public"."enum_leads_status" AS ENUM('new', 'contacted', 'replied', 'in-conversation', 'proposal-requested', 'proposal-sent', 'no-response', 'qualified', 'won', 'lost', 'archived');
  ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'new'::"public"."enum_leads_status";
  ALTER TABLE "leads" ALTER COLUMN "status" SET DATA TYPE "public"."enum_leads_status" USING "status"::"public"."enum_leads_status";
  ALTER TABLE "_leads_v" ALTER COLUMN "version_qualification" SET DATA TYPE text;
  DROP TYPE "public"."enum__leads_v_version_qualification";
  CREATE TYPE "public"."enum__leads_v_version_qualification" AS ENUM('no-website', 'domain-dead', 'parked', 'error-page', 'social-only', 'outdated-site', 'weak-social', 'weak-brand', 'not-found', 'no-video', 'other');
  ALTER TABLE "_leads_v" ALTER COLUMN "version_qualification" SET DATA TYPE "public"."enum__leads_v_version_qualification" USING "version_qualification"::"public"."enum__leads_v_version_qualification";
  ALTER TABLE "_leads_v" ALTER COLUMN "version_status" SET DATA TYPE text;
  ALTER TABLE "_leads_v" ALTER COLUMN "version_status" SET DEFAULT 'new'::text;
  DROP TYPE "public"."enum__leads_v_version_status";
  CREATE TYPE "public"."enum__leads_v_version_status" AS ENUM('new', 'contacted', 'replied', 'in-conversation', 'proposal-requested', 'proposal-sent', 'no-response', 'qualified', 'won', 'lost', 'archived');
  ALTER TABLE "_leads_v" ALTER COLUMN "version_status" SET DEFAULT 'new'::"public"."enum__leads_v_version_status";
  ALTER TABLE "_leads_v" ALTER COLUMN "version_status" SET DATA TYPE "public"."enum__leads_v_version_status" USING "version_status"::"public"."enum__leads_v_version_status";`)
}
