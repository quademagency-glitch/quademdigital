import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { adminField, adminOrTeam, isAdmin } from '../access/roles'
import { refId } from '../lib/moneyContext'

/**
 * A training module (spec 5.12 and 14.10): one part of a job role's training
 * area, with its lesson to read, materials from the library, checklist items,
 * and an optional short quiz. Ernest writes them; the team reads them. Quiz answers are
 * admin-only, so the quiz is marked by the CMS and never in the browser.
 */
export const TrainingModules: CollectionConfig = {
  slug: 'training-modules',
  labels: { singular: 'Training module', plural: 'Training modules' },
  admin: { group: 'Team', useAsTitle: 'title', defaultColumns: ['title', 'jobRole', 'area', 'order', 'active'] },
  defaultSort: 'order',
  access: { read: adminOrTeam, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const merged: Record<string, any> = { ...(originalDoc ?? {}), ...data }
        const roleId = refId(merged.jobRole)
        if (!roleId) throw new APIError('Choose the job role.', 400)
        const role = (await req.payload.findByID({ collection: 'job-roles', id: roleId, depth: 0, overrideAccess: true, req }).catch(() => null)) as { trainingAreas?: { name?: string }[] } | null
        const areas = (role?.trainingAreas ?? []).map((a) => a.name)
        if (!areas.includes(merged.area)) throw new APIError(`Choose one of the role's training areas: ${areas.join('; ') || 'add them to the job role first'}.`, 400)
        for (const [i, q] of (merged.quiz ?? []).entries()) {
          const n = (q.choices ?? []).length
          if (n < 2) throw new APIError(`Question ${i + 1} needs at least two choices.`, 400)
          if (!(Number(q.answer) >= 1 && Number(q.answer) <= n)) throw new APIError(`Question ${i + 1}: say which choice is right.`, 400)
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'jobRole', label: 'Job role', type: 'relationship', relationTo: 'job-roles', required: true, index: true, admin: { width: '34%' } },
        { name: 'area', type: 'text', required: true, admin: { width: '33%', description: "One of the role's training areas, word for word." } },
        { name: 'order', type: 'number', defaultValue: 1, admin: { width: '16%' } },
        { name: 'active', type: 'checkbox', defaultValue: true, admin: { width: '17%' } },
      ],
    },
    { name: 'summary', type: 'textarea', admin: { description: 'What this module teaches, in a line or two.' } },
    {
      name: 'lesson',
      type: 'textarea',
      admin: {
        rows: 18,
        description:
          'What the team reads, written in the portal. ## starts a heading (add [rule] or [testing] for its label), - a point, 1. a step, > a message example, and "left | right" a two-column row. **Bold** works too.',
      },
    },
    { name: 'minutes', label: 'Minutes to read', type: 'number', min: 1, max: 120, admin: { description: 'About how long the module takes, shown beside its title.' } },
    { name: 'materials', type: 'relationship', relationTo: 'documents', hasMany: true, filterOptions: { kind: { equals: 'library' } } },
    {
      name: 'items',
      label: 'Checklist',
      type: 'array',
      labels: { singular: 'Item', plural: 'Items' },
      fields: [{ name: 'text', type: 'text', required: true }],
    },
    {
      name: 'quiz',
      type: 'array',
      labels: { singular: 'Question', plural: 'Questions' },
      admin: { description: 'Optional. Marked by the CMS; the team never sees the answers.' },
      fields: [
        { name: 'question', type: 'text', required: true },
        { name: 'choices', type: 'array', fields: [{ name: 'text', type: 'text', required: true }] },
        { name: 'answer', label: 'Right choice (1 for the first)', type: 'number', min: 1, access: { read: adminField } },
      ],
    },
    { name: 'passMark', label: 'Pass mark, %', type: 'number', defaultValue: 80, min: 0, max: 100 },
  ],
}
