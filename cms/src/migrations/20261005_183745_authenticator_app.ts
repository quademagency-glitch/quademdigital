import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_two_step_method" AS ENUM('email', 'app');
  ALTER TABLE "users" ADD COLUMN "two_step_method" "enum_users_two_step_method" DEFAULT 'email';
  ALTER TABLE "users" ADD COLUMN "two_step_app_since" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "totp_secret" varchar;
  ALTER TABLE "users" ADD COLUMN "totp_pending" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "two_step_method";
  ALTER TABLE "users" DROP COLUMN "two_step_app_since";
  ALTER TABLE "users" DROP COLUMN "totp_secret";
  ALTER TABLE "users" DROP COLUMN "totp_pending";
  DROP TYPE "public"."enum_users_two_step_method";`)
}
