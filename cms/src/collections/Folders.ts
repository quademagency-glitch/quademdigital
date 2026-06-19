import type { CollectionConfig } from 'payload'

export const Folders: CollectionConfig = {
  slug: 'folders',
  admin: {
    group: 'System',
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}
