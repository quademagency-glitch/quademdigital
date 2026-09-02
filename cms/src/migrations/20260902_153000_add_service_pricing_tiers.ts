import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
  Prices for the services rendered from the Services collection.

  WHY

  AI Automation and Digital Marketing showed no price anywhere on the site.
  Not a wrong figure: no figure, on two of the seven things Quadem sells. They
  render from src/pages/services/[slug].astro, which had nothing to read a price
  from, because the other four services keep theirs in a CMS global each and
  Fieldwork keeps its own typed into the page file.

  This adds the same pricingSection shape those globals use to the collection, so
  every service can carry a price and scripts/pricing-audit.mjs can read them all
  the same way.

  WHAT WAS TRIMMED OUT OF THE GENERATED FILE, AND WHY IT MATTERS

  `pnpm migrate:create` emitted three extra statements at the top of up():

      ALTER TYPE "enum_homepage_promo_sections_visual" ADD VALUE 'aiAutomation';
      ALTER TYPE ... ADD VALUE 'fieldwork';
      ALTER TYPE ... ADD VALUE 'digitalMarketing';

  Those three values are already in production. They were added on 1 September by
  20260901_094500 and 20260901_101500, and the schema snapshot had not caught up.
  ADD VALUE without IF NOT EXISTS errors on a value that exists, and one failed
  statement aborts the whole migration, so leaving them in means this file never
  runs and the pricing tables are never created.

  The generated down() was worse. It dropped that enum type and recreated it with
  only the original four values, which would have deleted the three homepage promo
  cards added on 1 September. A down() is supposed to undo this migration, not a
  different one. Both sections are removed.

  THE PART THE GENERATOR GOT RIGHT, WHICH IS EASY TO GET WRONG BY HAND

  Both array side tables use `id varchar PRIMARY KEY`, not `id serial`. Payload
  writes 24 character hex ids into that column. With an integer column every array
  row is rejected and the tiers render empty with no error anywhere.

  The nested table's `_parent_id` is varchar because it points at a plan row's
  varchar id; the outer one is integer because it points at services.id.

  AFTER THIS RUNS, IT IS STILL HALF THE JOB

  `pnpm migrate` from a laptop hits production Postgres. The Payload app on Railway
  is a separate deploy, and until it ships with the updated Services.ts it does not
  know these fields exist: it strips them from writes and omits them from reads,
  silently, answering 200 the whole time.
*/

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE "services_pricing_section_plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );

  CREATE TABLE "services_pricing_section_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"price" varchar NOT NULL,
  	"price_usd" varchar,
  	"period" varchar,
  	"description" varchar,
  	"is_popular" boolean DEFAULT false
  );

  ALTER TABLE "services" ADD COLUMN "pricing_section_heading" varchar;
  ALTER TABLE "services" ADD COLUMN "pricing_section_subtitle" varchar;
  ALTER TABLE "services" ADD COLUMN "pricing_section_note" varchar;
  ALTER TABLE "services_pricing_section_plans_features" ADD CONSTRAINT "services_pricing_section_plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services_pricing_section_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "services_pricing_section_plans" ADD CONSTRAINT "services_pricing_section_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "services_pricing_section_plans_features_order_idx" ON "services_pricing_section_plans_features" USING btree ("_order");
  CREATE INDEX "services_pricing_section_plans_features_parent_id_idx" ON "services_pricing_section_plans_features" USING btree ("_parent_id");
  CREATE INDEX "services_pricing_section_plans_order_idx" ON "services_pricing_section_plans" USING btree ("_order");
  CREATE INDEX "services_pricing_section_plans_parent_id_idx" ON "services_pricing_section_plans" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE "services_pricing_section_plans_features" CASCADE;
  DROP TABLE "services_pricing_section_plans" CASCADE;
  ALTER TABLE "services" DROP COLUMN "pricing_section_heading";
  ALTER TABLE "services" DROP COLUMN "pricing_section_subtitle";
  ALTER TABLE "services" DROP COLUMN "pricing_section_note";`)
}
