import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * All blog posts were migrated from Sanity directly into the database,
 * bypassing Payload's beforeChange hooks. As a result they all have
 * _status='draft'. The admin list view filters for published posts by
 * default, so the list appears empty. This migration publishes them all.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "blog_posts" SET "_status" = 'published' WHERE "_status" = 'draft';
   UPDATE "_blog_posts_v" SET "version__status" = 'published' WHERE "version__status" = 'draft';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // No-op: we cannot reliably determine which posts were originally drafts
}
