import type { CollectionConfig } from 'payload'

export const Stats: CollectionConfig = {
  slug: 'stats',
  admin: {
    useAsTitle: 'label',
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
  ],
}
