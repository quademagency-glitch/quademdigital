import type { GlobalConfig } from 'payload'
import { contentEditors } from '../access/roles'

export const ServicesPage: GlobalConfig = {
  slug: 'servicesPage',
  admin: { group: 'Pages' },
  access: {
    read: () => true,
    update: contentEditors,
  },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'description', type: 'textarea' },
    { name: 'heading', type: 'text' },
    { name: 'subheading', type: 'text' },
  ],
}
