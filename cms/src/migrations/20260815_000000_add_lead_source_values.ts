import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Add the three lead sources the site was already sending.
 *
 * enum_leads_source was created in the initial baseline with six values. When
 * the homepage form, the CMS-driven service pages and Brand Studio were
 * repointed off Formspree they started posting source='homepage', 'cms-page'
 * and 'brand-studio'. Postgres rejected every one of those inserts, so leads
 * from the site's busiest entry point were never stored — while the
 * notification email still sent, which hid the failure completely.
 *
 * ALTER TYPE ... ADD VALUE is additive and irreversible in Postgres: there is
 * no DROP VALUE. down() is therefore a deliberate no-op rather than a lie —
 * removing a value would fail on any row already using it.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // IF NOT EXISTS keeps this safe to re-run, matching the convention used by
  // the other hand-written migrations in this directory.
  await db.execute(`
    ALTER TYPE "public"."enum_leads_source" ADD VALUE IF NOT EXISTS 'homepage';
  `)
  await db.execute(`
    ALTER TYPE "public"."enum_leads_source" ADD VALUE IF NOT EXISTS 'cms-page';
  `)
  await db.execute(`
    ALTER TYPE "public"."enum_leads_source" ADD VALUE IF NOT EXISTS 'brand-studio';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Intentionally empty — see the note above.
}
