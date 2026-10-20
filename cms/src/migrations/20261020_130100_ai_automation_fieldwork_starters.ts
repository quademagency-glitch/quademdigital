import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { addStarters } from '../lib/onboardingStarters'

/*
  The starter journeys and guides for AI automation and Fieldwork
  (lib/onboardingStarters.ts), as drafts the founder reads and switches on in
  the portal. Only these two: the others were added before and may have been
  renamed since. A migration of its own because Postgres cannot use the new
  values in the transaction that added them (20261020_130000).
*/
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const added = await addStarters(payload, req, ['ai-automation', 'fieldwork'])
  payload.logger.info(`AI automation and Fieldwork starters added: ${added.templates} journeys, ${added.guides} guides (drafts, not in use)`)
}

/* Only drafts still untouched are removed: one the founder has switched on is his. */
export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  for (const name of ['WhatsApp assistant', 'Fieldwork lead lists']) {
    await payload.delete({ collection: 'journey-templates', where: { and: [{ name: { equals: name } }, { ready: { equals: false } }] }, overrideAccess: true, req })
  }
  for (const title of ['Your WhatsApp assistant', 'Your lead lists']) {
    await payload.delete({ collection: 'onboarding-guides', where: { and: [{ title: { equals: title } }, { ready: { equals: false } }] }, overrideAccess: true, req })
  }
}
