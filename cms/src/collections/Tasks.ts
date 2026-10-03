import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { hasRole, isAdmin } from '../access/roles'
import { adminIds, notify } from '../lib/notify'

/**
 * A piece of work with a due date (spec 5.8).
 *
 * Ernest gives tasks to anyone. A team member can only ask Ernest for
 * something: a task they make is assigned to an admin, a request such as
 * "Please price this". They see the tasks given to them and the requests they
 * made, tick their own tasks done, and can edit a request until it is done.
 */

const mine = ({ req: { user } }: { req: { user?: { id: number | string; role?: string | null } | null } }) => {
  if (hasRole(user as never, 'admin')) return true
  if (hasRole(user as never, 'team') && user) return { or: [{ assignedTo: { equals: user.id } }, { createdBy: { equals: user.id } }] }
  return false
}

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)

export const Tasks: CollectionConfig = {
  slug: 'tasks',
  labels: { singular: 'Task', plural: 'Tasks' },
  admin: { group: 'Team', useAsTitle: 'title', defaultColumns: ['title', 'assignedTo', 'dueAt', 'status'] },
  defaultSort: 'dueAt',
  access: {
    read: mine as never,
    create: ({ req: { user } }) => hasRole(user, 'admin', 'team'),
    update: mine as never,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const user = req.user as { id: number; role?: string } | null
        const team = hasRole(user, 'team')
        if (operation === 'create') {
          data.createdBy = user?.id ?? null
          if (team) {
            const admins = await adminIds(req)
            const to = Number(idOf(data.assignedTo))
            if (!to) data.assignedTo = admins[0]
            else if (!admins.includes(to)) throw new APIError('You can ask Ernest for something. Tasks for others come from him.', 403)
          }
          if (!data.assignedTo) throw new APIError('Say who the task is for.', 400)
        } else if (team) {
          const isAssignee = String(idOf(originalDoc?.assignedTo)) === String(user!.id)
          const isCreator = String(idOf(originalDoc?.createdBy)) === String(user!.id)
          const allowed = new Set<string>()
          if (isAssignee || isCreator) allowed.add('status')
          if (isCreator && originalDoc?.status !== 'done') for (const k of ['title', 'details', 'dueAt', 'lead']) allowed.add(k)
          for (const k of Object.keys(data)) if (!allowed.has(k)) data[k] = originalDoc?.[k]
        }
        data.createdBy = operation === 'create' ? data.createdBy : originalDoc?.createdBy
        if (data.status === 'done' && originalDoc?.status !== 'done') data.doneAt = new Date().toISOString()
        if (data.status !== 'done') data.doneAt = null
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const by = req.user as { id: number; role?: string; name?: string; email?: string } | null
        const who = by?.name || by?.email || 'Ernest'
        const to = idOf(doc.assignedTo)
        if (operation === 'create' && String(to) !== String(by?.id)) {
          const request = hasRole(by, 'team')
          await notify(req, {
            to: [to as number],
            kind: request ? 'request' : 'task',
            title: request ? `${who} asks: ${doc.title}` : `New task: ${doc.title}`,
            body: [doc.details, doc.dueAt ? `Due ${new Date(doc.dueAt).toDateString()}` : null].filter(Boolean).join('\n\n'),
            link: `/tasks/${doc.id}`,
            action: 'Open the task',
          })
        }
        if (operation === 'update' && doc.status === 'done' && previousDoc?.status !== 'done') {
          const creator = idOf(doc.createdBy)
          if (creator && String(creator) !== String(by?.id)) {
            await notify(req, { to: [creator as number], kind: 'task-done', title: `Done: ${doc.title}`, body: `${who} marked it done.`, link: `/tasks/${doc.id}`, email: false })
          }
        }
        return doc
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'details', type: 'textarea' },
    {
      type: 'row',
      fields: [
        { name: 'assignedTo', label: 'For', type: 'relationship', relationTo: 'users', index: true, admin: { width: '50%' } },
        { name: 'dueAt', label: 'Due', type: 'date', index: true, admin: { width: '50%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          defaultValue: 'open',
          index: true,
          options: [
            { label: 'Open', value: 'open' },
            { label: 'Done', value: 'done' },
          ],
          admin: { width: '50%' },
        },
        { name: 'doneAt', label: 'Done on', type: 'date', admin: { readOnly: true, width: '50%' } },
      ],
    },
    { name: 'lead', type: 'relationship', relationTo: 'leads', admin: { description: 'Optional: the lead this is about.' } },
    { name: 'createdBy', label: 'From', type: 'relationship', relationTo: 'users', admin: { readOnly: true, position: 'sidebar' } },
  ],
}
