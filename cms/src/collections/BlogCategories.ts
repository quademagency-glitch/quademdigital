import type { CollectionConfig } from 'payload'
import { makeSlugHook } from '../hooks/slugify'

export const BlogCategories: CollectionConfig = {
  slug: 'blogCategories',
  labels: {
    singular: 'Blog Category',
    plural: 'Blog Categories',
  },
  admin: {
    group: 'Content',
    useAsTitle: 'title',
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
        beforeValidate: [makeSlugHook('title')],
      },
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
    },
  ],
}
