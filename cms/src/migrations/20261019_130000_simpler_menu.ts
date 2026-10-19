import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import crypto from 'node:crypto'

/**
 * The simpler header menu Ernest approved on 19 October 2026.
 *
 * Before: Services, Projects, QuadERP, Blog, About, Offers, Contact.
 * After: Work, Prices, About, Contact. Services is no longer a plain link
 * because the site draws it as its own menu (Build it / Grow it, in
 * BaseLayout.astro), Blog and QuadERP stay in the footer, and Offers goes
 * because the free check-up is the one offer left and every page links it.
 *
 * A migration for the same reason as 20260823_190000_seed_nav_and_footer:
 * siteSettings is admin-only to write and the site's API key is the editor's.
 *
 * Guarded: it only rewrites the menu when it is exactly the seven links above,
 * in that order, so a menu edited in the admin since is left alone, and the
 * replay on every Railway boot does nothing the second time.
 */

const q = (v: string | null) => (v === null ? 'NULL' : `'${v.replace(/'/g, "''")}'`)
const oid = () => crypto.randomBytes(12).toString('hex')
const rowsOf = (res: any) => res?.rows ?? res ?? []

const BEFORE: [string, string][] = [
  ['Services', '/services/'],
  ['Projects', '/projects/'],
  ['QuadERP', 'https://quaderp.app'],
  ['Blog', '/blog/'],
  ['About', '/about/'],
  ['Offers', '/offers/'],
  ['Contact', '/contact/'],
]

const AFTER: [string, string][] = [
  ['Work', '/projects/'],
  ['Prices', '/#pricing'],
  ['About', '/about/'],
  ['Contact', '/contact/'],
]

const same = (rows: { label: string; url: string }[], list: [string, string][]) =>
  rows.length === list.length && rows.every((row, i) => row.label === list[i][0] && row.url === list[i][1])

async function replace(db: MigrateUpArgs['db'], from: [string, string][], to: [string, string][]) {
  const settings = rowsOf(await db.execute(sql.raw(`SELECT id FROM "site_settings" LIMIT 1;`)))
  const parent = settings[0]?.id
  if (!parent) return
  const current = rowsOf(
    await db.execute(sql.raw(`SELECT "label", "url" FROM "site_settings_nav_links" WHERE "_parent_id" = ${parent} ORDER BY "_order";`)),
  ) as { label: string; url: string }[]
  if (!same(current, from)) return
  await db.execute(sql.raw(`DELETE FROM "site_settings_nav_links" WHERE "_parent_id" = ${parent};`))
  const values = to.map(([label, url], i) => `(${i + 1}, ${parent}, ${q(oid())}, ${q(label)}, ${q(url)})`).join(',\n      ')
  await db.execute(sql.raw(`
    INSERT INTO "site_settings_nav_links" ("_order", "_parent_id", "id", "label", "url")
    VALUES ${values};
  `))
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await replace(db, BEFORE, AFTER)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await replace(db, AFTER, BEFORE)
}
