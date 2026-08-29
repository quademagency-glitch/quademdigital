import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
  Which audience each pricing plan is for.

  The site had one plan list and switched only the number: GHS 2,500 in Ghana,
  and its converted value, $425, everywhere else. Meanwhile the international
  landing page sold the same website "from $1,200", because that is the rate the
  offer is actually worth abroad. Both numbers were live at once, so a buyer in
  London who read the landing page and then clicked through to the homepage
  found the same work at a third of the price.

  Ghana and the rest of the world are not one offer at two exchange rates. Ghana
  buys packages, the international market buys service lines, so the tiers
  differ in name, in contents and in count. This column is what lets both live
  in one collection.

  The default is 'ghana' so that the three existing rows keep meaning what they
  mean today, and so a plan added in the admin without a thought lands on the
  market whose prices are already correct rather than being advertised abroad.
*/

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pricing_plans_market" AS ENUM('ghana', 'international');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)

  await db.execute(sql`
    ALTER TABLE "pricing_plans"
      ADD COLUMN IF NOT EXISTS "market" "enum_pricing_plans_market" DEFAULT 'ghana' NOT NULL;
  `)

  /*
    Existing rows are the Ghana packages. The column default already covers a
    fresh add, but a replay against a database where the column was added by
    some other route should not leave nulls behind.
  */
  await db.execute(sql`
    UPDATE "pricing_plans" SET "market" = 'ghana' WHERE "market" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pricing_plans" DROP COLUMN IF EXISTS "market";
  `)
  await db.execute(sql`
    DROP TYPE IF EXISTS "public"."enum_pricing_plans_market";
  `)
}
