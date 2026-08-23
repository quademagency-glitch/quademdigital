import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Turns `siteSettings.footerLinks` into the footer's two link columns.
 *
 * The field existed with a single `label`, was read into a variable in
 * BaseLayout, and was never rendered: the footer columns were typed into the
 * layout markup. It now carries a heading, an optional heading link, which of
 * the two columns it belongs in, and the links under it.
 *
 * Additive on purpose. `label` keeps its column and becomes the heading, and
 * `url` is a column production already had, orphaned from an earlier shape of
 * this field, so it is reused rather than recreated. Nothing is dropped, which
 * is why `ADD COLUMN IF NOT EXISTS` matters here and not just as a habit: on
 * production the `url` statement is a no-op.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_site_settings_footer_links_column" AS ENUM('left', 'right');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "site_settings_footer_links_links" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "label" varchar,
      "url" varchar
    );

    ALTER TABLE "site_settings_footer_links" ADD COLUMN IF NOT EXISTS "url" varchar;
    ALTER TABLE "site_settings_footer_links" ADD COLUMN IF NOT EXISTS "column" "enum_site_settings_footer_links_column" DEFAULT 'left';

    DO $$ BEGIN
      ALTER TABLE "site_settings_footer_links_links"
        ADD CONSTRAINT "site_settings_footer_links_links_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings_footer_links"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "site_settings_footer_links_links_order_idx" ON "site_settings_footer_links_links" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "site_settings_footer_links_links_parent_id_idx" ON "site_settings_footer_links_links" USING btree ("_parent_id");
  `))
}

/**
 * `url` is deliberately not dropped: it predates this migration and this
 * migration did not create it.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    DROP TABLE IF EXISTS "site_settings_footer_links_links" CASCADE;
    ALTER TABLE "site_settings_footer_links" DROP COLUMN IF EXISTS "column";
    DROP TYPE IF EXISTS "public"."enum_site_settings_footer_links_column";
  `))
}
