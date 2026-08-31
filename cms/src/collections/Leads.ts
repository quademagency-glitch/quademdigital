import type { CollectionConfig } from 'payload'
import { convertWonLeadToClient } from '../hooks/convertWonLeadToClient'
import { activityField, nextFollowUpField } from '../fields/activityLog'

export const Leads: CollectionConfig = {
  slug: 'leads',
  labels: {
    singular: 'Lead',
    plural: 'Leads',
  },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'status', 'nextFollowUp', 'submittedAt'],
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
  // History, not drafts. See the note in Invoices.ts for why. Here it mostly
  // buys a record of how a lead moved through the statuses, and what the
  // enquiry said before anyone edited it.
  versions: { maxPerDoc: 50 },
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
        'homepage', 'cms-page' and 'brand-studio', none of which were listed
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
      /*
        Two ladders, because the site sells at two price levels and the old
        single ladder could not describe either.

        The dollar bands used to start at "under $2,000", which is below the
        cheapest thing on offer internationally ($3,000 for a website), so the
        first option a buyer read implied a price that was never available.

        Worse, the Ghana ladder runs GH₵ 2,500 to GH₵ 11,500, roughly $425 to
        $1,955. Every Ghanaian lead therefore landed in that same bottom band
        and the question collected nothing at all about the site's primary
        market.

        The four original values are kept. ALTER TYPE cannot drop an enum value
        and hundreds of leads already carry them; removing the options here
        would make those rows unrenderable in the admin.
      */
      options: [
        { label: 'GH₵ under 2,500', value: 'GHS < 2,500' },
        { label: 'GH₵ 2,500 - 6,000', value: 'GHS 2,500 - 6,000' },
        { label: 'GH₵ 6,000 - 12,000', value: 'GHS 6,000 - 12,000' },
        { label: 'GH₵ 12,000+', value: 'GHS 12,000+' },
        { label: 'Under $1,500', value: '< $1,500' },
        { label: '$1,500 - $3,000', value: '$1.5k - $3k' },
        { label: '$3,000 - $6,000', value: '$3k - $6k' },
        { label: '$6,000+', value: '$6k+' },
        { label: 'Under $2,000 (retired band)', value: '< $2,000' },
        { label: '$2,000 - $5,000 (retired band)', value: '$2k - $5k' },
        { label: '$5,000 - $10,000 (retired band)', value: '$5k - $10k' },
        { label: '$10,000+ (retired band)', value: '$10k+' },
      ],
      admin: { description: 'Budget range selected on a form. Cedi bands are shown to visitors in Ghana, dollar bands to everyone else.' },
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
        description: 'Auto-set when this lead is marked Won. Links to the Client record created from it.',
      },
    },
    nextFollowUpField('lead'),
    activityField(),
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
