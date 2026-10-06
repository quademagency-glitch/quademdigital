import type { CollectionConfig } from 'payload'
import { adminOrSite } from '../access/roles'
import { SERVICE_OPTIONS } from './JourneyTemplates'

/*
  A guide the founder writes once and a client keeps: what to send, how
  reviews work, what happens when. It shows on the client's page on the
  website (src/pages/portal/index.astro).

  A guide written for a service attaches itself to a client of that service
  the moment they are Won, if they have none yet (lib/onboardingKit.ts). Only
  guides marked ready are attached, so a draft is never shown to a client
  unless the founder chooses it for them by hand.
*/

export const OnboardingGuides: CollectionConfig = {
  slug: 'onboarding-guides',
  labels: { singular: 'Onboarding Guide', plural: 'Onboarding Guides' },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'title',
    defaultColumns: ['title', 'service', 'ready', 'isDefault', 'updatedAt'],
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
    {
      name: 'service',
      label: 'For which service',
      type: 'select',
      options: SERVICE_OPTIONS,
      admin: { description: 'A new client of this service gets this guide when they are Won.' },
    },
    {
      name: 'isDefault',
      label: 'Use this when no guide matches the service',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'ready',
      label: 'Ready to use',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Untick while it is still a draft. A guide that is not ready is never attached by itself.' },
    },
    { name: 'content', label: 'Content', type: 'richText' },
  ],
}
