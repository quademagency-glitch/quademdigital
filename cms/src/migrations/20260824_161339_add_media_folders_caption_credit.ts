import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Folders on the media library, plus caption and credit, and the removal of
 * the two stub collections folders replace.
 *
 * 113 files in one flat list was the whole of the library's organisation.
 * `folders: true` on the Media collection gives Payload's own folder tree and
 * Browse by Folder view.
 *
 * `folders` and `tags` were one-field stub collections with no rows and
 * nothing relating to them. Both are dropped here: folders covers what they
 * were reaching for, and two half-built systems are worse than one that works.
 * `down()` recreates them, empty, exactly as they were.
 *
 * Generating this needed the documented snapshot dance from CLAUDE.md, twice.
 * With `payload_folders*` appearing while `folders` and `tags` disappear,
 * drizzle-kit asks "is this a rename?" and blocks forever in a non-interactive
 * shell. Both tables were stripped from the baseline first, and then so were
 * the `folders_id` and `tags_id` columns on `payload_locked_documents_rels`,
 * which collided the same way one level down. The drops below are therefore
 * hand-written; everything above them is generated.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_payload_folders_folder_type" AS ENUM('media');
  CREATE TABLE "payload_folders_folder_type" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_payload_folders_folder_type",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload_folders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "media" ADD COLUMN "caption" varchar;
  ALTER TABLE "media" ADD COLUMN "credit" varchar;
  ALTER TABLE "media" ADD COLUMN "folder_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payload_folders_id" integer;
  ALTER TABLE "payload_folders_folder_type" ADD CONSTRAINT "payload_folders_folder_type_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_folders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_folders" ADD CONSTRAINT "payload_folders_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "payload_folders_folder_type_order_idx" ON "payload_folders_folder_type" USING btree ("order");
  CREATE INDEX "payload_folders_folder_type_parent_idx" ON "payload_folders_folder_type" USING btree ("parent_id");
  CREATE INDEX "payload_folders_name_idx" ON "payload_folders" USING btree ("name");
  CREATE INDEX "payload_folders_folder_idx" ON "payload_folders" USING btree ("folder_id");
  CREATE INDEX "payload_folders_updated_at_idx" ON "payload_folders" USING btree ("updated_at");
  CREATE INDEX "payload_folders_created_at_idx" ON "payload_folders" USING btree ("created_at");
  ALTER TABLE "media" ADD CONSTRAINT "media_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_folders_fk" FOREIGN KEY ("payload_folders_id") REFERENCES "public"."payload_folders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "media_folder_idx" ON "media" USING btree ("folder_id");
  CREATE INDEX "payload_locked_documents_rels_payload_folders_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_folders_id");`)

  /*
    Hand-written: the stub collections. Suppressed from the generated diff by
    the baseline strip described above, so they have to be said explicitly.
    Both are empty, so nothing is lost.
  */
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_folders_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_tags_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_folders_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_tags_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "folders_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "tags_id";
  DROP TABLE IF EXISTS "folders" CASCADE;
  DROP TABLE IF EXISTS "tags" CASCADE;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  /*
    IF EXISTS throughout, because the generated order is not self-consistent:
    it drops payload_folders with CASCADE, which already takes the media
    foreign key with it, and then tries to drop that key by name and errors.
    Caught by rehearsing down() rather than only up().
  */
  await db.execute(sql`
   ALTER TABLE "payload_folders_folder_type" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_folders" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "payload_folders_folder_type" CASCADE;
  DROP TABLE IF EXISTS "payload_folders" CASCADE;
  ALTER TABLE "media" DROP CONSTRAINT IF EXISTS "media_folder_id_payload_folders_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_payload_folders_fk";
  
  DROP INDEX IF EXISTS "media_folder_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_payload_folders_id_idx";
  ALTER TABLE "media" DROP COLUMN IF EXISTS "caption";
  ALTER TABLE "media" DROP COLUMN IF EXISTS "credit";
  ALTER TABLE "media" DROP COLUMN IF EXISTS "folder_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "payload_folders_id";
  DROP TYPE IF EXISTS "public"."enum_payload_folders_folder_type";`)

  // Hand-written: put the two stub collections back, empty, as they were.
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "folders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE INDEX IF NOT EXISTS "folders_updated_at_idx" ON "folders" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "folders_created_at_idx" ON "folders" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "tags_updated_at_idx" ON "tags" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "tags_created_at_idx" ON "tags" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "folders_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "tags_id" integer;
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_folders_id_idx" ON "payload_locked_documents_rels" USING btree ("folders_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_tags_id_idx" ON "payload_locked_documents_rels" USING btree ("tags_id");`)
}
