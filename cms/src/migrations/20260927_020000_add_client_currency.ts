import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "currency" varchar;
    ALTER TABLE "_clients_v" ADD COLUMN IF NOT EXISTS "version_currency" varchar;`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "clients" DROP COLUMN IF EXISTS "currency";
    ALTER TABLE "_clients_v" DROP COLUMN IF EXISTS "version_currency";`)
}
