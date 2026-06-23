import type { CollectionConfig } from 'payload'

export const Clients: CollectionConfig = {
  slug: 'clients',
  labels: { singular: 'Client', plural: 'Clients' },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'clientName',
    components: {
      edit: {
        SaveButton: './components/RedirectAfterSave#SaveAndRedirectButton',
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
    { name: 'clientName', label: 'Client Name', type: 'text', required: true },
    { name: 'clientEmail', label: 'Client Email', type: 'email' },
    { name: 'slug', label: 'Slug', type: 'text', required: true, unique: true },
    { name: 'accessCode', label: 'Access Code', type: 'text', required: true, unique: true, admin: { description: 'The 6-digit code or phrase to log into the portal' } },
    { name: 'projectName', label: 'Project Name', type: 'text' },
    {
      name: 'projectStatus',
      label: 'Project Status',
      type: 'select',
      defaultValue: 'onboarding',
      options: [
        { label: 'Onboarding', value: 'onboarding' },
        { label: 'Design', value: 'design' },
        { label: 'Development', value: 'development' },
        { label: 'Review', value: 'review' },
        { label: 'Completed', value: 'completed' },
        { label: 'Retainer', value: 'retainer' }
      ]
    },
    { name: 'welcomeMessage', label: 'Welcome Message', type: 'textarea' },
    { name: 'onboardingGuide', label: 'Onboarding Guide', type: 'relationship', relationTo: 'onboarding-guides' },
    {
      name: 'timeline',
      label: 'Project Timeline',
      type: 'array',
      fields: [
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'description', label: 'Description', type: 'textarea' }
      ]
    },
    {
      name: 'deliverables',
      label: 'Deliverables & Assets',
      type: 'array',
      fields: [
        {
          name: 'category',
          label: 'Category',
          type: 'select',
          defaultValue: 'other',
          options: [
            { label: 'Design Files', value: 'design' },
            { label: 'Brand Assets', value: 'brand' },
            { label: 'Documents', value: 'documents' },
            { label: 'Videos', value: 'videos' },
            { label: 'Other', value: 'other' }
          ]
        },
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'url', label: 'URL', type: 'text', required: true }
      ]
    }
  ]
}
