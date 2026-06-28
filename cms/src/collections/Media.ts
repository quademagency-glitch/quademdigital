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
    // Prevent oversized uploads — cap the stored original at 1600px wide
    resizeOptions: {
      width: 1600,
      height: undefined,
      fit: 'inside',
      withoutEnlargement: true,
    },
    // Auto-generate optimized variants at common breakpoints
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: undefined,
        fit: 'inside',
        formatOptions: {
          format: 'webp',
          options: { quality: 80 },
        },
      },
      {
        name: 'medium',
        width: 800,
        height: undefined,
        fit: 'inside',
        formatOptions: {
          format: 'webp',
          options: { quality: 80 },
        },
      },
      {
        name: 'large',
        width: 1200,
        height: undefined,
        fit: 'inside',
        formatOptions: {
          format: 'webp',
          options: { quality: 82 },
        },
      },
      {
        name: 'og',
        width: 1200,
        height: 630,
        fit: 'cover',
        formatOptions: {
          format: 'webp',
          options: { quality: 80 },
        },
      },
    ],
    // Output WebP for the original upload as well
    formatOptions: {
      format: 'webp',
      options: { quality: 85 },
    },
    mimeTypes: ['image/*'],
  },
}
