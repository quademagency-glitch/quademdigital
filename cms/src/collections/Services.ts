import type { CollectionConfig } from 'payload'
import { makeSlugHook } from '../hooks/slugify'

export const Services: CollectionConfig = {
  slug: 'services',
  labels: { singular: 'Service', plural: 'Services' },
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    components: {
      edit: {
        SaveButton: './components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
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
    { name: 'featuredImage', label: 'Featured Image (for Overview)', type: 'upload', relationTo: 'media' },
    { name: 'rawMedia', label: 'Hero Media (Image)', type: 'upload', relationTo: 'media', admin: { description: 'Image shown on the service page hero.' } },
    { name: 'mockupMedia', label: 'Mockup Image', type: 'upload', relationTo: 'media', admin: { description: 'Optional device-mockup image to show instead of the raw hero media.' } },
    { name: 'mockupStatus', label: 'Mockup Status', type: 'select', defaultValue: 'pending', options: [
      { label: 'Pending', value: 'pending' },
      { label: 'Processing', value: 'processing' },
      { label: 'Ready', value: 'ready' },
      { label: 'Failed', value: 'failed' },
    ] },
  ],
}
