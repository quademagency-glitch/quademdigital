import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_documents_category" ADD VALUE 'payment-proof' BEFORE 'cv';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "documents" ALTER COLUMN "category" SET DATA TYPE text;
  DROP TYPE "public"."enum_documents_category";
  CREATE TYPE "public"."enum_documents_category" AS ENUM('handbook', 'price-sheet', 'script', 'pitch-example', 'brand', 'training', 'agreement', 'policy', 'cost-sheet', 'receipt', 'cv', 'other');
  ALTER TABLE "documents" ALTER COLUMN "category" SET DATA TYPE "public"."enum_documents_category" USING "category"::"public"."enum_documents_category";`)
}
