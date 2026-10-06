import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_clients_service" ADD VALUE IF NOT EXISTS 'custom';
  ALTER TYPE "public"."enum__clients_v_version_service" ADD VALUE IF NOT EXISTS 'custom';
  ALTER TYPE "public"."enum_proposals_service" ADD VALUE IF NOT EXISTS 'custom';
  ALTER TYPE "public"."enum_journey_templates_service" ADD VALUE IF NOT EXISTS 'custom';
  ALTER TYPE "public"."enum_onboarding_guides_service" ADD VALUE IF NOT EXISTS 'custom';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clients" ALTER COLUMN "service" SET DATA TYPE text;
  DROP TYPE "public"."enum_clients_service";
  CREATE TYPE "public"."enum_clients_service" AS ENUM('web-design', 'digital-marketing', 'branding', 'video-production', 'seo-paid-ads', 'social-media', 'multiple');
  ALTER TABLE "clients" ALTER COLUMN "service" SET DATA TYPE "public"."enum_clients_service" USING "service"::"public"."enum_clients_service";
  ALTER TABLE "_clients_v" ALTER COLUMN "version_service" SET DATA TYPE text;
  DROP TYPE "public"."enum__clients_v_version_service";
  CREATE TYPE "public"."enum__clients_v_version_service" AS ENUM('web-design', 'digital-marketing', 'branding', 'video-production', 'seo-paid-ads', 'social-media', 'multiple');
  ALTER TABLE "_clients_v" ALTER COLUMN "version_service" SET DATA TYPE "public"."enum__clients_v_version_service" USING "version_service"::"public"."enum__clients_v_version_service";
  ALTER TABLE "proposals" ALTER COLUMN "service" SET DATA TYPE text;
  DROP TYPE "public"."enum_proposals_service";
  CREATE TYPE "public"."enum_proposals_service" AS ENUM('web-design', 'digital-marketing', 'branding', 'video-production', 'seo-paid-ads', 'social-media', 'multiple');
  ALTER TABLE "proposals" ALTER COLUMN "service" SET DATA TYPE "public"."enum_proposals_service" USING "service"::"public"."enum_proposals_service";
  ALTER TABLE "journey_templates" ALTER COLUMN "service" SET DATA TYPE text;
  DROP TYPE "public"."enum_journey_templates_service";
  CREATE TYPE "public"."enum_journey_templates_service" AS ENUM('web-design', 'digital-marketing', 'branding', 'video-production', 'seo-paid-ads', 'social-media', 'multiple');
  ALTER TABLE "journey_templates" ALTER COLUMN "service" SET DATA TYPE "public"."enum_journey_templates_service" USING "service"::"public"."enum_journey_templates_service";
  ALTER TABLE "onboarding_guides" ALTER COLUMN "service" SET DATA TYPE text;
  DROP TYPE "public"."enum_onboarding_guides_service";
  CREATE TYPE "public"."enum_onboarding_guides_service" AS ENUM('web-design', 'digital-marketing', 'branding', 'video-production', 'seo-paid-ads', 'social-media', 'multiple');
  ALTER TABLE "onboarding_guides" ALTER COLUMN "service" SET DATA TYPE "public"."enum_onboarding_guides_service" USING "service"::"public"."enum_onboarding_guides_service";`)
}
