import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Google Drive folders for new clients (lib/googleDrive.ts): the connection record and each client's folder link. Safe to run twice.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "google_drive" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar,
  	"refresh_token" varchar,
  	"root_folder_id" varchar,
  	"root_folder_url" varchar,
  	"connected_at" timestamp(3) with time zone,
  	"last_error" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "drive_folder_url" varchar;
  ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "drive_folder_folder_id" varchar;
  ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "drive_folder_made_at" timestamp(3) with time zone;
  ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "drive_folder_problem" varchar;
  ALTER TABLE "_clients_v" ADD COLUMN IF NOT EXISTS "version_drive_folder_url" varchar;
  ALTER TABLE "_clients_v" ADD COLUMN IF NOT EXISTS "version_drive_folder_folder_id" varchar;
  ALTER TABLE "_clients_v" ADD COLUMN IF NOT EXISTS "version_drive_folder_made_at" timestamp(3) with time zone;
  ALTER TABLE "_clients_v" ADD COLUMN IF NOT EXISTS "version_drive_folder_problem" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE IF EXISTS "google_drive" CASCADE;
  ALTER TABLE "clients" DROP COLUMN IF EXISTS "drive_folder_url";
  ALTER TABLE "clients" DROP COLUMN IF EXISTS "drive_folder_folder_id";
  ALTER TABLE "clients" DROP COLUMN IF EXISTS "drive_folder_made_at";
  ALTER TABLE "clients" DROP COLUMN IF EXISTS "drive_folder_problem";
  ALTER TABLE "_clients_v" DROP COLUMN IF EXISTS "version_drive_folder_url";
  ALTER TABLE "_clients_v" DROP COLUMN IF EXISTS "version_drive_folder_folder_id";
  ALTER TABLE "_clients_v" DROP COLUMN IF EXISTS "version_drive_folder_made_at";
  ALTER TABLE "_clients_v" DROP COLUMN IF EXISTS "version_drive_folder_problem";`)
}
