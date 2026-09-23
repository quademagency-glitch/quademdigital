import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Additive only: existing client content, history and media relationships stay.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "media_sizes_thumbnail_avif_sizes_thumbnail_avif_filename_idx" ON "media" ("sizes_thumbnail_avif_filename");
    ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "onboarding_status" varchar;
    ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "onboarding_state" jsonb;
    ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "retry_onboarding" boolean DEFAULT false;
    ALTER TABLE "_clients_v" ADD COLUMN IF NOT EXISTS "version_onboarding_status" varchar;
    ALTER TABLE "_clients_v" ADD COLUMN IF NOT EXISTS "version_onboarding_state" jsonb;
    ALTER TABLE "_clients_v" ADD COLUMN IF NOT EXISTS "version_retry_onboarding" boolean DEFAULT false;
    ALTER TABLE "onboarding_documents" ADD COLUMN IF NOT EXISTS "automation_key" varchar;
    CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_documents_automation_key_idx" ON "onboarding_documents" ("automation_key");
    ALTER TABLE "payload_jobs" ADD COLUMN IF NOT EXISTS "concurrency_key" varchar;
    CREATE INDEX IF NOT EXISTS "payload_jobs_concurrency_key_idx" ON "payload_jobs" ("concurrency_key");
    ALTER TYPE "enum_payload_jobs_task_slug" ADD VALUE IF NOT EXISTS 'clientOnboarding' BEFORE 'schedulePublish';
    ALTER TYPE "enum_payload_jobs_log_task_slug" ADD VALUE IF NOT EXISTS 'clientOnboarding' BEFORE 'schedulePublish';
    ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "hero_presentation_heading" varchar DEFAULT 'Make your business';
    ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "hero_presentation_accent" varchar DEFAULT 'the clear choice.';
    ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "hero_presentation_body" varchar DEFAULT 'A sharper brand. A better website. A clearer path from first impression to enquiry.';
    ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "hero_presentation_note" varchar;
    ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "hero_presentation_image_id" integer;
    ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "hero_presentation_caption" varchar;
    ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "hero_presentation_credit" varchar;
    DO $$ BEGIN
      ALTER TABLE "homepage" ADD CONSTRAINT "homepage_hero_presentation_image_id_media_id_fk"
        FOREIGN KEY ("hero_presentation_image_id") REFERENCES "media"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "homepage_hero_presentation_hero_presentation_image_idx" ON "homepage" ("hero_presentation_image_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Keep audit records and delivery keys during an application rollback.
  // Older code ignores these nullable/additive fields. Removing them would
  // discard the evidence that stops accepted emails being sent twice.
  await db.execute(sql`SELECT 1`)
}
