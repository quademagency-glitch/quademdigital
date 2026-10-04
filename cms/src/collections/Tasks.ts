import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { hasRole, isAdmin } from '../access/roles'
import { TASK_PRIORITIES, TASK_REPEATS, nextDue } from '../lib/projects'
import { adminMineOrManaged, manages } from '../access/managers'
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
/** Theirs, and for a manager also their people's tasks (spec 14.1). */
const mineOrManaged = adminMineOrManaged('assignedTo', (user) => [{ createdBy: { equals: user.id } }])

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)

export const Tasks: CollectionConfig = {
  slug: 'tasks',
  labels: { singular: 'Task', plural: 'Tasks' },
  admin: { group: 'Team', useAsTitle: 'title', defaultColumns: ['title', 'assignedTo', 'dueAt', 'status'] },
  defaultSort: 'dueAt',
  access: {
    read: mineOrManaged,
    create: ({ req: { user } }) => hasRole(user, 'admin', 'team'),
    update: mine as never,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req, context }) => {
        const user = req.user as { id: number; role?: string } | null
        const team = hasRole(user, 'team')
        // The next copy of a repeating task: made by the system, keeping who gave it.
        const copy = context?.repeatCopy === true
        if (operation === 'create') {
          if (!copy) data.createdBy = user?.id ?? null
          if (team && !copy) {
            const admins = await adminIds(req)
            const to = Number(idOf(data.assignedTo))
            // A manager gives tasks to their own people; anyone can ask Ernest.
            if (!to) data.assignedTo = admins[0]
            else if (!admins.includes(to) && !(await manages(req, to))) throw new APIError('You can ask Ernest for something. Tasks for others come from him or their manager.', 403)
          }
          if (!data.assignedTo) throw new APIError('Say who the task is for.', 400)
        } else if (team) {
          const isAssignee = String(idOf(originalDoc?.assignedTo)) === String(user!.id)
          const isCreator = String(idOf(originalDoc?.createdBy)) === String(user!.id)
          const allowed = new Set<string>()
          if (isAssignee || isCreator) {
            allowed.add('status')
            allowed.add('checklist')
          }
          if (isCreator && originalDoc?.status !== 'done') for (const k of ['title', 'details', 'dueAt', 'lead', 'priority', 'repeat']) allowed.add(k)
          for (const k of Object.keys(data)) if (!allowed.has(k)) data[k] = originalDoc?.[k]
          // Whoever does the task ticks the checklist; only whoever wrote it changes its words.
          if (!isCreator && Array.isArray(data.checklist)) {
            const ticks = new Map((data.checklist as { id?: string; done?: boolean }[]).map((r) => [String(r.id), Boolean(r.done)]))
            data.checklist = ((originalDoc?.checklist ?? []) as { id?: string; done?: boolean }[]).map((r) => ({ ...r, done: ticks.has(String(r.id)) ? ticks.get(String(r.id)) : r.done }))
          }
        }
        if (Array.isArray(data.checklist)) {
          const before = new Map(((originalDoc?.checklist ?? []) as { id?: string; done?: boolean; doneAt?: string }[]).map((r) => [String(r.id), r]))
          const now = new Date().toISOString()
          data.checklist = (data.checklist as { id?: string; text?: string; done?: boolean; doneAt?: string | null }[])
            .filter((r) => String(r.text ?? '').trim())
            .map((r) => ({ ...r, done: Boolean(r.done), doneAt: r.done ? (before.get(String(r.id))?.done ? (before.get(String(r.id))?.doneAt ?? now) : now) : null }))
        }
        data.createdBy = operation === 'create' ? data.createdBy : originalDoc?.createdBy
        if (data.status === 'done' && originalDoc?.status !== 'done') data.doneAt = new Date().toISOString()
        if (data.status !== 'done') data.doneAt = null
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req, context }) => {
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
        // A repeating task, done: the next copy, with a fresh checklist (spec 14.5).
        if (operation === 'update' && doc.status === 'done' && previousDoc?.status !== 'done' && doc.repeat && doc.repeat !== 'none' && !context?.repeatCopy) {
          const due = nextDue(doc.repeat, doc.dueAt, new Date().toISOString().slice(0, 10))
          await req.payload
            .create({
              collection: 'tasks',
              data: {
                title: doc.title,
                details: doc.details,
                assignedTo: idOf(doc.assignedTo),
                createdBy: idOf(doc.createdBy),
                dueAt: due ? `${due}T00:00:00.000Z` : null,
                priority: doc.priority,
                repeat: doc.repeat,
                lead: idOf(doc.lead) ?? null,
                checklist: (doc.checklist ?? []).map((r: { text?: string }) => ({ text: r.text, done: false })),
                status: 'open',
              } as never,
              context: { repeatCopy: true },
              overrideAccess: true,
              req,
            })
            .catch((err) => req.payload.logger.error({ err }, 'A repeating task was done, but its next copy was not made'))
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
    {
      type: 'row',
      fields: [
        { name: 'priority', type: 'select', defaultValue: 'normal', index: true, options: [...TASK_PRIORITIES], admin: { width: '50%' } },
        { name: 'repeat', type: 'select', defaultValue: 'none', options: [...TASK_REPEATS], admin: { width: '50%', description: 'When it is done, the next copy is made with its own due date.' } },
      ],
    },
    {
      name: 'checklist',
      type: 'array',
      admin: { description: 'Steps inside the task. Whoever does it ticks them.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'text', type: 'text', required: true, admin: { width: '60%' } },
            { name: 'done', type: 'checkbox', defaultValue: false, admin: { width: '15%' } },
            { name: 'doneAt', label: 'Ticked', type: 'date', admin: { width: '25%', readOnly: true } },
          ],
        },
      ],
    },
    { name: 'lead', type: 'relationship', relationTo: 'leads', admin: { description: 'Optional: the lead this is about.' } },
    { name: 'createdBy', label: 'From', type: 'relationship', relationTo: 'users', admin: { readOnly: true, position: 'sidebar' } },
  ],
}
