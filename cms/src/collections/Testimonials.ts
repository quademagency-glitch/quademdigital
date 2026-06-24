import type { CollectionConfig } from 'payload'

export const Testimonials: CollectionConfig = {
  slug: 'testimonials',
  labels: { singular: 'Testimonial', plural: 'Testimonials' },
  admin: {
    group: 'Website',
    useAsTitle: 'authorName',
    components: {
      edit: {
        SaveButton: './components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
  access: { read: () => true },
  fields: [
    { name: 'authorName', label: 'Author Name', type: 'text' },
    { name: 'authorRole', label: 'Author Role', type: 'text' },
    { name: 'quote', label: 'Quote', type: 'textarea' },
    { name: 'stars', label: 'Stars (Rating out of 5)', type: 'number', min: 1, max: 5 },
    { name: 'avatar', label: 'Avatar Image', type: 'upload', relationTo: 'media' },
    { name: 'videoUrl', label: 'Video URL (Optional)', type: 'text', admin: { description: 'Link to an external video (e.g. YouTube, Vimeo).' } },
    { name: 'videoFile', label: 'Video File Upload (Optional)', type: 'upload', relationTo: 'media', admin: { description: 'Upload a video file directly.' } },
    { name: 'order', label: 'Order', type: 'number' },
    {
      name: 'published',
      label: 'Published',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Only check once this is a real client testimonial, not placeholder data.' },
    },
  ],
}
