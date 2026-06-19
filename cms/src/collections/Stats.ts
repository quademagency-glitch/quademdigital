import type { CollectionConfig } from 'payload'

export const Stats: CollectionConfig = {
  slug: 'stats',
  admin: {
    group: 'Website',
    useAsTitle: 'label',
    components: {
      edit: {
        SaveButton: './components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'value', type: 'text', required: true },
    { name: 'label', type: 'text', required: true },
    { name: 'prefix', type: 'text' },
    { name: 'suffix', type: 'text' },
    { name: 'order', type: 'number' },
    {
      name: 'published',
      label: 'Published',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Uncheck to hide this stat from the site until it reflects a real number.' },
    },
  ],
}
