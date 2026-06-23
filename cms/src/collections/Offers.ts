import type { CollectionConfig } from 'payload'
import { makeSlugHook } from '../hooks/slugify'

export const Offers: CollectionConfig = {
  slug: 'offers',
  labels: { singular: 'Offer', plural: 'Offers' },
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    components: {
      edit: {
        SaveButton: '../components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
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
        beforeValidate: [makeSlugHook('title')],
      },
    },
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    { name: 'image', label: 'Cover Image', type: 'upload', relationTo: 'media' },
    { name: 'cta', label: 'Call to Action Button Text', type: 'text', defaultValue: 'Claim Offer' },
    { name: 'publishedAt', label: 'Published at', type: 'date', defaultValue: () => new Date().toISOString() },
  ],
}
