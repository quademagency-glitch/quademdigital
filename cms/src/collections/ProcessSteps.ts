import type { CollectionConfig } from 'payload'
import { contentEditors } from '../access/roles'

export const ProcessSteps: CollectionConfig = {
  slug: 'processSteps',
  admin: {
    group: 'Website',
    useAsTitle: 'title',
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
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'stepNumber', type: 'number', required: true },
    { name: 'iconSvg', type: 'textarea' },
  ],
}
