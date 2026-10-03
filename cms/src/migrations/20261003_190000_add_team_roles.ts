import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
  Three more roles for the team portal: site (the website's own account), team
  (team members) and integration (the WhatsApp and briefing imports). What each
  can reach is in src/access/roles.ts.

  This only adds the values; it moves no account. The website's account is moved
  onto `site` by hand in Users, and editors keep the website's access until it
  has (WEBSITE in src/access/roles.ts).

  The column default drops from admin to editor, so an account created without
  a role is the least it can be rather than the most.
*/
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_users_role" ADD VALUE IF NOT EXISTS 'site';
    ALTER TYPE "public"."enum_users_role" ADD VALUE IF NOT EXISTS 'team';
    ALTER TYPE "public"."enum_users_role" ADD VALUE IF NOT EXISTS 'integration';
    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'editor';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Postgres cannot drop an enum value, so the type is rebuilt with the two it
  // had. Anyone on a new role goes back to editor first.
  await db.execute(sql`
    UPDATE "users" SET "role" = 'editor' WHERE "role"::text IN ('site', 'team', 'integration');
    ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "users" ALTER COLUMN "role" TYPE text;
    DROP TYPE "public"."enum_users_role";
    CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor');
    ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";
    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'admin';
  `)
}
