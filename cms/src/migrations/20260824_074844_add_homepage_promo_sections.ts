import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import crypto from 'crypto'

/**
 * The homepage service promo cards, moved out of four hardcoded components.
 *
 * The copy below was read out of those components rather than retyped, so the
 * page is unchanged the moment this runs. One character is worth knowing
 * about: the web design paragraph uses a non-breaking hyphen (U+2011) in
 * "e-commerce", so the word never wraps across two lines. It is preserved here
 * exactly.
 *
 * The illustrations stay in code. They are artwork rather than content, and
 * the `visual` column only says which of the four to draw.
 */

const CARDS = [
  {
    "visual": "video",
    "badge": "AI Video",
    "heading": "Post every week with",
    "headingAccent": "AI Video & Reels",
    "body": "Short-form video made with AI. No camera, no crew, no shoot day to organise. Reels, ads and product videos built from your logo and your products, from GHS 1,500.",
    "ctaLabel": "See AI Video & Reels",
    "ctaUrl": "/services/video-production/"
  },
  {
    "visual": "webDesign",
    "badge": "Core Service",
    "heading": "Professional",
    "headingAccent": "Web Design",
    "body": "Custom, responsive websites that convert visitors into loyal customers. From corporate sites to e‑commerce, I build digital experiences that work.",
    "ctaLabel": "Explore Web Design",
    "ctaUrl": "/services/web-design/"
  },
  {
    "visual": "brandIdentity",
    "badge": "Core Service",
    "heading": "Brand",
    "headingAccent": "Identity Design",
    "body": "From logo design to full brand kits, I build visual identities that stand out and resonate with your audience.",
    "ctaLabel": "Explore Branding",
    "ctaUrl": "/services/brand-identity/"
  },
  {
    "visual": "seo",
    "badge": "Growth Service",
    "heading": "Data-Driven",
    "headingAccent": "SEO & Content",
    "body": "Dominate search rankings, drive organic traffic, and turn clicks into customers with my comprehensive SEO and content strategies.",
    "ctaLabel": "Explore SEO Services",
    "ctaUrl": "/services/seo/"
  }
]

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_homepage_promo_sections_visual" AS ENUM('video', 'webDesign', 'brandIdentity', 'seo');
  CREATE TABLE "homepage_promo_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"visual" "enum_homepage_promo_sections_visual" DEFAULT 'video' NOT NULL,
  	"badge" varchar,
  	"heading" varchar NOT NULL,
  	"heading_accent" varchar,
  	"body" varchar NOT NULL,
  	"cta_label" varchar,
  	"cta_url" varchar
  );
  
  ALTER TABLE "homepage_promo_sections" ADD CONSTRAINT "homepage_promo_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "homepage_promo_sections_order_idx" ON "homepage_promo_sections" USING btree ("_order");
  CREATE INDEX "homepage_promo_sections_parent_id_idx" ON "homepage_promo_sections" USING btree ("_parent_id");`)

  /*
    Seed the four cards that were already on the page. Guarded on the table
    being empty rather than on each row, because the rows carry generated ids:
    if these have already been edited in the admin, this must not undo it.
  */
  const existing = await db.execute(
    sql`SELECT count(*)::int AS c FROM "homepage_promo_sections"`,
  )
  const already = Number((existing.rows?.[0] as { c: number })?.c ?? 0)

  if (already === 0) {
    const parentRow = await db.execute(sql`SELECT "id" FROM "homepage" ORDER BY "id" LIMIT 1`)
    const parent = (parentRow.rows?.[0] as { id: number })?.id

    if (!parent) {
      payload.logger.warn(
        'No homepage row yet, so the promo cards were not seeded. The site falls back to its built in cards until one is saved.',
      )
    } else {
      const cards = CARDS
      for (let i = 0; i < cards.length; i += 1) {
        const c = cards[i]
        await db.execute(sql`
          INSERT INTO "homepage_promo_sections"
            ("_order", "_parent_id", "id", "visual", "badge", "heading", "heading_accent", "body", "cta_label", "cta_url")
          VALUES (
            ${i + 1}, ${parent}, ${crypto.randomBytes(12).toString('hex')}, ${c.visual},
            ${c.badge}, ${c.heading}, ${c.headingAccent}, ${c.body}, ${c.ctaLabel}, ${c.ctaUrl}
          )`)
      }
      payload.logger.info(`Seeded ${cards.length} homepage promo cards.`)
    }
  }
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "homepage_promo_sections" CASCADE;
  DROP TYPE "public"."enum_homepage_promo_sections_visual";`)
}
