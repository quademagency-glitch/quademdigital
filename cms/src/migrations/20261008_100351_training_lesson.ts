import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "training_modules" ADD COLUMN "lesson" varchar;
  ALTER TABLE "training_modules" ADD COLUMN "minutes" numeric;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "training_modules" DROP COLUMN "lesson";
  ALTER TABLE "training_modules" DROP COLUMN "minutes";`)
}
