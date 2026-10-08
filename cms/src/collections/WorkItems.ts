import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { adminOrMine, hasRole } from '../access/roles'
import { adminMineOrManaged } from '../access/managers'
import { byItems, itemProblem, type ReportCountRule } from '../lib/reportProof'
import { dayBounds } from '../lib/reportCounts'
import { DOCUMENT_TYPES } from './Documents'

/**
 * One piece of typed work with its proof: a post published, a design
 * delivered, a video finished (lib/reportProof.ts). A job role whose typed
 * count asks for proof is reported this way, one item at a time as the work
 * is done, and that day's report counts the items.
 *
 * The item is its own file when the proof is a screenshot or a file, in the
 * private bucket, so post screenshots never crowd anyone's documents.
 * Added for today only; changed or removed only on its day, as a report is.
 */

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)
const today = () => dayBounds(new Date()).start.toISOString()

/** The day's report again, so its counts take in an item added or removed after it was sent. */
async function refreshReport(req: Parameters<NonNullable<NonNullable<CollectionConfig['hooks']>['afterChange']>[number]>[0]['req'], user: unknown, date: string) {
  const r = await req.payload.find({ collection: 'daily-reports', where: { and: [{ user: { equals: idOf(user) } }, { date: { equals: date } }] }, limit: 1, depth: 0, overrideAccess: true, req })
  const report = r.docs[0]
  if (report) await req.payload.update({ collection: 'daily-reports', id: report.id, data: { typed: report.typed } as never, overrideAccess: true, req, context: { refreshItems: true } })
}

export const WorkItems: CollectionConfig = {
  slug: 'work-items',
  labels: { singular: 'Work item', plural: 'Work items' },
  admin: { group: 'Team', useAsTitle: 'text', defaultColumns: ['count', 'text', 'link', 'user', 'date'], description: 'Each piece of typed work, with its link or file, counted by that day’s report.' },
  defaultSort: '-createdAt',
  upload: { mimeTypes: DOCUMENT_TYPES, filesRequiredOnCreate: false },
  access: {
    read: adminMineOrManaged('user'),
    create: ({ req: { user } }) => hasRole(user, 'admin', 'team'),
    update: adminOrMine('user'),
    delete: adminOrMine('user'),
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const user = req.user as { id: number; role?: string } | null
        const team = hasRole(user, 'team')
        if (operation === 'create') {
          if (team) data.user = user!.id
          if (!data.user) throw new APIError('Say whose work this is.', 400)
          data.date = team || !data.date ? today() : dayBounds(data.date).start.toISOString()
        } else {
          for (const k of ['user', 'date', 'count']) data[k] = originalDoc?.[k]
          if (team && data.date !== today()) throw new APIError('Work can be changed on its day only. Ask Ernest if something needs correcting.', 403)
        }
        const owner = await req.payload.findByID({ collection: 'users', id: Number(idOf(data.user)), depth: 1, overrideAccess: true, req }).catch(() => null)
        const rules = (owner?.jobRole && typeof owner.jobRole === 'object' ? (owner.jobRole as { reportCounts?: ReportCountRule[] }).reportCounts : null) ?? []
        const rule = rules.find((c) => c.label === data.count && byItems(c)) ?? null
        const hasFile = Boolean(req.file || data.filename || originalDoc?.filename)
        const problem = itemProblem(rule, { text: data.text, link: data.link, file: hasFile ? 1 : null })
        if (problem) throw new APIError(problem, 400)
        return data
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        if (!hasRole(req.user, 'team')) return
        const item = await req.payload.findByID({ collection: 'work-items', id, depth: 0, overrideAccess: true, req })
        if (item.date !== today()) throw new APIError('Work can be removed on its day only. Ask Ernest if something needs correcting.', 403)
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        await refreshReport(req, doc.user, doc.date)
        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req, context }) => {
        if (context?.deletingPerson) return doc
        await refreshReport(req, doc.user, doc.date)
        return doc
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'user', label: 'Person', type: 'relationship', relationTo: 'users', required: true, index: true, admin: { width: '50%' } },
        { name: 'date', type: 'date', required: true, index: true, admin: { width: '50%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
      ],
    },
    { name: 'count', label: 'Counts as', type: 'text', required: true, admin: { description: 'The job role’s count it is part of, such as Posts published.' } },
    { name: 'text', label: 'What it was', type: 'textarea' },
    { name: 'link', type: 'text' },
  ],
}
