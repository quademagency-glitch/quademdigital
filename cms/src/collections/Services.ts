import type { CollectionConfig } from 'payload'
import { makeSlugHook } from '../hooks/slugify'

export const Services: CollectionConfig = {
  slug: 'services',
  labels: { singular: 'Service', plural: 'Services' },
  admin: { useAsTitle: 'title' },
  access: { read: () => true },
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    {
      name: 'slug',
      label: 'Slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      hooks: {
        beforeValidate: [makeSlugHook('title')],
      },
    },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'tags', label: 'Tags', type: 'array', fields: [{ name: 'tag', type: 'text' }] },
    { name: 'iconSvg', label: 'Icon SVG', type: 'textarea', admin: { description: 'Raw SVG code for the icon' } },
    { name: 'body', label: 'Body Content', type: 'json' },
    { name: 'order', label: 'Order', type: 'number' },
  ],
}
