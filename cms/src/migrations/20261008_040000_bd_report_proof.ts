import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
  Switches on proof for the Business development role (asked for by Ernest
  on 8 October 2026, after the release of reports you can check):

    First messages   the words sent, required; a screenshot, optional
    Follow-ups       the words sent, required

  From then on a first message or follow-up recorded without its words does
  not save (lib/leadRules.ts /:id/log). Records made before keep their place
  and read "Recorded before the words were needed".

  Plain SQL rather than payload.update, which would put every field it is
  not given back to its default. Each statement changes only a count still
  at the release defaults (no proof, no screenshot), so a role Ernest has
  already set in Settings is left alone, and running it twice changes
  nothing.
*/
export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  const first = await db.execute(sql`
    UPDATE "job_roles_report_counts" rc SET "proof" = 'words', "proof_required" = true, "screenshot" = 'optional'
    FROM "job_roles" jr
    WHERE rc."_parent_id" = jr."id" AND jr."name" = 'Business development' AND rc."source" = 'firstMessages' AND rc."proof" = 'none' AND rc."screenshot" = 'no';`)
  const follow = await db.execute(sql`
    UPDATE "job_roles_report_counts" rc SET "proof" = 'words', "proof_required" = true
    FROM "job_roles" jr
    WHERE rc."_parent_id" = jr."id" AND jr."name" = 'Business development' AND rc."source" = 'followUps' AND rc."proof" = 'none' AND rc."screenshot" = 'no';`)
  await db.execute(sql`UPDATE "job_roles" SET "updated_at" = now() WHERE "name" = 'Business development';`)
  payload.logger.info(`Business development proof: ${first.rowCount ?? 0} first messages, ${follow.rowCount ?? 0} follow-ups`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "job_roles_report_counts" rc SET "proof" = 'none', "proof_required" = true, "screenshot" = 'no'
    FROM "job_roles" jr
    WHERE rc."_parent_id" = jr."id" AND jr."name" = 'Business development' AND rc."source" IN ('firstMessages', 'followUps');`)
}
