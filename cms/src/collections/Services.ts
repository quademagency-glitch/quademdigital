import type { CollectionConfig } from 'payload'
import { makeSlugHook } from '../hooks/slugify'
import { generateServiceMockupHook } from '../hooks/generateMockupHook'

export const Services: CollectionConfig = {
  slug: 'services',
  labels: { singular: 'Service', plural: 'Services' },
  hooks: {
    afterChange: [generateServiceMockupHook],
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
    { name: 'rawMedia', label: 'Raw Hero Media (Image)', type: 'upload', relationTo: 'media', admin: { description: 'Upload a raw screenshot/photo here — a device mockup is generated automatically and shown on the service page hero instead.' } },
    { name: 'mockupMedia', label: 'Generated Mockup (auto)', type: 'upload', relationTo: 'media', admin: { readOnly: true, description: 'Filled in automatically once Bloom finishes generating the mockup.' } },
    { name: 'mockupStatus', label: 'Mockup Status (auto)', type: 'select', defaultValue: 'pending', admin: { readOnly: true }, options: [
      { label: 'Pending', value: 'pending' },
      { label: 'Processing', value: 'processing' },
      { label: 'Ready', value: 'ready' },
      { label: 'Failed', value: 'failed' },
    ] },
  ],
}
