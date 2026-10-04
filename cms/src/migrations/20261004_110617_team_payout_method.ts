import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_payout_method" AS ENUM('grey', 'bank', 'mobile-money');
  ALTER TABLE "users" ADD COLUMN "payout_method" "enum_users_payout_method" DEFAULT 'grey';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "payout_method";
  DROP TYPE "public"."enum_users_payout_method";`)
}
