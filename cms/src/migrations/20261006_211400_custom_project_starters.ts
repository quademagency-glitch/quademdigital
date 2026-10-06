import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { addStarters } from '../lib/onboardingStarters'

/*
  The starter journey and guide for a custom project (lib/onboardingStarters.ts),
  as drafts the founder corrects and switches on in the portal. Only the
  custom ones: the others were added before and may have been renamed since.
  A migration of its own because Postgres cannot use the new 'custom' value
  in the transaction that added it (20261006_211308_custom_project_service).
*/
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const added = await addStarters(payload, req, ['custom'])
  payload.logger.info(`Custom project starters added: ${added.templates} journey, ${added.guides} guide (drafts, not in use)`)
}

/* Only drafts still untouched are removed: one the founder has switched on is his. */
export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.delete({ collection: 'journey-templates', where: { and: [{ name: { equals: 'Custom project' } }, { ready: { equals: false } }] }, overrideAccess: true, req })
  await payload.delete({ collection: 'onboarding-guides', where: { and: [{ title: { equals: 'Your custom project' } }, { ready: { equals: false } }] }, overrideAccess: true, req })
}
