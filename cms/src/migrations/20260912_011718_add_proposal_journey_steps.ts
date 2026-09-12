import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The journey a proposal carries for its own client.
 *
 * `20260912_001937` gave every service one journey template and copied it onto
 * the client. That is the wrong unit: two web design jobs sold off the same
 * page differ by a content migration, a photoshoot and three weeks of scope,
 * and a template flattens all of it into the same five steps. So the steps are
 * now drafted from the proposal itself and sit on the proposal, editable,
 * before anything is created. The templates stay as the fallback for a PDF that
 * could not be read.
 *
 * Generated clean this time, because the previous migration kept its snapshot,
 * and then made idempotent by hand per cms/CLAUDE.md.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
    CREATE TYPE "public"."enum_proposals_journey_steps_owner" AS ENUM('quadem', 'client');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_proposals_journey_steps_stage" AS ENUM('onboarding', 'design', 'development', 'review', 'completed', 'retainer');
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE TABLE IF NOT EXISTS "proposals_journey_steps" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "title" varchar NOT NULL,
    "detail" varchar,
    "owner" "enum_proposals_journey_steps_owner" DEFAULT 'quadem',
    "stage" "enum_proposals_journey_steps_stage" DEFAULT 'onboarding',
    "due_offset_days" numeric DEFAULT 0,
    "client_visible" boolean DEFAULT true
  );

  DO $$ BEGIN
    ALTER TABLE "proposals_journey_steps" ADD CONSTRAINT "proposals_journey_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE INDEX IF NOT EXISTS "proposals_journey_steps_order_idx" ON "proposals_journey_steps" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "proposals_journey_steps_parent_id_idx" ON "proposals_journey_steps" USING btree ("_parent_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "proposals_journey_steps" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_proposals_journey_steps_owner";
  DROP TYPE IF EXISTS "public"."enum_proposals_journey_steps_stage";`)
}
