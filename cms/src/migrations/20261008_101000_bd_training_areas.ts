import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/*
  The Business development role's four training areas take the names in the
  agreement and in Team Handbook 3.0 §9 (approved by Ernest on 8 October
  2026). They still had the names from the first trainee handbook. Area 1 is
  the Sales Playbook.

  Each name changes only where it still reads exactly as before, on the role,
  on any module in that area and on any monthly review row, so a name Ernest
  has already changed is left alone and running it twice changes nothing.
*/
const RENAMES: [string, string][] = [
  ['Finding businesses that need what we offer', 'Prospecting and sales'],
  ['First messages that get replies', 'Social media and content'],
  ['Following up and answering objections', 'Paid ads on Meta'],
  ['Pricing, quotes and closing', 'SEO and websites'],
]

async function rename(db: MigrateUpArgs['db'], from: string, to: string) {
  const role = await db.execute(sql`UPDATE "job_roles_training_areas" a SET "name" = ${to} FROM "job_roles" jr WHERE a."_parent_id" = jr."id" AND jr."name" = 'Business development' AND a."name" = ${from};`)
  await db.execute(sql`UPDATE "training_modules" m SET "area" = ${to} FROM "job_roles" jr WHERE m."job_role_id" = jr."id" AND jr."name" = 'Business development' AND m."area" = ${from};`)
  await db.execute(sql`UPDATE "monthly_reviews_training" SET "area" = ${to} WHERE "area" = ${from};`)
  return role.rowCount ?? 0
}

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  let n = 0
  for (const [from, to] of RENAMES) n += await rename(db, from, to)
  await db.execute(sql`UPDATE "job_roles" SET "updated_at" = now() WHERE "name" = 'Business development';`)
  payload.logger.info(`Business development training areas renamed: ${n}`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const [from, to] of RENAMES) await rename(db, to, from)
}
