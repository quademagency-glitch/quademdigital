import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
  The Business development role said its people find businesses "that need a
  website". Quadem sells every service, so the role now says so too (asked
  for by Ernest on 6 October 2026). Plain SQL rather than payload.update: an
  update that does not name every field puts the rest back to their defaults,
  and the role's module switches default to off.

  Each statement changes only text that still reads exactly as it was, so a
  role Ernest has already reworded in Settings is left alone, and running it
  twice changes nothing.
*/
export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  const role = await db.execute(sql`
    UPDATE "job_roles" SET "description" = 'Finds small businesses that need help to win customers online (a website, a brand, social media, video or ads), starts the conversation and brings them to a deal.', "updated_at" = now()
    WHERE "description" = 'Finds small businesses that need a website, starts the conversation and brings them to a deal.';`)
  const area = await db.execute(sql`
    UPDATE "job_roles_training_areas" SET "name" = 'Finding businesses that need what we offer'
    WHERE "name" = 'Finding businesses that need a website';`)
  payload.logger.info(`Job roles for every service: ${role.rowCount ?? 0} description, ${area.rowCount ?? 0} training area`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "job_roles" SET "description" = 'Finds small businesses that need a website, starts the conversation and brings them to a deal.', "updated_at" = now()
    WHERE "description" = 'Finds small businesses that need help to win customers online (a website, a brand, social media, video or ads), starts the conversation and brings them to a deal.';`)
  await db.execute(sql`
    UPDATE "job_roles_training_areas" SET "name" = 'Finding businesses that need a website'
    WHERE "name" = 'Finding businesses that need what we offer';`)
}
