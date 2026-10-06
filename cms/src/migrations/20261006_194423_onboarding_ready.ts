import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_onboarding_guides_service" AS ENUM('web-design', 'digital-marketing', 'branding', 'video-production', 'seo-paid-ads', 'social-media', 'multiple');
  ALTER TABLE "journey_templates" ADD COLUMN "ready" boolean DEFAULT true;
  ALTER TABLE "onboarding_guides" ADD COLUMN "service" "enum_onboarding_guides_service";
  ALTER TABLE "onboarding_guides" ADD COLUMN "is_default" boolean DEFAULT false;
  ALTER TABLE "onboarding_guides" ADD COLUMN "ready" boolean DEFAULT true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "journey_templates" DROP COLUMN "ready";
  ALTER TABLE "onboarding_guides" DROP COLUMN "service";
  ALTER TABLE "onboarding_guides" DROP COLUMN "is_default";
  ALTER TABLE "onboarding_guides" DROP COLUMN "ready";
  DROP TYPE "public"."enum_onboarding_guides_service";`)
}
