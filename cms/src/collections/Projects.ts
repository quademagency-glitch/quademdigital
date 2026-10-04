import type { CollectionConfig, Where } from 'payload'
import { adminField, hasRole, isAdmin } from '../access/roles'
import { audit } from '../lib/audit'
import { notify } from '../lib/notify'
import { PROJECT_STATUSES } from '../lib/projects'

/**
 * A client project (spec 14.5): delivery work for one client, with the people
 * on it and its deliverables (the deliverables collection), files and
 * comments. Ernest makes projects; a team member sees only the ones they are
 * on, as a member or as the lead.
 *
 * The team never reads the clients collection (it holds portal access codes,
 * spec 3.2), so the client's name is copied here when the project is saved.
 */

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)
const ids = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(idOf(x))).filter((x) => x && x !== 'undefined') : [])

/** Ernest sees every project; a team member the ones they are on. */
export const onTheProject = (prefix = ''): ((args: { req: { user?: unknown } }) => boolean | Where) =>
  ({ req: { user } }) => {
    const u = user as { id: number; role?: string } | null
    if (hasRole(u, 'admin')) return true
    if (!u || !hasRole(u, 'team')) return false
    return { or: [{ [`${prefix}members`]: { equals: u.id } }, { [`${prefix}lead`]: { equals: u.id } }] } as Where
  }

export const Projects: CollectionConfig = {
  slug: 'projects',
  labels: { singular: 'Project', plural: 'Projects' },
  admin: { group: 'Team', useAsTitle: 'title', defaultColumns: ['title', 'clientName', 'status', 'dueDate', 'updatedAt'] },
  defaultSort: '-updatedAt',
  access: { read: onTheProject(), create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const client = idOf(data.client ?? originalDoc?.client)
        if (client) {
          const c = await req.payload.findByID({ collection: 'clients', id: Number(client), depth: 0, overrideAccess: true, req }).catch(() => null)
          data.clientName = c?.clientName ?? data.clientName ?? null
        }
        if (data.status === 'done' && originalDoc?.status !== 'done') data.doneAt = new Date().toISOString()
        if (data.status && data.status !== 'done') data.doneAt = null
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        // Whoever joins the project hears about it.
        const before = new Set([...ids(previousDoc?.members), String(idOf(previousDoc?.lead) ?? '')])
        const joined = [...new Set([...ids(doc.members), String(idOf(doc.lead) ?? '')])].filter((x) => x && x !== 'undefined' && !before.has(x) && x !== String(req.user?.id))
        if (joined.length) {
          await notify(req, {
            to: joined.map(Number),
            kind: 'project',
            title: `You are on a project: ${doc.title}`,
            body: [doc.clientName ? `For ${doc.clientName}.` : null, doc.dueDate ? `Due ${new Date(doc.dueDate).toDateString()}.` : null].filter(Boolean).join(' '),
            link: `/projects/${doc.id}`,
            action: 'Open the project',
          })
        }
        if (operation === 'update' && doc.status !== previousDoc?.status) {
          await audit(req, { action: `project.${doc.status}`, summary: `${doc.title}: ${PROJECT_STATUSES.find((s) => s.value === doc.status)?.label ?? doc.status}`, subjectType: 'projects', subjectId: doc.id })
        }
        return doc
      },
    ],
    // Its deliverables, comments and files go with it; nothing else points at them.
    beforeDelete: [
      async ({ id, req }) => {
        for (const collection of ['deliverables', 'comments', 'documents'] as const) {
          const rows = await req.payload.find({ collection, where: { project: { equals: id } }, limit: 500, depth: 0, overrideAccess: true, req })
          for (const r of rows.docs) await req.payload.delete({ collection, id: r.id, overrideAccess: true, req })
        }
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'client', type: 'relationship', relationTo: 'clients', access: { read: adminField }, admin: { width: '50%' } },
        { name: 'clientName', label: 'Client', type: 'text', admin: { width: '50%', readOnly: true, description: 'Copied from the client, for the team.' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'status', type: 'select', required: true, defaultValue: 'planning', index: true, options: [...PROJECT_STATUSES], admin: { width: '34%' } },
        { name: 'startDate', label: 'Starts', type: 'date', admin: { width: '33%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
        { name: 'dueDate', label: 'Due', type: 'date', admin: { width: '33%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'lead', label: 'Lead', type: 'relationship', relationTo: 'users', index: true, admin: { width: '50%', description: 'Runs it day to day; can add deliverables.' } },
        { name: 'members', label: 'On the project', type: 'relationship', relationTo: 'users', hasMany: true, index: true, admin: { width: '50%' } },
      ],
    },
    { name: 'description', label: 'What it is', type: 'textarea', admin: { rows: 8 } },
    { name: 'deal', type: 'relationship', relationTo: 'proposals', access: { read: adminField }, admin: { description: 'Optional: the deal it delivers. Ernest only.' } },
    { name: 'doneAt', label: 'Done on', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
  ],
}
