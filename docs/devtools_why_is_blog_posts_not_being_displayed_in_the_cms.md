# Why are Blog Posts not being displayed in the CMS?

## Issue Summary
The user imported 8 Blog Posts directly from Sanity CMS, which correctly inserted rows into the Postgres `blog_posts` table. However, when navigating to `/admin/collections/blogPosts` in the Payload CMS dashboard, the list appeared completely empty ("No Blog Posts found" or a blank list), even though the dashboard stats card accurately reported "8 Blog Posts".

## Root Cause Analysis
We discovered two distinct issues working in tandem to prevent the blog posts from displaying:

1. **Missing Draft Versions (`_status`)**: 
   When the posts were migrated directly to the database, they bypassed Payload's `autoPublishCollectionHook` and their `_status` was set to `draft`. The default admin view for a draft-enabled collection filters for published posts or attempts to look up the latest version in the version table.
   *Resolution*: We wrote a migration (`20260701_060000_publish_draft_blog_posts.ts`) to bulk-update the `_status` to `'published'` for both the main and version tables.

2. **Fatal Database Error on Draft Queries (`snapshot` Column)**: 
   Even after fixing the draft status, the admin list view still crashed silently. By directly hooking into the Postgres instance and bypassing Payload's generic "500 Internal Server Error" wrapper, we found that Payload 3.x was attempting to query a `snapshot` column from the `_blog_posts_v` versions table:
   `error: column "snapshot" does not exist`
   
   The production database had been initialized on an earlier version of Payload where `snapshot` versioning was not yet implemented in the schema. As a result, anytime Payload attempted to load the admin list view for a draft-enabled collection (which queries the versions table underneath), it crashed the server-rendered React Server Component entirely.

## Final Resolution
We created and ran a final migration (`20260701_190000_add_missing_snapshot_columns.ts`) to safely add the missing `snapshot`, `latest`, `autosave`, and `published_locale` columns to all version tables (`_blog_posts_v` and `_pages_v`). 

After deploying this migration, the underlying SQL queries executed successfully, the 500 errors disappeared, and all 8 Blog Posts now correctly display in the Admin CMS interface.