import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: 'System' },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'kind',
      label: 'Kind',
      type: 'select',
      options: [
        { label: 'Raw Upload', value: 'raw' },
        { label: 'Generated Mockup', value: 'mockup' },
      ],
      defaultValue: 'raw',
      admin: { description: 'Set automatically by the mockup pipeline for AI-generated device mockups.' },
    },
    {
      name: 'sourceImage',
      label: 'Source Image (for generated mockups)',
      type: 'relationship',
      relationTo: 'media',
      admin: { description: 'The raw image this mockup was generated from, when kind = Generated Mockup.' },
    },
  ],
  upload: {
    formatOptions: { format: 'webp', options: { quality: 72 } },
    imageSizes: [
      { name: 'thumb', width: 200, height: undefined },
      { name: 'thumbnail', width: 400, height: undefined },
      { name: 'card', width: 480, height: undefined },
      { name: 'medium', width: 800, height: undefined },
      { name: 'large', width: 1200, height: undefined },
      { name: 'og', width: 1200, height: 630 }
    ],
  },
}
