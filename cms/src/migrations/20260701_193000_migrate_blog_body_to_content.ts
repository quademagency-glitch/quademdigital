import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Copy body to content
    UPDATE "blog_posts" SET "content" = "body" WHERE "content" IS NULL AND "body" IS NOT NULL;
    UPDATE "_blog_posts_v" SET "version_content" = "version_body" WHERE "version_content" IS NULL AND "version_body" IS NOT NULL;
    
    -- Fallback missing seoDescription to excerpt
    UPDATE "blog_posts" SET "seo_description" = "excerpt" WHERE "seo_description" IS NULL AND "excerpt" IS NOT NULL;
    UPDATE "_blog_posts_v" SET "version_seo_description" = "version_excerpt" WHERE "version_seo_description" IS NULL AND "version_excerpt" IS NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Down migration could theoretically clear it, but it's safer to do nothing to avoid data loss.
  await db.execute(sql`
    -- Do nothing on rollback
  `)
}
