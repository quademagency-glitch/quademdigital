import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'
import { hasRole, isAdmin } from '../access/roles'
import { adminIds, notify } from '../lib/notify'
import { DELIVERABLE_STATUSES } from '../lib/projects'
import { onTheProject } from './Projects'

/**
 * One thing a project delivers (spec 14.5): an owner, a due date and a status
 * (To do, Doing, Ready for review, Done), with files and comments on the
 * project. Ernest and the project's lead plan them; the owner moves their own
 * through the stages and writes a note.
 */

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)

const projectOf = (req: PayloadRequest, id: unknown) =>
  req.payload.findByID({ collection: 'projects', id: Number(idOf(id)), depth: 0, overrideAccess: true, req }).catch(() => null)

export const Deliverables: CollectionConfig = {
  slug: 'deliverables',
  labels: { singular: 'Deliverable', plural: 'Deliverables' },
  admin: { group: 'Team', useAsTitle: 'title', defaultColumns: ['title', 'project', 'owner', 'dueAt', 'status'] },
  defaultSort: 'order',
  access: {
    read: onTheProject('project.') as never,
    create: ({ req: { user } }) => hasRole(user, 'admin', 'team'),
    // The owner moves their own; the lead and Ernest change anything. The hook below holds the line.
    update: ({ req: { user } }) => {
      if (hasRole(user, 'admin')) return true
      if (!user || !hasRole(user, 'team')) return false
      return { or: [{ owner: { equals: user.id } }, { 'project.lead': { equals: user.id } }] } as Where
    },
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const user = req.user as { id: number; role?: string } | null
        const project = await projectOf(req, data.project ?? originalDoc?.project)
        if (!project) throw new APIError('Choose the project.', 400)
        const lead = String(idOf(project.lead)) === String(user?.id)
        if (hasRole(user, 'team') && !lead) {
          if (operation === 'create') throw new APIError('Ernest or the project lead adds deliverables.', 403)
          // The owner: their status and note, nothing else.
          for (const k of Object.keys(data)) if (k !== 'status' && k !== 'note') data[k] = originalDoc?.[k]
        }
        // An owner must be on the project, or they could not see it.
        const owner = idOf(data.owner ?? originalDoc?.owner)
        if (owner) {
          const on = [...(Array.isArray(project.members) ? project.members : []), project.lead].some((m) => String(idOf(m)) === String(owner))
          const ownerIsAdmin = (await adminIds(req)).some((a) => String(a) === String(owner))
          if (!on && !ownerIsAdmin) throw new APIError('Add them to the project first, then give them the deliverable.', 400)
        }
        if (data.status === 'done' && originalDoc?.status !== 'done') data.doneAt = new Date().toISOString()
        if (data.status && data.status !== 'done') data.doneAt = null
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const by = req.user as { id: number; name?: string | null; email?: string } | null
        const who = by?.name || by?.email || 'Someone'
        const project = await projectOf(req, doc.project)
        const link = `/projects/${idOf(doc.project)}`
        const owner = idOf(doc.owner)
        if (owner && String(owner) !== String(idOf(previousDoc?.owner)) && String(owner) !== String(by?.id)) {
          await notify(req, {
            to: [Number(owner)],
            kind: 'deliverable',
            title: `For you: ${doc.title}`,
            body: [project?.title ? `On ${project.title}.` : null, doc.dueAt ? `Due ${new Date(doc.dueAt).toDateString()}.` : null].filter(Boolean).join(' '),
            link,
            action: 'Open the project',
          })
        }
        // Ready for review, or done: the lead and Ernest hear about it.
        if (operation === 'update' && doc.status !== previousDoc?.status && (doc.status === 'review' || doc.status === 'done')) {
          const to = new Set<number>((await adminIds(req)).map(Number))
          if (project?.lead) to.add(Number(idOf(project.lead)))
          if (by) to.delete(Number(by.id))
          await notify(req, {
            to: [...to],
            kind: 'deliverable',
            title: `${doc.status === 'review' ? 'Ready for review' : 'Done'}: ${doc.title}`,
            body: `${who}, on ${project?.title ?? 'a project'}.${doc.note ? ` ${doc.note}` : ''}`,
            link,
            action: 'Open the project',
            email: doc.status === 'review',
          })
        }
        return doc
      },
    ],
  },
  fields: [
    { name: 'project', type: 'relationship', relationTo: 'projects', required: true, index: true },
    { name: 'title', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'owner', type: 'relationship', relationTo: 'users', index: true, admin: { width: '34%' } },
        { name: 'dueAt', label: 'Due', type: 'date', index: true, admin: { width: '33%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
        { name: 'status', type: 'select', required: true, defaultValue: 'todo', index: true, options: [...DELIVERABLE_STATUSES], admin: { width: '33%' } },
      ],
    },
    { name: 'note', type: 'textarea', admin: { description: 'Where it stands, a link to the work, what is needed.' } },
    {
      type: 'row',
      fields: [
        { name: 'order', type: 'number', admin: { width: '50%' } },
        { name: 'doneAt', label: 'Done on', type: 'date', admin: { width: '50%', readOnly: true } },
      ],
    },
  ],
}
