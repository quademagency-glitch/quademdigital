import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
  Where an onboarding document came from, and when it went out.

  The client-won automation writes a Service Agreement, a Welcome Pack and a
  set of Setup Instructions, emails them, and throws the files away. So the
  only copy of a signed-for-nothing agreement was in a sent-mail folder, and
  the CMS could not answer "what exactly did I send this client".

  It files them here instead, in the private bucket the documents collection
  already uses. `origin` is what stops the AI draft hook running on them: a
  document uploaded by hand needs a covering email written, and one the
  automation produced already has one.

  Hand-written, same reason as the three before it: two migrations from another
  session are still uncommitted here and migrate:create would fold their
  half-finished schema into a snapshot committed from this tree.
*/

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_onboarding_documents_origin" AS ENUM('by-hand', 'automation');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)

  await db.execute(sql`
    ALTER TABLE "onboarding_documents"
      ADD COLUMN IF NOT EXISTS "origin" "enum_onboarding_documents_origin" DEFAULT 'by-hand';
    ALTER TABLE "onboarding_documents"
      ADD COLUMN IF NOT EXISTS "sent_to_client_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "onboarding_documents" DROP COLUMN IF EXISTS "origin";
    ALTER TABLE "onboarding_documents" DROP COLUMN IF EXISTS "sent_to_client_at";
  `)

  // After the column, never before: a type in use cannot be dropped, and
  // dropping it first is how a rollback fails halfway.
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_onboarding_documents_origin";`)
}
