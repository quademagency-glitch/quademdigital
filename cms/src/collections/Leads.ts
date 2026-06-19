import type { CollectionConfig } from 'payload'

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
  },
  access: {
    read: () => true, // Depending on requirements, we can lock this down later
    create: () => true, // Allow frontend to submit leads
  },
  fields: [
    {
      name: 'source',
      label: 'Source',
      type: 'select',
      options: [
        { label: 'Contact Form', value: 'contact-form' },
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
