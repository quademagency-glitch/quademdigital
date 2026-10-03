import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/roles'
import { termsFields } from '../fields/terms'

/**
 * A named set of terms to start someone from, such as "Business development
 * trainee". Copying one into `member-terms` is how a person gets their terms;
 * changing a template afterwards changes nobody's pay. Admin only.
 */
export const TermsTemplates: CollectionConfig = {
  slug: 'terms-templates',
  labels: { singular: 'Terms template', plural: 'Terms templates' },
  admin: {
    group: 'Team',
    useAsTitle: 'name',
    defaultColumns: ['name', 'updatedAt'],
    description: 'Named sets of terms to start a new person from. Editing one never changes anyone who already has terms.',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true },
    {
      name: 'notes',
      type: 'textarea',
      admin: { description: 'Which agreement this matches, and anything a number cannot say.' },
    },
    ...termsFields(),
  ],
}
