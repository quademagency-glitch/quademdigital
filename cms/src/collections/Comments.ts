import type { CollectionConfig, Where } from 'payload'
import { APIError } from 'payload'
import { hasRole, isAdmin } from '../access/roles'
import { managedIds } from '../access/managers'
import { adminIds, notify } from '../lib/notify'

/**
 * A conversation about one lead or task (spec 5.10), instead of scattered
 * WhatsApp messages. Anyone who can see the record can comment on it; the
 * people involved are told, apart from the author. The author can edit for ten
 * minutes; only an admin can delete, so the history stays honest.
 */

const EDIT_WINDOW_MS = 10 * 60_000
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)

export const Comments: CollectionConfig = {
  slug: 'comments',
  labels: { singular: 'Comment', plural: 'Comments' },
  admin: { group: 'Team', useAsTitle: 'body', defaultColumns: ['body', 'author', 'lead', 'task', 'createdAt'] },
  defaultSort: 'createdAt',
  access: {
    read: async ({ req }) => {
      const user = req.user
      if (hasRole(user, 'admin')) return true
      if (!hasRole(user, 'team') || !user) return false
      // A manager also follows the conversation on their people's tasks.
      const people = await managedIds(req)
      return {
        or: [
          { 'lead.assignedTo': { equals: user.id } },
          { 'task.assignedTo': { equals: user.id } },
          { 'task.createdBy': { equals: user.id } },
          ...(people.length ? [{ 'task.assignedTo': { in: people } }] : []),
          // A project's conversation: everyone on it (spec 14.5).
          { 'project.members': { equals: user.id } },
          { 'project.lead': { equals: user.id } },
        ],
      } as Where
    },
    create: ({ req: { user } }) => hasRole(user, 'admin', 'team'),
    update: ({ req: { user } }) => (user ? { author: { equals: user.id } } : false),
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const user = req.user!
        if (operation === 'create') {
          data.author = user.id
          if ([data.lead, data.task, data.project].filter(Boolean).length !== 1) throw new APIError('A comment belongs to one lead, one task or one project.', 400)
          // The commenter must be able to see the record.
          const collection = data.lead ? 'leads' : data.task ? 'tasks' : 'projects'
          const record = await req.payload
            .findByID({ collection, id: Number(idOf(data.lead ?? data.task ?? data.project)), depth: 0, overrideAccess: false, user, req })
            .catch(() => null)
          if (!record) throw new APIError('That is not there, or it is not yours.', 404)
        } else {
          if (Date.now() - new Date(originalDoc?.createdAt).getTime() > EDIT_WINDOW_MS) {
            throw new APIError('A comment can be changed for ten minutes after it is written.', 403)
          }
          for (const k of Object.keys(data)) if (k !== 'body') data[k] = originalDoc?.[k]
          data.editedAt = new Date().toISOString()
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return doc
        const author = req.user as { id: number; name?: string; email?: string }
        const to = new Set<number>(await adminIds(req))
        let title = ''
        let link = ''
        if (doc.lead) {
          const lead = await req.payload.findByID({ collection: 'leads', id: Number(idOf(doc.lead)), depth: 0, overrideAccess: true, req })
          if (lead.assignedTo) to.add(Number(idOf(lead.assignedTo)))
          title = `${author.name || author.email} on ${lead.title || lead.businessName || 'a lead'}`
          link = `/leads/${lead.id}`
        } else if (doc.project) {
          const project = await req.payload.findByID({ collection: 'projects', id: Number(idOf(doc.project)), depth: 0, overrideAccess: true, req })
          for (const u of [...(Array.isArray(project.members) ? project.members : []), project.lead]) if (u) to.add(Number(idOf(u)))
          title = `${author.name || author.email} on ${project.title}`
          link = `/projects/${project.id}`
        } else {
          const task = await req.payload.findByID({ collection: 'tasks', id: Number(idOf(doc.task)), depth: 0, overrideAccess: true, req })
          for (const u of [task.assignedTo, task.createdBy]) if (u) to.add(Number(idOf(u)))
          title = `${author.name || author.email} on ${task.title}`
          link = `/tasks/${task.id}`
        }
        to.delete(Number(author.id))
        await notify(req, { to: [...to], kind: 'comment', title, body: doc.body, link, action: 'Reply' })
        return doc
      },
    ],
  },
  fields: [
    { name: 'lead', type: 'relationship', relationTo: 'leads', index: true },
    { name: 'task', type: 'relationship', relationTo: 'tasks', index: true },
    { name: 'project', type: 'relationship', relationTo: 'projects', index: true },
    { name: 'author', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
    { name: 'body', type: 'textarea', required: true },
    { name: 'editedAt', type: 'date', admin: { readOnly: true } },
  ],
}
