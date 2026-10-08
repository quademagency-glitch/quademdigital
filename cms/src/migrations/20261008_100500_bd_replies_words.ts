import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
  Replies need their words on the Business development role (approved by
  Ernest on 8 October 2026, with the new Team Handbook): a reply is the most
  useful thing to learn from, and the first two replies on record said only
  "They replied". The role gains a Replies count, with no target, whose
  proof is the words. Added only when the role has no Replies count yet, so
  one Ernest set in Settings is left alone and running it twice changes
  nothing. Array rows need an id; Payload's are 24 hex characters.
*/
export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  const added = await db.execute(sql`
    INSERT INTO "job_roles_report_counts" ("_order", "_parent_id", "id", "label", "source", "target", "amber_from", "proof", "proof_required", "screenshot")
    SELECT COALESCE((SELECT MAX(rc."_order") FROM "job_roles_report_counts" rc WHERE rc."_parent_id" = jr."id"), 0) + 1,
           jr."id", substr(md5(random()::text || jr."id"::text), 1, 24), 'Replies', 'replies', NULL, NULL, 'words', true, 'no'
    FROM "job_roles" jr
    WHERE jr."name" = 'Business development'
      AND NOT EXISTS (SELECT 1 FROM "job_roles_report_counts" rc WHERE rc."_parent_id" = jr."id" AND rc."source" = 'replies');`)
  await db.execute(sql`UPDATE "job_roles" SET "updated_at" = now() WHERE "name" = 'Business development';`)
  payload.logger.info(`Business development replies need their words: ${added.rowCount ?? 0} count added`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DELETE FROM "job_roles_report_counts" rc USING "job_roles" jr
    WHERE rc."_parent_id" = jr."id" AND jr."name" = 'Business development' AND rc."source" = 'replies' AND rc."label" = 'Replies' AND rc."target" IS NULL;`)
}
