import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `pitch_assets`: the files that come with a dropped pitch folder.
 *
 * An upload collection, so it carries Payload's file columns, and unlike
 * `pitches` these files really are stored: they go to the pictures bucket
 * under a `pitch-assets/` prefix. `filename` keeps the unique index Payload's
 * own schema builds, and the folder endpoint names every file
 * `<pitchId>__<path with slashes replaced>` so that two pitches can both have
 * an images/hero.jpg.
 *
 * `payload_locked_documents_rels.pitch_assets_id` is in here, and it is the
 * whole reason to read this file before writing the next one by hand. Leaving
 * it out of the pitches migration on 4 September produced a collection that
 * could be created and read and then neither edited nor deleted, because both
 * of those query that table. See the note in cms/CLAUDE.md.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "pitch_assets" (
    "id" serial PRIMARY KEY NOT NULL,
    "pitch_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "prefix" varchar DEFAULT 'pitch-assets',
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

  DO $$ BEGIN
    ALTER TABLE "pitch_assets" ADD CONSTRAINT "pitch_assets_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "public"."pitches"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE INDEX IF NOT EXISTS "pitch_assets_pitch_idx" ON "pitch_assets" USING btree ("pitch_id");
  CREATE INDEX IF NOT EXISTS "pitch_assets_path_idx" ON "pitch_assets" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "pitch_assets_updated_at_idx" ON "pitch_assets" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "pitch_assets_created_at_idx" ON "pitch_assets" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "pitch_assets_filename_idx" ON "pitch_assets" USING btree ("filename");

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "pitch_assets_id" integer;

  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pitch_assets_fk" FOREIGN KEY ("pitch_assets_id") REFERENCES "public"."pitch_assets"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_pitch_assets_id_idx" ON "payload_locked_documents_rels" USING btree ("pitch_assets_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pitch_assets_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_pitch_assets_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "pitch_assets_id";
  DROP TABLE IF EXISTS "pitch_assets" CASCADE;`)
}
