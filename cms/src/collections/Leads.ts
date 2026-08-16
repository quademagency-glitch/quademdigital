import type { CollectionConfig } from 'payload'
import { convertWonLeadToClient } from '../hooks/convertWonLeadToClient'

export const Leads: CollectionConfig = {
  slug: 'leads',
  labels: {
    singular: 'Lead',
    plural: 'Leads',
  },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'status', 'submittedAt'],
    components: {
      edit: {
        SaveButton: './components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: () => true, // Allow frontend to submit leads
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    afterChange: [convertWonLeadToClient],
  },
  fields: [
    {
      name: 'source',
      label: 'Source',
      type: 'select',
      /*
        These values must stay in step with the hidden `source` input on every
        form. When the homepage, the CMS-driven service pages and Brand Studio
        were repointed from Formspree to /api/submit-form they began sending
        'homepage', 'cms-page' and 'brand-studio' — none of which were listed
        here, so Payload rejected the whole document with "This field has an
        invalid selection" and those leads never saved. The notification email
        still went out, which is what disguised it.
      */
      options: [
        { label: 'Contact Form', value: 'contact-form' },
        { label: 'Homepage Form', value: 'homepage' },
        { label: 'Service Page', value: 'cms-page' },
        // Brand Studio was retired and folded into the AI Video & Reels service
        // page, but historical leads still carry this value and it is part of
        // `enum_leads_source`. Removing the option would make those rows
        // unrenderable in the admin, so it stays, relabelled.
        { label: 'Brand Studio (retired)', value: 'brand-studio' },
        { label: 'Lead Magnet', value: 'lead-magnet' },
        { label: 'Newsletter Signup', value: 'newsletter' },
        { label: 'Quote Calculator', value: 'calculator' },
        { label: 'WhatsApp', value: 'whatsapp' },
        { label: 'Other', value: 'other' },
      ],
      admin: { description: 'Which entry point captured this lead.' },
    },
    {
      name: 'magnetRequested',
      label: 'Lead Magnet Requested',
      type: 'text',
      admin: { description: 'Name of the lead magnet they opted in for (e.g. "10-Point Website Audit Checklist").' },
    },
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
    },
    {
      name: 'message',
      label: 'Message',
      type: 'textarea',
    },
    {
      name: 'budget',
      label: 'Budget',
      type: 'select',
      options: [
        { label: 'Under $2,000', value: '< $2,000' },
        { label: '$2,000 - $5,000', value: '$2k - $5k' },
        { label: '$5,000 - $10,000', value: '$5k - $10k' },
        { label: '$10,000+', value: '$10k+' },
      ],
      admin: { description: 'Budget range selected on the contact form.' },
    },
    {
      name: 'servicesInterested',
      label: 'Services Interested In',
      type: 'json',
      admin: {
        description: 'Services selected on the contact form (array of strings).',
      },
    },
    {
      name: 'metadata',
      label: 'Additional Data',
      type: 'json',
      admin: {
        description: 'Extra data like selected services or budget',
      },
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Qualified', value: 'qualified' },
        { label: 'Won', value: 'won' },
        { label: 'Lost', value: 'lost' },
        { label: 'Archived', value: 'archived' },
      ],
      defaultValue: 'new',
    },
    {
      name: 'convertedClient',
      label: 'Converted Client',
      type: 'relationship',
      relationTo: 'clients',
      admin: {
        readOnly: true,
        description: 'Auto-set when this lead is marked Won — links to the Client record created from it.',
      },
    },
    {
      name: 'submittedAt',
      label: 'Submitted At',
      type: 'date',
      admin: {
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          ({ operation, value }) => {
            if (operation === 'create') {
              return new Date().toISOString()
            }
            return value
          },
        ],
      },
    },
  ],
}
