import type { CollectionConfig } from 'payload'

export const OnboardingGuides: CollectionConfig = {
  slug: 'onboarding-guides',
  labels: { singular: 'Onboarding Guide', plural: 'Onboarding Guides' },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'title',
    components: {
      edit: {
        SaveButton: '../components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
  access: { 
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    { name: 'title', label: 'Guide Title', type: 'text', required: true },
    { name: 'description', label: 'Brief Description', type: 'textarea' },
    { name: 'content', label: 'Content', type: 'richText' }
  ]
}
