import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "content" jsonb;
   ALTER TABLE "_blog_posts_v" ADD COLUMN IF NOT EXISTS "version_content" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "_blog_posts_v" DROP COLUMN IF EXISTS "version_content";
   ALTER TABLE "blog_posts" DROP COLUMN IF EXISTS "content";`)
}
