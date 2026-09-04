import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The column `20260904_150000_add_pitches` forgot.
 *
 * Payload keeps a lock on the document you are editing so two people cannot
 * save over each other, and it records that in `payload_locked_documents_rels`,
 * which carries one foreign key column per collection. A hand-written migration
 * that creates a table and stops there leaves that column missing, and the
 * generator would have emitted it.
 *
 * The cost was immediate and total: every delete, and every open of a pitch in
 * the admin, is a query against that table, so both answered
 *
 *   column payload_locked_documents_rels.pitches_id does not exist
 *
 * as a 500 with "Something went wrong." A pitch could be created and served and
 * then neither edited nor removed. Found by uploading one to production and
 * trying to delete it again, which is the only reason it was not found by
 * Ernest on his first real pitch.
 *
 * Separate migration rather than a fix to that one, because that one has
 * already run on production and a migration only ever runs once.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "pitches_id" integer;

  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pitches_fk" FOREIGN KEY ("pitches_id") REFERENCES "public"."pitches"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_pitches_id_idx" ON "payload_locked_documents_rels" USING btree ("pitches_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pitches_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_pitches_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "pitches_id";`)
}
