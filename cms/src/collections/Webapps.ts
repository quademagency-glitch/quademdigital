import type { CollectionConfig } from 'payload'

export const Webapps: CollectionConfig = {
  slug: 'webapps',
  admin: {
    group: 'Website',
    useAsTitle: 'name',
    components: {
      edit: {
        SaveButton: './components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'tagline', type: 'text' },
    { name: 'description', type: 'textarea' },
    { name: 'status', type: 'text' },
    { name: 'link', type: 'text' },
    { name: 'order', type: 'number' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'coverImage', type: 'upload', relationTo: 'media' },
  ],
}
