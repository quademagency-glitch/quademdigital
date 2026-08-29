import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
  Two things: a log of what each campaign email did, and a file an offer can
  hand over.

  Hand-written rather than generated, for the same reason as
  20260825_120000: two migrations from another session (case study metrics and
  the site address) are still sitting uncommitted in this working tree, and
  `migrate:create` diffs the whole in-code schema against the newest snapshot.
  Running it would bake both of those half-finished schemas into a snapshot
  committed from here.

  Settled on 2026-08-29: the snapshot was rebaselined once every session's work
  was committed, so this no longer re-emits and nothing needs trimming.

  IF NOT EXISTS and the duplicate_object guard throughout, because Railway
  replays migrations on every boot.
*/

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_campaign_events_event" AS ENUM(
        'delivered', 'opened', 'clicked', 'bounced', 'complained'
      );
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "campaign_events" (
      "id" serial PRIMARY KEY NOT NULL,
      "campaign_id" integer NOT NULL,
      "email" varchar NOT NULL,
      "subscriber_id" integer,
      "event" "enum_campaign_events_event" NOT NULL,
      "occurred_at" timestamp(3) with time zone,
      "link" varchar,
      "event_id" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  /*
    ON DELETE cascade on the campaign, not set null. The log is only meaningful
    beside the campaign it describes: rows pointing at a deleted campaign are
    unreadable and would keep the counts of a campaign that no longer exists.
    The subscriber is set null instead, because deleting a person should not
    erase the record that a campaign was opened.
  */
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_campaign_id_email_campaigns_id_fk"
        FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_subscriber_id_subscribers_id_fk"
        FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "campaign_events_campaign_idx" ON "campaign_events" USING btree ("campaign_id");
    CREATE INDEX IF NOT EXISTS "campaign_events_email_idx" ON "campaign_events" USING btree ("email");
    CREATE INDEX IF NOT EXISTS "campaign_events_subscriber_idx" ON "campaign_events" USING btree ("subscriber_id");
    CREATE INDEX IF NOT EXISTS "campaign_events_event_idx" ON "campaign_events" USING btree ("event");
    CREATE UNIQUE INDEX IF NOT EXISTS "campaign_events_event_id_idx" ON "campaign_events" USING btree ("event_id");
    CREATE INDEX IF NOT EXISTS "campaign_events_updated_at_idx" ON "campaign_events" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "campaign_events_created_at_idx" ON "campaign_events" USING btree ("created_at");
  `)

  // Payload's editing locks reach every collection, so a new one needs its
  // column here or the admin 500s the moment two tabs open the same document.
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "campaign_events_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_campaign_events_fk"
        FOREIGN KEY ("campaign_events_id") REFERENCES "public"."campaign_events"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_campaign_events_id_idx"
      ON "payload_locked_documents_rels" USING btree ("campaign_events_id");
  `)

  // The totals, counted from the log above.
  await db.execute(sql`
    ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "stats_delivered" numeric;
    ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "stats_opened" numeric;
    ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "stats_clicked" numeric;
    ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "stats_bounced" numeric;
    ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "stats_complained" numeric;
    ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "stats_last_event_at" timestamp(3) with time zone;
  `)

  // The file an offer hands over.
  await db.execute(sql`
    ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "deliverable_id" integer;
    ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "deliverable_label" varchar;

    DO $$ BEGIN
      ALTER TABLE "offers" ADD CONSTRAINT "offers_deliverable_id_media_id_fk"
        FOREIGN KEY ("deliverable_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "offers_deliverable_idx" ON "offers" USING btree ("deliverable_id");
  `)
}

/*
  Rehearsed as up/down/up/down, not just up. A generated down() has been wrong
  twice here: dropping a table with CASCADE also drops the constraints that
  reference it, and the next statement naming one of them then errors halfway
  through a rollback. IF EXISTS throughout, and the enum comes off last because
  it cannot be dropped while a column still uses it.
*/
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "offers" DROP CONSTRAINT IF EXISTS "offers_deliverable_id_media_id_fk";
    DROP INDEX IF EXISTS "offers_deliverable_idx";
    ALTER TABLE "offers" DROP COLUMN IF EXISTS "deliverable_id";
    ALTER TABLE "offers" DROP COLUMN IF EXISTS "deliverable_label";
  `)

  await db.execute(sql`
    ALTER TABLE "email_campaigns" DROP COLUMN IF EXISTS "stats_delivered";
    ALTER TABLE "email_campaigns" DROP COLUMN IF EXISTS "stats_opened";
    ALTER TABLE "email_campaigns" DROP COLUMN IF EXISTS "stats_clicked";
    ALTER TABLE "email_campaigns" DROP COLUMN IF EXISTS "stats_bounced";
    ALTER TABLE "email_campaigns" DROP COLUMN IF EXISTS "stats_complained";
    ALTER TABLE "email_campaigns" DROP COLUMN IF EXISTS "stats_last_event_at";
  `)

  await db.execute(sql`DROP TABLE IF EXISTS "campaign_events" CASCADE;`)

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_campaign_events_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_campaign_events_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "campaign_events_id";
  `)

  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_campaign_events_event";`)
}
