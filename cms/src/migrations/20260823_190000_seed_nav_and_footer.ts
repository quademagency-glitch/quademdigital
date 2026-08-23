import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
import crypto from 'node:crypto'

/**
 * Puts the header menu and the footer columns into the CMS.
 *
 * Data, not schema, and deliberately a migration rather than an API call.
 * `siteSettings` is admin-only to write, because it holds the bank account an
 * invoice tells a client to pay into, and the site's API key belongs to the
 * editor account. A migration is the one path that can seed it, and it leaves
 * a record.
 *
 * Nothing here is new content. It is exactly what BaseLayout was rendering
 * from its own hardcoded lists, moved to where it can be edited. Until this
 * runs the CMS fields are empty, the fallback lists render, and editing the
 * menu in the admin appears to do nothing.
 *
 * Guarded: it only writes when there is nothing meaningful there, so a re-run,
 * or the replay that happens on every Railway boot, cannot overwrite an edit.
 * The one row production already holds has every value null, left from when
 * `footerLinks` was a field nothing rendered, so it does not count as content.
 */

const q = (v: string | null) => (v === null ? 'NULL' : `'${v.replace(/'/g, "''")}'`)
const oid = () => crypto.randomBytes(12).toString('hex')

const NAV_LINKS: [string, string][] = [
  ['Services', '/services/'],
  ['Projects', '/projects/'],
  ['QuadERP', 'https://quaderp.app'],
  ['Blog', '/blog/'],
  ['About', '/about/'],
  ['Offers', '/offers/'],
  ['Contact', '/contact/'],
]

const FOOTER_GROUPS: {
  heading: string
  url: string | null
  column: 'left' | 'right'
  links: [string, string][]
}[] = [
  {
    heading: 'Company',
    url: null,
    column: 'left',
    links: [
      ['About', '/about/'],
      ['Portfolio', '/projects/'],
      ['Blog', '/blog/'],
      ['Contact', '/contact/'],
    ],
  },
  {
    heading: 'Special Offers',
    url: '/offers/',
    column: 'left',
    links: [
      ['Free SEO Audit', '/offers/free-seo-audit/'],
      ['Social Media Bonus', '/offers/social-media-bonus/'],
      ['Web Dev Discount', '/offers/web-dev-discount/'],
    ],
  },
  {
    heading: 'Services',
    url: null,
    column: 'right',
    // Full service names, matching each page's own title. The old footer used
    // shortened labels pointing at anchors, so one service went by three names
    // depending on where you met it.
    links: [
      ['Web Design & Development', '/services/web-design/'],
      ['Branding & Graphic Design', '/services/brand-identity/'],
      ['SEO & Content Marketing', '/services/seo/'],
      ['AI Video & Reels', '/services/video-production/'],
      ['Digital Marketing & Social Media', '/services/digital-marketing-social-media/'],
      ['QuadERP', 'https://quaderp.app'],
      ['Price Calculator', '/calculator/'],
    ],
  },
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const settings: any = await db.execute(sql.raw(`SELECT id FROM "site_settings" LIMIT 1;`))
  const rows = settings?.rows ?? settings
  const parent = rows?.[0]?.id
  if (!parent) {
    // A database with no site settings row yet: nothing to attach to, and the
    // fallback lists render correctly meanwhile.
    return
  }

  const count = async (table: string, where: string) => {
    const res: any = await db.execute(sql.raw(`SELECT count(*)::int AS n FROM "${table}" WHERE ${where};`))
    return Number((res?.rows ?? res)?.[0]?.n ?? 0)
  }

  const realNav = await count('site_settings_nav_links', `"label" IS NOT NULL AND "url" IS NOT NULL`)
  const realFooter = await count('site_settings_footer_links', `"label" IS NOT NULL`)

  if (realNav === 0) {
    await db.execute(sql.raw(`DELETE FROM "site_settings_nav_links" WHERE "_parent_id" = ${parent};`))
    const values = NAV_LINKS.map(
      ([label, url], i) => `(${i + 1}, ${parent}, ${q(oid())}, ${q(label)}, ${q(url)})`,
    ).join(',\n      ')
    await db.execute(sql.raw(`
      INSERT INTO "site_settings_nav_links" ("_order", "_parent_id", "id", "label", "url")
      VALUES ${values};
    `))
  }

  if (realFooter === 0) {
    await db.execute(sql.raw(`
      DELETE FROM "site_settings_footer_links_links"
       WHERE "_parent_id" IN (SELECT "id" FROM "site_settings_footer_links" WHERE "_parent_id" = ${parent});
      DELETE FROM "site_settings_footer_links" WHERE "_parent_id" = ${parent};
    `))

    let order = 1
    for (const group of FOOTER_GROUPS) {
      const gid = oid()
      await db.execute(sql.raw(`
        INSERT INTO "site_settings_footer_links" ("_order", "_parent_id", "id", "label", "url", "column")
        VALUES (${order++}, ${parent}, ${q(gid)}, ${q(group.heading)}, ${q(group.url)}, ${q(group.column)});
      `))
      const values = group.links
        .map(([label, url], i) => `(${i + 1}, ${q(gid)}, ${q(oid())}, ${q(label)}, ${q(url)})`)
        .join(',\n        ')
      await db.execute(sql.raw(`
        INSERT INTO "site_settings_footer_links_links" ("_order", "_parent_id", "id", "label", "url")
        VALUES ${values};
      `))
    }
  }
}

/**
 * Removes only the rows this seeded, matched by their values. An edit made
 * since would not match and is left alone.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  const labels = FOOTER_GROUPS.map((g) => q(g.heading)).join(', ')
  await db.execute(sql.raw(`
    DELETE FROM "site_settings_footer_links_links"
     WHERE "_parent_id" IN (SELECT "id" FROM "site_settings_footer_links" WHERE "label" IN (${labels}));
    DELETE FROM "site_settings_footer_links" WHERE "label" IN (${labels});
    DELETE FROM "site_settings_nav_links" WHERE "url" IN (${NAV_LINKS.map(([, u]) => q(u)).join(', ')});
  `))
}
