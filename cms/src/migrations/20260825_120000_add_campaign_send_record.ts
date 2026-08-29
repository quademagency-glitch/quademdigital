import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
  What a campaign actually did, recorded on the campaign.

  EmailCampaigns held a subject and a body. The thing that sent email never read
  it and never wrote back, so there was no answer to "who received this", "when
  did it go" or "did it go at all", and the AI drafts landed in a collection
  nothing could send from.

  Hand-written rather than generated, deliberately. Two other migrations were
  sitting uncommitted in this working tree on 2026-08-25 (case study metrics and
  the site address), and `migrate:create` diffs the whole of the in-code schema
  against the newest snapshot: running it would have baked both of those
  half-finished schemas into a snapshot committed from here, and produced a
  three-way tangle in index.ts. Four scalar columns and one enum are small
  enough to write by hand and safer than that.

  Settled on 2026-08-29: the snapshot was rebaselined once every session's work
  was committed, so this no longer re-emits and nothing needs trimming.

  IF NOT EXISTS and the duplicate_object guard throughout, because Railway
  replays migrations on every boot.
*/

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_email_campaigns_segment" AS ENUM(
        'all', 'seo', 'web-design', 'brand-identity', 'video', 'test'
      );
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)

  await db.execute(sql`
    ALTER TABLE "email_campaigns"
      ADD COLUMN IF NOT EXISTS "segment" "enum_email_campaigns_segment" DEFAULT 'all';
    ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "sent_at" timestamp(3) with time zone;
    ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "recipient_count" numeric;
    ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "send_log" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "email_campaigns" DROP COLUMN IF EXISTS "segment";
    ALTER TABLE "email_campaigns" DROP COLUMN IF EXISTS "sent_at";
    ALTER TABLE "email_campaigns" DROP COLUMN IF EXISTS "recipient_count";
    ALTER TABLE "email_campaigns" DROP COLUMN IF EXISTS "send_log";
  `)

  // After the column, never before: the type cannot be dropped while a column
  // still uses it, and dropping it first is how a rollback fails halfway.
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_email_campaigns_segment";`)
}
