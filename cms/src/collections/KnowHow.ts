import type { CollectionConfig, Where } from 'payload'
import { APIError } from 'payload'
import { hasRole, isAdmin } from '../access/roles'
import { refId, userById } from '../lib/moneyContext'
import { adminIds, notify } from '../lib/notify'

/**
 * Shared know-how (spec 14.10): objection answers and winning messages the
 * team suggests, which Ernest approves before they appear for everyone.
 * Ernest's own go straight in.
 */
export const KNOWHOW_KINDS = [
  { label: 'Answer to an objection', value: 'objection' },
  { label: 'Message that worked', value: 'message' },
  { label: 'Tip', value: 'tip' },
]

export const KnowHow: CollectionConfig = {
  slug: 'know-how',
  labels: { singular: 'Know-how', plural: 'Know-how' },
  admin: { group: 'Team', useAsTitle: 'title', defaultColumns: ['title', 'kind', 'status', 'suggestedBy'] },
  defaultSort: '-createdAt',
  access: {
    read: ({ req: { user } }) => {
      if (hasRole(user, 'admin')) return true
      if (hasRole(user, 'team') && user) return { or: [{ status: { equals: 'approved' } }, { suggestedBy: { equals: user.id } }] } as Where
      return false
    },
    create: ({ req: { user } }) => hasRole(user, 'admin', 'team'),
    update: ({ req: { user } }) => (hasRole(user, 'admin') ? true : hasRole(user, 'team') && user ? ({ and: [{ suggestedBy: { equals: user.id } }, { status: { equals: 'suggested' } }] } as Where) : false),
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const team = hasRole(req.user, 'team')
        if (operation === 'create') {
          data.suggestedBy = req.user?.id ?? null
          data.status = team ? 'suggested' : 'approved'
        }
        if (team) for (const k of ['status', 'decidedBy', 'decidedAt', 'decisionNote', 'suggestedBy']) if (operation === 'update') data[k] = originalDoc?.[k]
        const merged: Record<string, any> = { ...(originalDoc ?? {}), ...data }
        if (!String(merged.title ?? '').trim() || !String(merged.body ?? '').trim()) throw new APIError('Write the situation and what to say.', 400)
        if (!team && data.status && data.status !== originalDoc?.status && ['approved', 'declined'].includes(data.status)) {
          data.decidedBy = req.user?.id ?? null
          data.decidedAt = new Date().toISOString()
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        if (operation === 'create' && doc.status === 'suggested') {
          const person = await userById(req, refId(doc.suggestedBy))
          await notify(req, { to: await adminIds(req), kind: 'know-how', title: `${person?.name || 'A team member'} suggests: ${doc.title}`, link: '/know-how', action: 'Read it', email: false })
        }
        if (operation === 'update' && doc.status !== previousDoc?.status && ['approved', 'declined'].includes(doc.status) && refId(doc.suggestedBy) && refId(doc.suggestedBy) !== refId(doc.decidedBy)) {
          await notify(req, { to: [refId(doc.suggestedBy)], kind: 'know-how', title: doc.status === 'approved' ? `Your suggestion is in, for everyone: ${doc.title}` : `Not added: ${doc.title}`, body: doc.decisionNote || undefined, link: '/know-how' })
        }
        return doc
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'kind', type: 'select', required: true, defaultValue: 'objection', options: KNOWHOW_KINDS, admin: { width: '34%' } },
        { name: 'niche', type: 'text', admin: { width: '33%', description: 'Optional, such as clinics or salons.' } },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'suggested',
          index: true,
          options: [
            { label: 'Suggested', value: 'suggested' },
            { label: 'Approved', value: 'approved' },
            { label: 'Declined', value: 'declined' },
          ],
          admin: { width: '33%' },
        },
      ],
    },
    { name: 'title', label: 'The objection or situation', type: 'text', required: true },
    { name: 'body', label: 'What to say', type: 'textarea', required: true },
    {
      type: 'row',
      fields: [
        { name: 'suggestedBy', label: 'Suggested by', type: 'relationship', relationTo: 'users', admin: { width: '34%', readOnly: true } },
        { name: 'decidedBy', label: 'Decided by', type: 'relationship', relationTo: 'users', admin: { width: '33%', readOnly: true } },
        { name: 'decidedAt', label: 'Decided on', type: 'date', admin: { width: '33%', readOnly: true } },
      ],
    },
    { name: 'decisionNote', label: 'Note on the decision', type: 'text' },
  ],
}
