import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Two text columns for the rebuilt hero.
 *
 * `hero_eyebrow` is the small bracketed label above the giant word. The site
 * adds the brackets, so the stored value is "Founder-led studio, Accra" rather
 * than "[ Founder-led studio, Accra ]".
 *
 * `hero_meta_labels` is the short meta line under it, stored comma separated
 * and rendered with // between the parts. A text column rather than an array
 * field on purpose: an array would create a whole table with id, _order,
 * _parent_id, a foreign key and a cascade constraint to hold three short
 * strings, and the // separator is a presentation choice that should be
 * restyleable without an editor retyping anything.
 *
 * ONE COLUMN EACH, NOT TWO. The `homepage` global has no `versions` key, so
 * there is no `_homepage_v` table to mirror these into. Check that again before
 * copying this file for a different global: 20260909_190000_clients_version_country
 * is the five days that rule cost when it was missed on a collection that does
 * keep versions, where reads kept working and every write answered 500.
 *
 * Nullable with no default. The site supplies its own literal fallbacks, so an
 * empty column renders the same hero rather than a blank one.
 *
 * Idempotent, per cms/CLAUDE.md, so a partial run can be re-run.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "hero_eyebrow" varchar;
    ALTER TABLE "homepage" ADD COLUMN IF NOT EXISTS "hero_meta_labels" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "homepage" DROP COLUMN IF EXISTS "hero_eyebrow";
    ALTER TABLE "homepage" DROP COLUMN IF EXISTS "hero_meta_labels";
  `)
}
