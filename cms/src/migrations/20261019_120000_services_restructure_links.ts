import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import crypto from 'node:crypto'

/**
 * The footer and the site description, after Ernest's services restructure of
 * 19 October 2026.
 *
 * Data, not schema, and a migration for the same reason as
 * 20260823_190000_seed_nav_and_footer: `siteSettings` is admin-only to write
 * (it holds the bank account an invoice points at) and the site's API key is
 * the editor's. The rest of the restructure is written over REST by
 * cms/scripts/restructure-services-2026-10.mjs; this is the one part that key
 * cannot reach.
 *
 * What changes:
 *   - Branding & Graphic Design leaves the footer. Quadem stopped selling it;
 *     /services/brand-identity/ now forwards to web design.
 *   - The two offers Ernest ended (Social Media Bonus, Web Dev Discount) leave
 *     the footer. Free SEO Audit stays, renamed Free Website Check-up.
 *   - Digital Marketing & Social Media is renamed Growth & Performance
 *     Marketing, the same page under its new name.
 *   - AI Automation and Fieldwork, which the footer never listed, join it, so
 *     the column names all six services.
 *   - The site description stops saying "branding", and leads with the result
 *     for the client rather than the location (Ernest, 19 October 2026: copy
 *     talks about results, never founder-led or where we are).
 *
 * Guarded: every write matches the exact label and address (or text) that
 * production holds today, so an edit made in the admin since is left alone,
 * and the replay on every Railway boot changes nothing the second time.
 */

const q = (v: string | null) => (v === null ? 'NULL' : `'${v.replace(/'/g, "''")}'`)
const oid = () => crypto.randomBytes(12).toString('hex')

const OLD_DESCRIPTION =
  'Quadem Digital Enterprise is a full-service digital agency offering web design, digital marketing, branding, video production, and SEO services.'
const NEW_DESCRIPTION =
  'Quadem Digital builds websites, AI video, SEO and ads that bring businesses more enquiries and sales.'

const REMOVED: [string, string, string][] = [
  // [group heading, label, url]
  ['Special Offers', 'Social Media Bonus', '/offers/social-media-bonus/'],
  ['Special Offers', 'Web Dev Discount', '/offers/web-dev-discount/'],
  ['Services', 'Branding & Graphic Design', '/services/brand-identity/'],
]

const RENAMED: [string, string, string][] = [
  // [old label, new label, url]
  ['Free SEO Audit', 'Free Website Check-up', '/offers/free-seo-audit/'],
  ['Digital Marketing & Social Media', 'Growth & Performance Marketing', '/services/digital-marketing-social-media/'],
]

const ADDED: [string, string][] = [
  ['AI Automation', '/services/ai-automation/'],
  ['Fieldwork', '/services/fieldwork/'],
]

/* The Services column in this order afterwards. A link not named here (one
   added in the admin) keeps its place after these. */
const SERVICES_ORDER = [
  '/services/web-design/',
  '/services/ai-automation/',
  '/services/video-production/',
  '/services/seo/',
  '/services/digital-marketing-social-media/',
  '/services/fieldwork/',
  'https://quaderp.app',
  '/calculator/',
]

const rowsOf = (res: any) => res?.rows ?? res ?? []

async function servicesGroup(db: MigrateUpArgs['db'], parent: number): Promise<string | null> {
  const res: any = await db.execute(
    sql.raw(`SELECT "id" FROM "site_settings_footer_links" WHERE "_parent_id" = ${parent} AND "label" = 'Services' LIMIT 1;`),
  )
  return rowsOf(res)[0]?.id ?? null
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const settings = rowsOf(await db.execute(sql.raw(`SELECT id FROM "site_settings" LIMIT 1;`)))
  const parent = settings[0]?.id
  if (!parent) return

  await db.execute(
    sql.raw(`UPDATE "site_settings" SET "description" = ${q(NEW_DESCRIPTION)} WHERE "id" = ${parent} AND "description" = ${q(OLD_DESCRIPTION)};`),
  )

  for (const [, label, url] of REMOVED) {
    await db.execute(
      sql.raw(`
        DELETE FROM "site_settings_footer_links_links"
         WHERE "label" = ${q(label)} AND "url" = ${q(url)}
           AND "_parent_id" IN (SELECT "id" FROM "site_settings_footer_links" WHERE "_parent_id" = ${parent});
      `),
    )
  }

  for (const [from, to, url] of RENAMED) {
    await db.execute(
      sql.raw(`
        UPDATE "site_settings_footer_links_links" SET "label" = ${q(to)}
         WHERE "label" = ${q(from)} AND "url" = ${q(url)}
           AND "_parent_id" IN (SELECT "id" FROM "site_settings_footer_links" WHERE "_parent_id" = ${parent});
      `),
    )
  }

  const group = await servicesGroup(db, parent)
  if (!group) return

  for (const [label, url] of ADDED) {
    const exists = rowsOf(
      await db.execute(
        sql.raw(`SELECT 1 FROM "site_settings_footer_links_links" WHERE "_parent_id" = ${q(group)} AND "url" = ${q(url)} LIMIT 1;`),
      ),
    ).length
    if (!exists) {
      await db.execute(
        sql.raw(`
          INSERT INTO "site_settings_footer_links_links" ("_order", "_parent_id", "id", "label", "url")
          VALUES (999, ${q(group)}, ${q(oid())}, ${q(label)}, ${q(url)});
        `),
      )
    }
  }

  const links = rowsOf(
    await db.execute(
      sql.raw(`SELECT "id", "url", "_order" FROM "site_settings_footer_links_links" WHERE "_parent_id" = ${q(group)} ORDER BY "_order";`),
    ),
  ) as { id: string; url: string | null; _order: number }[]
  const rank = (url: string | null) => {
    const i = SERVICES_ORDER.indexOf(String(url))
    return i === -1 ? SERVICES_ORDER.length : i
  }
  const ordered = [...links].sort((a, b) => rank(a.url) - rank(b.url) || a._order - b._order)
  for (const [i, link] of ordered.entries()) {
    await db.execute(sql.raw(`UPDATE "site_settings_footer_links_links" SET "_order" = ${i + 1} WHERE "id" = ${q(link.id)};`))
  }
}

/**
 * Puts back what this took out and takes out what it added, matched by value,
 * so an edit made since is left alone.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  const settings = rowsOf(await db.execute(sql.raw(`SELECT id FROM "site_settings" LIMIT 1;`)))
  const parent = settings[0]?.id
  if (!parent) return

  await db.execute(
    sql.raw(`UPDATE "site_settings" SET "description" = ${q(OLD_DESCRIPTION)} WHERE "id" = ${parent} AND "description" = ${q(NEW_DESCRIPTION)};`),
  )

  for (const [from, to, url] of RENAMED) {
    await db.execute(
      sql.raw(`
        UPDATE "site_settings_footer_links_links" SET "label" = ${q(from)}
         WHERE "label" = ${q(to)} AND "url" = ${q(url)}
           AND "_parent_id" IN (SELECT "id" FROM "site_settings_footer_links" WHERE "_parent_id" = ${parent});
      `),
    )
  }

  const group = await servicesGroup(db, parent)
  if (group) {
    for (const [label, url] of ADDED) {
      await db.execute(
        sql.raw(`DELETE FROM "site_settings_footer_links_links" WHERE "_parent_id" = ${q(group)} AND "label" = ${q(label)} AND "url" = ${q(url)};`),
      )
    }
  }

  for (const [heading, label, url] of REMOVED) {
    const target = rowsOf(
      await db.execute(
        sql.raw(`SELECT "id" FROM "site_settings_footer_links" WHERE "_parent_id" = ${parent} AND "label" = ${q(heading)} LIMIT 1;`),
      ),
    )[0]?.id
    if (!target) continue
    const exists = rowsOf(
      await db.execute(
        sql.raw(`SELECT 1 FROM "site_settings_footer_links_links" WHERE "_parent_id" = ${q(target)} AND "url" = ${q(url)} LIMIT 1;`),
      ),
    ).length
    if (!exists) {
      await db.execute(
        sql.raw(`
          INSERT INTO "site_settings_footer_links_links" ("_order", "_parent_id", "id", "label", "url")
          VALUES (999, ${q(target)}, ${q(oid())}, ${q(label)}, ${q(url)});
        `),
      )
    }
  }
}
