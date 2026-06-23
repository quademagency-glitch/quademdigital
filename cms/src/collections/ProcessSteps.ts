import type { CollectionConfig } from 'payload'

export const ProcessSteps: CollectionConfig = {
  slug: 'processSteps',
  admin: {
    group: 'Website',
    useAsTitle: 'title',
    components: {
      edit: {
        SaveButton: '../components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'stepNumber', type: 'number', required: true },
    { name: 'iconSvg', type: 'textarea' },
  ],
}
