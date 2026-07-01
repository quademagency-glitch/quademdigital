import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "_blog_posts_v" ADD COLUMN IF NOT EXISTS "snapshot" boolean;
    ALTER TABLE "_blog_posts_v" ADD COLUMN IF NOT EXISTS "published_locale" varchar;
    ALTER TABLE "_blog_posts_v" ADD COLUMN IF NOT EXISTS "latest" boolean;
    ALTER TABLE "_blog_posts_v" ADD COLUMN IF NOT EXISTS "autosave" boolean;
    
    ALTER TABLE "_pages_v" ADD COLUMN IF NOT EXISTS "snapshot" boolean;
    ALTER TABLE "_pages_v" ADD COLUMN IF NOT EXISTS "published_locale" varchar;
    ALTER TABLE "_pages_v" ADD COLUMN IF NOT EXISTS "latest" boolean;
    ALTER TABLE "_pages_v" ADD COLUMN IF NOT EXISTS "autosave" boolean;
    
    UPDATE "_blog_posts_v" SET "latest" = true WHERE "latest" IS NULL;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "_blog_posts_v" DROP COLUMN IF EXISTS "snapshot";
    ALTER TABLE "_pages_v" DROP COLUMN IF EXISTS "snapshot";
  `)
}
