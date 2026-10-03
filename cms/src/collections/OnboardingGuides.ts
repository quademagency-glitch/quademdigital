import type { CollectionConfig } from 'payload'
import { adminOrSite } from '../access/roles'

export const OnboardingGuides: CollectionConfig = {
  slug: 'onboarding-guides',
  labels: { singular: 'Onboarding Guide', plural: 'Onboarding Guides' },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'title',
    components: {
      edit: {
        SaveButton: './components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
  access: { 
    read: adminOrSite,
    create: adminOrSite,
    update: adminOrSite,
    delete: adminOrSite,
  },
  fields: [
    { name: 'title', label: 'Guide Title', type: 'text', required: true },
    { name: 'description', label: 'Brief Description', type: 'textarea' },
    { name: 'content', label: 'Content', type: 'richText' }
  ]
}
