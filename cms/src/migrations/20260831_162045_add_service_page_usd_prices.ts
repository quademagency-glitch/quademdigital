import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Two ladders for budget, and a dollar price for the four service pages.
 *
 * The budget question offered one set of dollar bands starting at "under
 * $2,000". Internationally that is below the cheapest thing on sale ($3,000 for
 * a website), so the first option a buyer read implied a price that never
 * existed. In Ghana it was worse: the whole ladder, GH₵ 2,500 to GH₵ 11,500, is
 * roughly $425 to $1,955, so every Ghanaian lead landed in that one bottom band
 * and the question learned nothing about the site's main market.
 *
 * The four service page globals each held a cedi price per tier and showed it
 * to everyone, including the buyers /global exists to reach. A landing page
 * reading GH₵ 2,500 sits next to an international website price of $3,000 on
 * another live page, and the cheaper number wins. price_usd is the other half.
 *
 * ALTER TYPE ... ADD VALUE is additive and irreversible in Postgres: there is
 * no DROP VALUE. down() therefore reverts the columns and leaves the enum
 * alone, rather than dropping and recreating a type that rows already use.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_leads_budget" ADD VALUE IF NOT EXISTS 'GHS < 2,500' BEFORE '< $2,000';
  ALTER TYPE "public"."enum_leads_budget" ADD VALUE IF NOT EXISTS 'GHS 2,500 - 6,000' BEFORE '< $2,000';
  ALTER TYPE "public"."enum_leads_budget" ADD VALUE IF NOT EXISTS 'GHS 6,000 - 12,000' BEFORE '< $2,000';
  ALTER TYPE "public"."enum_leads_budget" ADD VALUE IF NOT EXISTS 'GHS 12,000+' BEFORE '< $2,000';
  ALTER TYPE "public"."enum_leads_budget" ADD VALUE IF NOT EXISTS '< $1,500' BEFORE '< $2,000';
  ALTER TYPE "public"."enum_leads_budget" ADD VALUE IF NOT EXISTS '$1.5k - $3k' BEFORE '< $2,000';
  ALTER TYPE "public"."enum_leads_budget" ADD VALUE IF NOT EXISTS '$3k - $6k' BEFORE '< $2,000';
  ALTER TYPE "public"."enum_leads_budget" ADD VALUE IF NOT EXISTS '$6k+' BEFORE '< $2,000';
  ALTER TYPE "public"."enum__leads_v_version_budget" ADD VALUE IF NOT EXISTS 'GHS < 2,500' BEFORE '< $2,000';
  ALTER TYPE "public"."enum__leads_v_version_budget" ADD VALUE IF NOT EXISTS 'GHS 2,500 - 6,000' BEFORE '< $2,000';
  ALTER TYPE "public"."enum__leads_v_version_budget" ADD VALUE IF NOT EXISTS 'GHS 6,000 - 12,000' BEFORE '< $2,000';
  ALTER TYPE "public"."enum__leads_v_version_budget" ADD VALUE IF NOT EXISTS 'GHS 12,000+' BEFORE '< $2,000';
  ALTER TYPE "public"."enum__leads_v_version_budget" ADD VALUE IF NOT EXISTS '< $1,500' BEFORE '< $2,000';
  ALTER TYPE "public"."enum__leads_v_version_budget" ADD VALUE IF NOT EXISTS '$1.5k - $3k' BEFORE '< $2,000';
  ALTER TYPE "public"."enum__leads_v_version_budget" ADD VALUE IF NOT EXISTS '$3k - $6k' BEFORE '< $2,000';
  ALTER TYPE "public"."enum__leads_v_version_budget" ADD VALUE IF NOT EXISTS '$6k+' BEFORE '< $2,000';
  ALTER TABLE "video_production_page_pricing_section_plans" ADD COLUMN "price_usd" varchar;
  ALTER TABLE "web_design_page_pricing_section_plans" ADD COLUMN "price_usd" varchar;
  ALTER TABLE "brand_identity_page_pricing_section_plans" ADD COLUMN "price_usd" varchar;
  ALTER TABLE "seo_page_pricing_section_plans" ADD COLUMN "price_usd" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "leads" ALTER COLUMN "budget" SET DATA TYPE text;
  -- enum values are deliberately not reverted, see the note above
  ALTER TABLE "_leads_v" ALTER COLUMN "version_budget" SET DATA TYPE "public"."enum__leads_v_version_budget" USING "version_budget"::"public"."enum__leads_v_version_budget";
  ALTER TABLE "video_production_page_pricing_section_plans" DROP COLUMN "price_usd";
  ALTER TABLE "web_design_page_pricing_section_plans" DROP COLUMN "price_usd";
  ALTER TABLE "brand_identity_page_pricing_section_plans" DROP COLUMN "price_usd";
  ALTER TABLE "seo_page_pricing_section_plans" DROP COLUMN "price_usd";`)
}
