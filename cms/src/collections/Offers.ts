import type { CollectionConfig } from 'payload'

export const Offers: CollectionConfig = {
  slug: 'offers',
  labels: { singular: 'Offer', plural: 'Offers' },
  admin: { useAsTitle: 'title' },
  access: { read: () => true },
  fields: [
    { name: 'title', label: 'Offer Title', type: 'text', required: true },
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
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    { name: 'image', label: 'Cover Image', type: 'upload', relationTo: 'media' },
    { name: 'cta', label: 'Call to Action Button Text', type: 'text', defaultValue: 'Claim Offer' },
    { name: 'publishedAt', label: 'Published at', type: 'date', defaultValue: () => new Date().toISOString() },
  ],
}
