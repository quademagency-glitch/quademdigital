import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
  The document editor for electronic signing: text blanks as a kind of place,
  with what goes in each (label), what Ernest typed (value) and whether a
  signer must fill it (required), plus what each signer typed (texts).
  Generated in a clean copy of main on 2026-10-04 while another session had
  uncommitted collection changes in the shared folder, so it holds only these.
*/

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_signature_requests_places_kind" ADD VALUE 'text';
  ALTER TABLE "signature_requests_places" ADD COLUMN "label" varchar;
  ALTER TABLE "signature_requests_places" ADD COLUMN "value" varchar;
  ALTER TABLE "signature_requests_places" ADD COLUMN "required" boolean;
  ALTER TABLE "signing_sessions" ADD COLUMN "texts" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "signature_requests_places" ALTER COLUMN "kind" SET DATA TYPE text;
  DROP TYPE "public"."enum_signature_requests_places_kind";
  CREATE TYPE "public"."enum_signature_requests_places_kind" AS ENUM('signature', 'initials', 'name', 'date', 'title');
  ALTER TABLE "signature_requests_places" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_signature_requests_places_kind" USING "kind"::"public"."enum_signature_requests_places_kind";
  ALTER TABLE "signature_requests_places" DROP COLUMN "label";
  ALTER TABLE "signature_requests_places" DROP COLUMN "value";
  ALTER TABLE "signature_requests_places" DROP COLUMN "required";
  ALTER TABLE "signing_sessions" DROP COLUMN "texts";`)
}
