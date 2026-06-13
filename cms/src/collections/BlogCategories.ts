import type { CollectionConfig } from 'payload'

export const BlogCategories: CollectionConfig = {
  slug: 'blogCategories',
  labels: {
    singular: 'Blog Category',
    plural: 'Blog Categories',
  },
  admin: {
    useAsTitle: 'title',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'title',
      label: 'Title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      label: 'Slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'URL slug (e.g. digital-marketing)',
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (!value && data?.title) {
              return data.title.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '')
            }
            return value
          },
        ],
      },
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
    },
  ],
}
