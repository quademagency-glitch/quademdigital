import type { CollectionConfig } from 'payload'
import { contentEditors } from '../access/roles'

export const Faqs: CollectionConfig = {
  slug: 'faqs',
  labels: { singular: 'FAQ', plural: 'FAQs' },
  admin: {
    group: 'Website',
    useAsTitle: 'question',
    components: {
      edit: {
        SaveButton: './components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
  access: {
    read: () => true,
    create: contentEditors,
    update: contentEditors,
    delete: contentEditors,
  },
  fields: [
    { name: 'question', label: 'Question', type: 'text' },
    { name: 'answer', label: 'Answer', type: 'textarea' },
    { name: 'order', label: 'Order', type: 'number' },
  ],
}
