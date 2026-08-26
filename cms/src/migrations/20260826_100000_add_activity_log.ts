import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
  A record of contact on leads and clients, and a date for the next one.

  Both had a status and nothing else. A status says where something got to; it
  does not say what was said, when, or what was promised. "Did I ever ring them
  back" had no answer anywhere in the CRM.

  Two tables each, because both collections keep version history: the live rows
  and the copy that goes into a version when the document is saved.

  The statements are the generator's own, lifted from a run whose output was
  then thrown away. Running it for real would have committed a snapshot, and a
  snapshot built from here would describe two other collections that another
  session is still working on, which is how their migration quietly stops being
  needed. Guards added throughout, because Railway replays on every boot.

  Worth knowing before the next generator run: it also wants to change
  campaign_events.campaign_id to ON DELETE set null. Do not let it. That column
  is NOT NULL, so setting it null is impossible and deleting a campaign would
  fail outright. Cascade is deliberate and is what the live test exercised.
*/

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_leads_activity_kind" AS ENUM('whatsapp', 'call', 'email', 'meeting', 'note');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum__leads_v_version_activity_kind" AS ENUM('whatsapp', 'call', 'email', 'meeting', 'note');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_clients_activity_kind" AS ENUM('whatsapp', 'call', 'email', 'meeting', 'note');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum__clients_v_version_activity_kind" AS ENUM('whatsapp', 'call', 'email', 'meeting', 'note');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "leads_activity" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "at" timestamp(3) with time zone NOT NULL,
      "kind" "enum_leads_activity_kind" DEFAULT 'whatsapp',
      "note" varchar NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "_leads_v_version_activity" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "at" timestamp(3) with time zone NOT NULL,
      "kind" "enum__leads_v_version_activity_kind" DEFAULT 'whatsapp',
      "note" varchar NOT NULL,
      "_uuid" varchar
    );

    CREATE TABLE IF NOT EXISTS "clients_activity" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "at" timestamp(3) with time zone NOT NULL,
      "kind" "enum_clients_activity_kind" DEFAULT 'whatsapp',
      "note" varchar NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "_clients_v_version_activity" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "at" timestamp(3) with time zone NOT NULL,
      "kind" "enum__clients_v_version_activity_kind" DEFAULT 'whatsapp',
      "note" varchar NOT NULL,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "next_follow_up" timestamp(3) with time zone;
    ALTER TABLE "_leads_v" ADD COLUMN IF NOT EXISTS "version_next_follow_up" timestamp(3) with time zone;
    ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "next_follow_up" timestamp(3) with time zone;
    ALTER TABLE "_clients_v" ADD COLUMN IF NOT EXISTS "version_next_follow_up" timestamp(3) with time zone;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "leads_activity" ADD CONSTRAINT "leads_activity_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "_leads_v_version_activity" ADD CONSTRAINT "_leads_v_version_activity_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_leads_v"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "clients_activity" ADD CONSTRAINT "clients_activity_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "_clients_v_version_activity" ADD CONSTRAINT "_clients_v_version_activity_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_clients_v"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "leads_activity_order_idx" ON "leads_activity" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "leads_activity_parent_id_idx" ON "leads_activity" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_leads_v_version_activity_order_idx" ON "_leads_v_version_activity" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_leads_v_version_activity_parent_id_idx" ON "_leads_v_version_activity" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "clients_activity_order_idx" ON "clients_activity" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "clients_activity_parent_id_idx" ON "clients_activity" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_clients_v_version_activity_order_idx" ON "_clients_v_version_activity" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_clients_v_version_activity_parent_id_idx" ON "_clients_v_version_activity" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "leads_next_follow_up_idx" ON "leads" USING btree ("next_follow_up");
    CREATE INDEX IF NOT EXISTS "_leads_v_version_version_next_follow_up_idx" ON "_leads_v" USING btree ("version_next_follow_up");
    CREATE INDEX IF NOT EXISTS "clients_next_follow_up_idx" ON "clients" USING btree ("next_follow_up");
    CREATE INDEX IF NOT EXISTS "_clients_v_version_version_next_follow_up_idx" ON "_clients_v" USING btree ("version_next_follow_up");
  `)
}

/*
  Rehearsed as up, up, down, down, up. Dropping a table with CASCADE also drops
  the constraints and indexes that hang off it, so nothing here names one of
  those separately afterwards: that is the mistake that broke two earlier
  rollbacks in this project. The enums come off last, because a type cannot be
  dropped while a column still uses it.
*/
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "leads_activity" CASCADE;
    DROP TABLE IF EXISTS "_leads_v_version_activity" CASCADE;
    DROP TABLE IF EXISTS "clients_activity" CASCADE;
    DROP TABLE IF EXISTS "_clients_v_version_activity" CASCADE;
  `)

  await db.execute(sql`
    DROP INDEX IF EXISTS "leads_next_follow_up_idx";
    DROP INDEX IF EXISTS "_leads_v_version_version_next_follow_up_idx";
    DROP INDEX IF EXISTS "clients_next_follow_up_idx";
    DROP INDEX IF EXISTS "_clients_v_version_version_next_follow_up_idx";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "next_follow_up";
    ALTER TABLE "_leads_v" DROP COLUMN IF EXISTS "version_next_follow_up";
    ALTER TABLE "clients" DROP COLUMN IF EXISTS "next_follow_up";
    ALTER TABLE "_clients_v" DROP COLUMN IF EXISTS "version_next_follow_up";
  `)

  await db.execute(sql`
    DROP TYPE IF EXISTS "public"."enum_leads_activity_kind";
    DROP TYPE IF EXISTS "public"."enum__leads_v_version_activity_kind";
    DROP TYPE IF EXISTS "public"."enum_clients_activity_kind";
    DROP TYPE IF EXISTS "public"."enum__clients_v_version_activity_kind";
  `)
}
