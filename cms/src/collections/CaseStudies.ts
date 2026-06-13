import type { CollectionConfig } from 'payload'

export const CaseStudies: CollectionConfig = {
  slug: 'caseStudies',
  labels: { singular: 'Case Study', plural: 'Case Studies' },
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
    { name: 'tag', label: 'Tag (e.g. E-commerce)', type: 'text' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'resultMetric', label: 'Result Metric (e.g. 300%)', type: 'text' },
    { name: 'resultText', label: 'Result Text (e.g. Increase in traffic)', type: 'text' },
    { name: 'coverImage', label: 'Cover Image', type: 'upload', relationTo: 'media' },
    { name: 'body', label: 'Body Content', type: 'json' },
    {
      name: 'imageGallery',
      label: 'Image Gallery',
      type: 'array',
      fields: [{ name: 'image', type: 'upload', relationTo: 'media' }],
    },
    {
      name: 'videoGallery',
      label: 'Video Gallery',
      type: 'array',
      fields: [
        { name: 'title', label: 'Video Title', type: 'text' },
        { name: 'videoUrl', label: 'External Video URL', type: 'text' },
        { name: 'videoFile', label: 'Direct Video Upload (MP4)', type: 'upload', relationTo: 'media' },
      ],
    },
    { name: 'order', label: 'Order', type: 'number' },
  ],
}
