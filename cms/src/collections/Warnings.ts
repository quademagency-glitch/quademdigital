import type { CollectionConfig, Where } from 'payload'
import { APIError } from 'payload'
import { hasRole, isAdmin } from '../access/roles'
import { audit, dayText } from '../lib/audit'
import { refId, userById } from '../lib/moneyContext'
import { adminIds, notify } from '../lib/notify'

/**
 * A dated written warning or notice (spec 14.10), seen by the person and
 * Ernest. The missed-month notices of the monthly review are recorded here by
 * themselves. The person presses "I have read this"; nothing else about it is
 * theirs to change, and nobody can delete one but an admin.
 */
export const WARNING_KINDS = [
  { label: 'Written warning', value: 'warning' },
  { label: 'Notice', value: 'notice' },
  { label: 'Missed months: review meeting', value: 'missed-meeting' },
  { label: 'Missed months: agreement ends', value: 'missed-end' },
]
const KIND_TEXT = Object.fromEntries(WARNING_KINDS.map((k) => [k.value, k.label]))

export const Warnings: CollectionConfig = {
  slug: 'warnings',
  labels: { singular: 'Warning', plural: 'Warnings' },
  admin: { group: 'Team', useAsTitle: 'title', defaultColumns: ['title', 'member', 'kind', 'date', 'readAt'] },
  defaultSort: '-date',
  access: {
    read: ({ req: { user } }) => (hasRole(user, 'admin') ? true : hasRole(user, 'team') && user ? ({ member: { equals: user.id } } as Where) : false),
    create: isAdmin,
    update: ({ req: { user } }) => (hasRole(user, 'admin') ? true : hasRole(user, 'team') && user ? ({ member: { equals: user.id } } as Where) : false),
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        if (hasRole(req.user, 'team')) {
          // The person can only say they have read it.
          if (operation !== 'update' || originalDoc?.readAt) throw new APIError('Only Ernest can change a warning.', 403)
          for (const k of Object.keys(data)) delete data[k]
          data.readAt = new Date().toISOString()
          return data
        }
        const merged: Record<string, any> = { ...(originalDoc ?? {}), ...data }
        if (!String(merged.reason ?? '').trim()) throw new APIError('Give the reason.', 400)
        if (operation === 'create') {
          data.issuedBy = data.issuedBy ?? req.user?.id ?? null
          data.date = data.date || new Date().toISOString()
        }
        const person = await userById(req, refId(merged.member))
        if (!person || person.role !== 'team') throw new APIError('Choose the team member.', 400)
        data.title = `${KIND_TEXT[merged.kind] ?? 'Warning'} · ${person.name || person.email} · ${dayText(merged.date || new Date().toISOString())}`
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const memberId = refId(doc.member)
        const person = await userById(req, memberId)
        if (operation === 'create') {
          await audit(req, { action: `warning.${doc.kind}`, summary: `${KIND_TEXT[doc.kind]} for ${person?.name || person?.email}`, person: memberId, subjectType: 'warnings', subjectId: doc.id, reason: doc.reason })
          await notify(req, { to: [memberId], kind: 'warning', title: `${KIND_TEXT[doc.kind]}: ${doc.reason}`, body: 'Open it and press "I have read this".', link: '/reviews', action: 'Open it', key: `warning:${doc.id}`, important: true })
        }
        if (operation === 'update' && doc.readAt && !previousDoc?.readAt) {
          await notify(req, { to: await adminIds(req), kind: 'warning', title: `${person?.name || 'A team member'} read: ${KIND_TEXT[doc.kind]}`, link: `/people/${memberId}`, email: false })
        }
        return doc
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', admin: { hidden: true } },
    {
      type: 'row',
      fields: [
        { name: 'member', type: 'relationship', relationTo: 'users', required: true, index: true, admin: { width: '34%' } },
        { name: 'kind', type: 'select', required: true, defaultValue: 'warning', options: WARNING_KINDS, admin: { width: '33%' } },
        { name: 'date', type: 'date', index: true, admin: { width: '33%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
      ],
    },
    { name: 'reason', type: 'text', required: true },
    { name: 'detail', label: 'In full', type: 'textarea' },
    {
      type: 'row',
      fields: [
        { name: 'issuedBy', label: 'Issued by', type: 'relationship', relationTo: 'users', admin: { width: '34%', readOnly: true } },
        { name: 'review', label: 'From the review', type: 'relationship', relationTo: 'monthly-reviews', admin: { width: '33%', readOnly: true } },
        { name: 'readAt', label: 'They read it', type: 'date', admin: { width: '33%', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
  ],
}
