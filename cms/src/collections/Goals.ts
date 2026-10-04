import type { CollectionConfig, Where } from 'payload'
import { APIError } from 'payload'
import { hasRole, isAdmin } from '../access/roles'
import { refId, userById } from '../lib/moneyContext'
import { adminIds, notify } from '../lib/notify'

/**
 * Goals Ernest sets for one person (spec 14.5), such as "Close 2 clinics in
 * Abuja this month", with progress. The targets in a person's terms are on
 * their Targets screen; these are the extra ones. The person moves the
 * progress and adds a note; the goal itself is Ernest's.
 */
export const Goals: CollectionConfig = {
  slug: 'goals',
  labels: { singular: 'Goal', plural: 'Goals' },
  admin: { group: 'Team', useAsTitle: 'title', defaultColumns: ['title', 'member', 'progress', 'target', 'status', 'dueDate'] },
  defaultSort: 'dueDate',
  access: {
    read: ({ req: { user } }) => (hasRole(user, 'admin') ? true : hasRole(user, 'team') && user ? ({ member: { equals: user.id } } as Where) : false),
    create: isAdmin,
    update: ({ req: { user } }) => (hasRole(user, 'admin') ? true : hasRole(user, 'team') && user ? ({ and: [{ member: { equals: user.id } }, { status: { equals: 'open' } }] } as Where) : false),
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        if (hasRole(req.user, 'team')) {
          // Theirs: the progress, a note, and saying a goal with no number is reached.
          for (const k of Object.keys(data)) if (!['progress', 'note'].includes(k) && !(k === 'status' && data.status === 'done')) delete data[k]
        } else if (operation === 'create') {
          data.setBy = req.user?.id ?? null
          data.status = data.status || 'open'
        }
        const merged: Record<string, any> = { ...(originalDoc ?? {}), ...data }
        if (!String(merged.title ?? '').trim()) throw new APIError('Say what the goal is.', 400)
        if (Number(merged.progress) < 0) throw new APIError('Progress cannot be below nought.', 400)
        // Reaching the number closes it.
        if (merged.status === 'open' && Number(merged.target) > 0 && Number(merged.progress) >= Number(merged.target)) data.status = 'done'
        if (data.status && data.status !== originalDoc?.status && data.status !== 'open') data.closedAt = new Date().toISOString()
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const memberId = refId(doc.member)
        if (operation === 'create') {
          await notify(req, { to: [memberId], kind: 'goal', title: `New goal: ${doc.title}`, body: doc.dueDate ? `By ${String(doc.dueDate).slice(0, 10)}.` : undefined, link: '/goals', action: 'Open your goals', key: `goal:${doc.id}` })
        }
        if (operation === 'update' && doc.status === 'done' && previousDoc?.status !== 'done' && hasRole(req.user, 'team')) {
          const person = await userById(req, memberId)
          await notify(req, { to: await adminIds(req), kind: 'goal', title: `${person?.name || 'A team member'} reached a goal: ${doc.title}`, link: `/people/${memberId}`, email: false })
        }
        return doc
      },
    ],
  },
  fields: [
    { name: 'title', label: 'Goal', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'member', type: 'relationship', relationTo: 'users', required: true, index: true, admin: { width: '34%' } },
        { name: 'dueDate', label: 'By', type: 'date', index: true, admin: { width: '33%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'open',
          index: true,
          options: [
            { label: 'Open', value: 'open' },
            { label: 'Reached', value: 'done' },
            { label: 'Missed', value: 'missed' },
            { label: 'Dropped', value: 'dropped' },
          ],
          admin: { width: '33%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'target', type: 'number', min: 0, admin: { width: '25%', description: 'Empty for a goal that is simply done or not.' } },
        { name: 'progress', type: 'number', min: 0, defaultValue: 0, admin: { width: '25%' } },
        { name: 'unit', type: 'text', admin: { width: '25%', description: 'Such as clinics or deals.' } },
        { name: 'setBy', label: 'Set by', type: 'relationship', relationTo: 'users', admin: { width: '25%', readOnly: true } },
      ],
    },
    { name: 'note', type: 'text', admin: { description: 'The latest word on it, from either side.' } },
    { name: 'closedAt', label: 'Closed on', type: 'date', admin: { readOnly: true } },
  ],
}
