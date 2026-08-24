import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The `redirects` collection, plus the rules that were already running.
 *
 * Before this, redirects lived in two production layers that nobody could edit
 * without a deploy: the `redirects` array in `vercel.json` (served as 308) and
 * `redirects` in `astro.config.mjs` (served as 301 by the Vercel adapter, so
 * despite its comment it was never dev-only). Every rule below was verified
 * live on 2026-08-24 before being copied here, so the collection starts out
 * matching what the site already did.
 *
 * `src/middleware.ts` on the site now serves these, and both old layers are
 * removed in the same commit. Only the www to apex rule stays in `vercel.json`.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_redirects_type" AS ENUM('permanent', 'temporary');
  CREATE TABLE "redirects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"from_path" varchar NOT NULL,
  	"to_path" varchar NOT NULL,
  	"type" "enum_redirects_type" DEFAULT 'permanent' NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "redirects_id" integer;
  CREATE UNIQUE INDEX "redirects_from_path_idx" ON "redirects" USING btree ("from_path");
  CREATE INDEX "redirects_updated_at_idx" ON "redirects" USING btree ("updated_at");
  CREATE INDEX "redirects_created_at_idx" ON "redirects" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_redirects_fk" FOREIGN KEY ("redirects_id") REFERENCES "public"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_redirects_id_idx" ON "payload_locked_documents_rels" USING btree ("redirects_id");`)

  /*
    Seed the rules that were already live. ON CONFLICT rather than a count
    guard so a re-run cannot duplicate a row and cannot undo a later edit:
    if Ernest has changed one of these in the admin, the change stands.
  */
  await db.execute(sql`
  INSERT INTO "redirects" ("from_path", "to_path", "type", "enabled", "note") VALUES
    ('/blog/nigerian-business-social-media-marketing', '/blog/ghanaian-business-social-media-marketing/', 'permanent', true, 'The post was rewritten for Ghana. The old address was indexed under the Nigerian title.'),
    ('/case-study-1', '/projects/revamping-online-store/', 'permanent', true, 'Numbered case study URL from the pre-2026 site.'),
    ('/case-study-2', '/projects/scaling-user-acquisition/', 'permanent', true, 'Numbered case study URL from the pre-2026 site.'),
    ('/case-study-3', '/projects/brand-identity-local-seo/', 'permanent', true, 'Numbered case study URL from the pre-2026 site.'),
    ('/store-manager', 'https://www.quaderp.app/', 'permanent', true, 'QuadERP moved to its own domain.'),
    ('/services/web-design-development', '/services/web-design/', 'permanent', true, 'The Services collection slug. The hand-built page is the one to rank, so the two must not compete.'),
    ('/services/branding-graphic-design', '/services/brand-identity/', 'permanent', true, 'The Services collection slug. The hand-built page is the one to rank, so the two must not compete.'),
    ('/services/seo-paid-ads', '/services/seo/', 'permanent', true, 'The Services collection slug. The hand-built page is the one to rank, so the two must not compete.'),
    ('/brand-studio', '/services/video-production/', 'permanent', true, 'Brand Studio was folded into the AI Video and Reels page on 2026-08-15.'),
    ('/services/branding--graphic-design', '/services/brand-identity/', 'permanent', true, 'Double-dash slug from the Sanity site. No service uses it now, but inbound links may still exist.'),
    ('/services/web-design--development', '/services/web-design/', 'permanent', true, 'Double-dash slug from the Sanity site. No service uses it now, but inbound links may still exist.'),
    ('/services/digital-marketing--social-media', '/services/seo/', 'permanent', true, 'Double-dash slug from the Sanity site. No service uses it now, but inbound links may still exist.'),
    ('/services/seo--paid-ads', '/services/seo/', 'permanent', true, 'Double-dash slug from the Sanity site. No service uses it now, but inbound links may still exist.')
  ON CONFLICT ("from_path") DO NOTHING;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "redirects" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "redirects" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_redirects_fk";
  
  DROP INDEX "payload_locked_documents_rels_redirects_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "redirects_id";
  DROP TYPE "public"."enum_redirects_type";`)
}
