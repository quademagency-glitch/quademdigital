import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { addStarters, STARTER_GUIDES, STARTER_TEMPLATES } from '../lib/onboardingStarters'

/*
  The starter journeys and guides (lib/onboardingStarters.ts), as drafts the
  founder corrects and switches on in the portal. Any already there by name is
  left alone.
*/
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const added = await addStarters(payload, req)
  payload.logger.info(`Starter journeys added: ${added.templates}, starter guides added: ${added.guides} (all drafts, not in use)`)
}

/* Only drafts still untouched are removed: one the founder has switched on is his. */
export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.delete({ collection: 'journey-templates', where: { and: [{ name: { in: STARTER_TEMPLATES.map((t) => t.name) } }, { ready: { equals: false } }] }, overrideAccess: true, req })
  await payload.delete({ collection: 'onboarding-guides', where: { and: [{ title: { in: STARTER_GUIDES.map((g) => g.title) } }, { ready: { equals: false } }] }, overrideAccess: true, req })
}
