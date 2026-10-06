import type { CollectionBeforeChangeHook, Payload, PayloadRequest } from 'payload'

/**
 * The reusable parts of a client's start, chosen by the service they bought:
 * the journey template (the dated steps) and the onboarding guide (what they
 * keep reading on their page).
 *
 * Only what the founder has marked ready is ever picked by itself. The service's
 * own one comes first (its default, if there are two), then the fallback marked
 * "use this when nothing matches". A template or guide chosen by hand is used
 * whether it is ready or not: that choice is the founder's.
 */

type Doc = Record<string, any>

async function pick(payload: Payload, collection: 'journey-templates' | 'onboarding-guides', service?: string | null, req?: PayloadRequest): Promise<Doc | null> {
  const find = async (where: Record<string, unknown>) => {
    const r = await payload.find({
      collection,
      where: { and: [{ ready: { equals: true } }, where] } as never,
      sort: ['-isDefault', '-updatedAt'],
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    return (r.docs[0] as Doc | undefined) ?? null
  }
  return (service ? await find({ service: { equals: service } }) : null) ?? (await find({ isDefault: { equals: true } }))
}

/** The ready journey template for a service, or the ready fallback. */
export const pickTemplate = (payload: Payload, service?: string | null, req?: PayloadRequest) => pick(payload, 'journey-templates', service, req)

/** The ready guide for a service, or the ready fallback. */
export const pickGuide = (payload: Payload, service?: string | null, req?: PayloadRequest) => pick(payload, 'onboarding-guides', service, req)

/**
 * When a client becomes Won and has no guide yet, give them the guide for
 * their service. Only at that moment: a guide the founder later takes off a
 * client stays off. Runs inside the client's own save, so the guide is there
 * when the client first opens their page. A failed lookup never stops the save.
 */
export const attachGuideOnWin: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  if (!data) return data
  const doc = { ...originalDoc, ...data }
  if (doc.pipelineStatus !== 'won' || originalDoc?.pipelineStatus === 'won' || doc.onboardingGuide) return data
  try {
    const guide = await pickGuide(req.payload, doc.service, req)
    if (guide) data.onboardingGuide = guide.id
  } catch (error) {
    req.payload.logger.error({ err: error, client: originalDoc?.id }, 'The guide for a new client could not be looked up')
  }
  return data
}
