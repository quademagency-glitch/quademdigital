import type { CollectionConfig, Where } from 'payload'
import { adminField, hasRole, isAdmin } from '../access/roles'
import { audit } from '../lib/audit'
import { slugify } from '../lib/hiring'

/**
 * A job Quadem is hiring for (spec 14.4). Draft while Ernest writes it; Open
 * puts it on the public jobs page of the team portal (/jobs/<slug>), where
 * anyone can apply; Closed takes it down and keeps the applicants.
 *
 * Anyone can read an open job, without signing in: that is the page people
 * apply on. The default terms for an offer stay Ernest's.
 */
export const Openings: CollectionConfig = {
  slug: 'openings',
  labels: { singular: 'Opening', plural: 'Openings' },
  admin: { group: 'Team', useAsTitle: 'title', defaultColumns: ['title', 'status', 'location', 'closesAt', 'updatedAt'] },
  defaultSort: '-createdAt',
  access: {
    read: ({ req: { user } }) => (hasRole(user, 'admin') ? true : ({ status: { equals: 'open' } } as Where)),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        // The address is made once, from the title, so links already shared keep working.
        if (operation === 'create' || !originalDoc?.slug) {
          const base = slugify(String(data.title ?? originalDoc?.title ?? ''))
          let slug = base
          for (let n = 2; n < 50; n++) {
            const taken = await req.payload.find({ collection: 'openings', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true, req })
            if (!taken.docs.length || String(taken.docs[0].id) === String(originalDoc?.id)) break
            slug = `${base}-${n}`
          }
          data.slug = slug
        } else {
          data.slug = originalDoc.slug
        }
        if (data.status === 'open' && originalDoc?.status !== 'open') data.openedAt = new Date().toISOString()
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        if (operation === 'update' && doc.status !== previousDoc?.status) {
          await audit(req, {
            action: `opening.${doc.status}`,
            summary: `${doc.title}: ${doc.status === 'open' ? 'open for applications' : doc.status === 'closed' ? 'closed' : 'back to draft'}`,
            subjectType: 'openings',
            subjectId: doc.id,
          })
        }
        return doc
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true, admin: { description: 'As applicants see it, such as Business development trainee.' } },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'draft',
          index: true,
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Open', value: 'open' },
            { label: 'Closed', value: 'closed' },
          ],
          admin: { width: '34%' },
        },
        { name: 'slug', type: 'text', unique: true, index: true, admin: { width: '33%', readOnly: true, description: 'The public address, made from the title.' } },
        { name: 'closesAt', label: 'Closes', type: 'date', admin: { width: '33%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' }, description: 'Optional. Applications stop after this day.' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'jobRole', label: 'Job role', type: 'relationship', relationTo: 'job-roles', admin: { width: '34%' } },
        { name: 'location', type: 'text', admin: { width: '33%', description: 'Such as Lagos, remote.' } },
        { name: 'country', type: 'text', admin: { width: '33%', description: 'Two letters, such as NG. Sets the currency of an offer.' } },
      ],
    },
    { name: 'summary', type: 'textarea', admin: { description: 'Two or three lines for the jobs list.' } },
    { name: 'description', type: 'textarea', admin: { rows: 14, description: 'The full description. A blank line starts a new paragraph; a line starting "- " is a bullet.' } },
    {
      name: 'questions',
      label: 'Questions for applicants',
      type: 'array',
      admin: { description: 'Asked on the application form, in this order.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'question', type: 'text', required: true, admin: { width: '70%' } },
            { name: 'required', type: 'checkbox', defaultValue: false, admin: { width: '30%' } },
          ],
        },
      ],
    },
    { name: 'cvRequired', label: 'CV required', type: 'checkbox', defaultValue: true },
    {
      name: 'termsTemplate',
      label: 'Terms for an offer',
      type: 'relationship',
      relationTo: 'terms-templates',
      access: { read: adminField },
      admin: { description: 'The terms an offer starts from. Each offer can choose others.' },
    },
    { name: 'openedAt', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
  ],
}
