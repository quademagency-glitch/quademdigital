import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The `pitches` table: sample sites sent to prospects, served by the site at
 * /pitch/<slug>/ and never indexed. See cms/src/collections/Pitches.ts.
 *
 * It is an upload collection, so it carries Payload's file columns even though
 * `disableLocalStorage` means no file is ever written: the row records what was
 * dropped, and `html` holds the document itself. `filename` keeps its unique
 * index, matching what Payload's own schema builds, and the collection renames
 * every incoming file so two pitches dropped as `index.html` cannot collide.
 *
 * `html` is `varchar` with no length, which is what the Postgres adapter emits
 * for a `code` field and is Postgres `text` in all but name.
 *
 * Hand-written rather than generated: there was uncommitted collection work in
 * the tree at the time, and `migrate:create` diffs the whole in-code schema, so
 * a generated file would have carried somebody else's half-finished columns.
 * Idempotent throughout, per the rule in cms/CLAUDE.md.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "pitches" (
    "id" serial PRIMARY KEY NOT NULL,
    "title" varchar NOT NULL,
    "slug" varchar NOT NULL,
    "client_id" integer,
    "live" boolean DEFAULT true,
    "expires_at" timestamp(3) with time zone,
    "html" varchar,
    "notes" varchar,
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
    ALTER TABLE "pitches" ADD CONSTRAINT "pitches_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE UNIQUE INDEX IF NOT EXISTS "pitches_slug_idx" ON "pitches" USING btree ("slug");
  CREATE INDEX IF NOT EXISTS "pitches_client_idx" ON "pitches" USING btree ("client_id");
  CREATE INDEX IF NOT EXISTS "pitches_updated_at_idx" ON "pitches" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "pitches_created_at_idx" ON "pitches" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "pitches_filename_idx" ON "pitches" USING btree ("filename");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "pitches" CASCADE;`)
}
