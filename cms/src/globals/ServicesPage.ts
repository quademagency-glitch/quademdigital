import type { GlobalConfig } from 'payload'

export const ServicesPage: GlobalConfig = {
  slug: 'servicesPage',
  admin: { group: 'Pages' },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'description', type: 'textarea' },
    { name: 'heading', type: 'text' },
    { name: 'subheading', type: 'text' },
  ],
}
