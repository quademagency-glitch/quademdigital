import type { CollectionAfterChangeHook } from 'payload'
import { generateAccessCode } from '../lib/accessCode'

/**
 * When a Lead's status is set to "won", spin up a matching Client record
 * (Onboarding stage) and link it back via `convertedClient`, so the won
 * lead becomes manageable in the same place active client work happens.
 * Guarded by `convertedClient` already being set so re-saving a won lead
 * doesn't create duplicate clients.
 */
export const convertWonLeadToClient: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  if (operation !== 'update') return doc
  if (doc.status !== 'won' || previousDoc?.status === 'won') return doc
  if (doc.convertedClient) return doc

  const baseSlug = String(doc.name || 'client')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  const slug = `${baseSlug}-${doc.id}`

  // Was six characters from Math.random() — not long enough, and not a
  // cryptographic source. Both this path and the admin now go through one
  // generator, so they cannot drift apart again. The field's beforeValidate
  // hook still backstops any caller that forgets.
  const client = await req.payload.create({
    collection: 'clients',
    data: {
      clientName: doc.name,
      clientEmail: doc.email,
      slug,
      accessCode: generateAccessCode(),
      projectStatus: 'onboarding',
    },
    req,
  })

  await req.payload.update({
    collection: 'leads',
    id: doc.id,
    data: { convertedClient: client.id },
    req,
  })

  return doc
}
