import type { CollectionConfig } from 'payload'

/*
  quality 72 is the point where these illustrations stop losing anything a
  visitor can see. effort 6 spends more time searching for a smaller encoding
  and changes nothing about how the picture looks; it costs upload time once
  and saves bytes on every visit afterwards.
*/
const DERIVATIVE_FORMAT = { format: 'webp' as const, options: { quality: 72, effort: 6 } }

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
    formatOptions: DERIVATIVE_FORMAT,
    imageSizes: [
      // formatOptions has to be repeated per size. Set only at the top level it
      // applies to the uploaded file alone, and every resize falls back to
      // sharp's own default of quality 80 with effort 4. That is what made the
      // 800px copy of a blog cover 108KB when the 1024px original it was made
      // from was 137KB: 39% fewer pixels for 79% of the bytes. Same settings
      // everywhere means a derivative is never heavier per pixel than its
      // original.
      { name: 'thumb', width: 200, height: undefined, formatOptions: DERIVATIVE_FORMAT },
      { name: 'thumbnail', width: 400, height: undefined, formatOptions: DERIVATIVE_FORMAT },
      { name: 'card', width: 480, height: undefined, formatOptions: DERIVATIVE_FORMAT },
      { name: 'medium', width: 800, height: undefined, formatOptions: DERIVATIVE_FORMAT },
      { name: 'large', width: 1200, height: undefined, formatOptions: DERIVATIVE_FORMAT },
      { name: 'og', width: 1200, height: 630, formatOptions: DERIVATIVE_FORMAT }
    ],
  },
}
