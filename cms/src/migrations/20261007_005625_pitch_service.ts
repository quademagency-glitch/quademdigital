import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pitches_service" AS ENUM('web-design', 'digital-marketing', 'branding', 'video-production', 'seo-paid-ads', 'social-media', 'multiple', 'custom');
  ALTER TABLE "pitches" ADD COLUMN "service" "enum_pitches_service";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pitches" DROP COLUMN "service";
  DROP TYPE "public"."enum_pitches_service";`)
}
