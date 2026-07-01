import { NextResponse } from 'next/server'
import { Client } from 'pg'

export const dynamic = 'force-dynamic'

export async function GET() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('sslmode=disable') ? undefined : { rejectUnauthorized: false }
  })
  try {
    await client.connect()
    const res = await client.query(`
      select "id", "parent_id", "version_title", "version_slug", "version_excerpt", "version_linked_in_post", "version_cover_image_id", "version_category_id", "version_body", "version_content", "version_published_at", "version_author", "version_seo_description", "version_updated_at", "version_created_at", "version__status", "created_at", "updated_at", "snapshot", "published_locale", "latest" from "_blog_posts_v" "_blog_posts_v" where "_blog_posts_v"."latest" = true order by "_blog_posts_v"."version_created_at" desc, "_blog_posts_v"."created_at" desc limit 1
    `)
    await client.end()
    return NextResponse.json({ success: true, res: res.rows })
  } catch (error: any) {
    return NextResponse.json({ success: false, pg_error: error.message, code: error.code })
  }
}
