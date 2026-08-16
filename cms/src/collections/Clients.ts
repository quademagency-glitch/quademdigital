import type { CollectionConfig } from 'payload'
import { generateAccessCode } from '../lib/accessCode'

export const Clients: CollectionConfig = {
  slug: 'clients',
  labels: { singular: 'Client', plural: 'Clients' },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'clientName',
    defaultColumns: ['clientName', 'contactName', 'service', 'pipelineStatus', 'projectStatus'],
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
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation }: any) => {
        // CRM Automation: Only fire when pipelineStatus changes TO "won"
        const justWon =
          doc.pipelineStatus === 'won' &&
          (operation === 'create' || previousDoc?.pipelineStatus !== 'won')

        if (!justWon) return doc

        const siteUrl = process.env.ASTRO_SITE_URL
        const secret  = process.env.CMS_WEBHOOK_SECRET

        if (!siteUrl || !secret) {
          console.warn('[Quadem CMS] ASTRO_SITE_URL or CMS_WEBHOOK_SECRET not set — skipping automation')
          return doc
        }

        try {
          const payload = {
            event: 'client.won',
            client: {
              id:           doc.id,
              businessName: doc.clientName,
              contactName:  doc.contactName || '',
              email:        doc.clientEmail || '',
              phone:        doc.phone     ?? '',
              // Portal credentials travel with the welcome email. Previously the
              // code was generated and then never told to anyone, so the portal
              // could only be reached by Ernest reading it out of the admin.
              accessCode:   doc.accessCode ?? '',
              portalUrl:    'https://quademdigital.com/portal/',
              service:      doc.service   || 'multiple',
              package:      doc.package   ?? '',
              price:        doc.price     ?? 0,
              startDate:    doc.startDate ?? '',
              notes:        doc.notes     ?? '',
              customizations: {
                duration:           doc.customizations?.duration          ?? null,
                revisions:          doc.customizations?.revisions         ?? null,
                platforms:          doc.customizations?.platforms         ?? '',
                postsPerMonth:      doc.customizations?.postsPerMonth     ?? null,
                numberOfPages:      doc.customizations?.numberOfPages     ?? null,
                extraDeliverables:  doc.customizations?.extraDeliverables ?? '',
                paymentTerms:       doc.customizations?.paymentTerms      ?? '',
                specialTerms:       doc.customizations?.specialTerms      ?? '',
                depositPercent:     doc.customizations?.depositPercent    ?? null,
              },
              emailNotes: {
                welcome:  doc.emailNotes?.welcome  ?? '',
                contract: doc.emailNotes?.contract ?? '',
                setup:    doc.emailNotes?.setup    ?? '',
                checkin:  doc.emailNotes?.checkin  ?? '',
              },
            },
            timestamp: new Date().toISOString(),
          }

          const res = await fetch(`${siteUrl}/api/client-won`, {
            method: 'POST',
            headers: {
              'Content-Type':    'application/json',
              'x-quadem-secret': secret,
            },
            body: JSON.stringify(payload),
          })

          if (res.ok) {
            console.log(`[Quadem CMS] Client won automation triggered for: ${doc.clientName}`)
          } else {
            const text = await res.text()
            console.error(`[Quadem CMS] Automation endpoint responded with ${res.status}: ${text}`)
          }
        } catch (err) {
          console.error('[Quadem CMS] Failed to trigger client won automation:', err)
        }

        return doc
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Client Details & CRM',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'clientName', label: 'Business / Client Name', type: 'text', required: true },
                { name: 'contactName', label: 'Contact Person', type: 'text' },
              ]
            },
            {
              type: 'row',
              fields: [
                { name: 'clientEmail', label: 'Email Address', type: 'email' },
                { name: 'phone', label: 'WhatsApp / Phone', type: 'text' },
              ]
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'service',
                  type: 'select',
                  label: 'Service',
                  options: [
                    { label: 'Web Design',              value: 'web-design' },
                    { label: 'Digital Marketing',       value: 'digital-marketing' },
                    { label: 'Branding',                value: 'branding' },
                    { label: 'AI Video & Reels',        value: 'video-production' },
                    { label: 'SEO & Paid Ads',          value: 'seo-paid-ads' },
                    { label: 'Social Media Management', value: 'social-media' },
                    { label: 'Multiple Services',       value: 'multiple' },
                  ],
                },
                { name: 'package', type: 'text', label: 'Package / Plan Name' },
              ]
            },
            {
              type: 'row',
              fields: [
                { name: 'price', type: 'number', label: 'Monthly Price (GH₵)', min: 0 },
                { name: 'startDate', type: 'date', label: 'Project Start Date', admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
              ]
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'pipelineStatus',
                  type: 'select',
                  defaultValue: 'lead',
                  label: 'Pipeline Status',
                  options: [
                    { label: 'Lead',           value: 'lead' },
                    { label: 'Discovery',      value: 'discovery' },
                    { label: 'Proposal Sent',  value: 'proposal' },
                    { label: 'Negotiating',    value: 'negotiating' },
                    { label: 'Won',            value: 'won' },
                    { label: 'Lost',           value: 'lost' },
                    { label: 'On Hold',        value: 'on-hold' },
                    { label: 'Active Client',  value: 'active' },
                    { label: 'Completed',      value: 'completed' },
                  ],
                },
                {
                  name: 'source',
                  type: 'select',
                  label: 'How They Found You',
                  options: [
                    { label: 'Website',      value: 'website' },
                    { label: 'WhatsApp',     value: 'whatsapp' },
                    { label: 'Referral',     value: 'referral' },
                    { label: 'Social Media', value: 'social' },
                    { label: 'Walk-in',      value: 'walk-in' },
                    { label: 'Other',        value: 'other' },
                  ],
                },
              ]
            },
            {
              name: 'documentsSent',
              type: 'group',
              label: 'Documents Sent',
              admin: {
                description: 'Automatically updated when docs are sent via Make.com',
                condition: (data: any) => data?.pipelineStatus === 'won' || data?.pipelineStatus === 'active',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'contract', type: 'checkbox', label: 'Service Agreement', defaultValue: false },
                    { name: 'invoice', type: 'checkbox', label: 'Proforma Invoice', defaultValue: false },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'onboardingEmail', type: 'checkbox', label: 'Onboarding Email', defaultValue: false },
                    { name: 'setupInstructions', type: 'checkbox', label: 'Setup Instructions', defaultValue: false },
                  ],
                },
              ],
            },
            { name: 'proposalUrl', type: 'text', label: 'Proposal Link', admin: { description: 'Google Drive or shared URL for the proposal sent to this client' } },
            { name: 'notes', type: 'textarea', label: 'Internal Notes' },
          ]
        },
        {
          label: 'Client Portal',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'slug', label: 'Portal Slug', type: 'text', required: true, unique: true },
                {
                  name: 'accessCode',
                  label: 'Access Code',
                  type: 'text',
                  required: true,
                  unique: true,
                  admin: {
                    readOnly: true,
                    description:
                      'Generated automatically and sent to the client in their welcome email. Leave it alone — clear the field and save if you ever need to issue a new one.',
                  },
                  hooks: {
                    // beforeValidate, not beforeChange: the field is required,
                    // so it has to be filled before validation runs or saving
                    // without one fails.
                    //
                    // Codes used to be six characters from Math.random() — a
                    // million possibilities from a generator that is not
                    // cryptographic, guarding client files, timelines and
                    // invoices behind a login with no meaningful throttle.
                    // These are 56^14 from crypto.randomBytes.
                    beforeValidate: [({ value }) => value || generateAccessCode()],
                  },
                },
              ]
            },
            {
              type: 'row',
              fields: [
                { name: 'projectName', label: 'Project Name', type: 'text' },
                {
                  name: 'projectStatus',
                  label: 'Portal Project Status',
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
        },
        {
          label: 'Customizations',
          fields: [
            {
              name: 'customizations',
              type: 'group',
              label: 'Project Customizations',
              admin: {
                description: 'Override document defaults for this client. Blank fields use standard values.',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'duration', type: 'number', label: 'Contract Duration (months)', min: 1, admin: { placeholder: 'Default: 3', width: '50%' } },
                    { name: 'revisions', type: 'number', label: 'Revision Rounds Included', min: 0, admin: { placeholder: 'Default: 2', width: '50%' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'depositPercent', type: 'number', label: 'Deposit Required (%)', min: 0, max: 100, admin: { placeholder: 'e.g. 50 for 50% upfront', width: '50%' } },
                    { name: 'numberOfPages', type: 'number', label: 'Number of Pages (web design)', min: 1, admin: { placeholder: 'e.g. 5', width: '50%' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'postsPerMonth', type: 'number', label: 'Posts Per Month (social media)', min: 1, admin: { placeholder: 'e.g. 12', width: '50%' } },
                    { name: 'platforms', type: 'text', label: 'Platforms / Channels', admin: { placeholder: 'e.g. Facebook, Instagram, LinkedIn', width: '50%' } },
                  ],
                },
                {
                  name: 'paymentTerms',
                  type: 'text',
                  label: 'Payment Terms',
                  admin: { placeholder: 'e.g. 50% upfront, 50% on delivery — overrides standard monthly retainer wording' },
                },
                {
                  name: 'extraDeliverables',
                  type: 'textarea',
                  label: 'Additional / Custom Deliverables',
                  admin: { placeholder: 'One per line — appended to the standard deliverables list in the contract', rows: 4 },
                },
                {
                  name: 'specialTerms',
                  type: 'textarea',
                  label: 'Special Terms or Notes',
                  admin: { placeholder: 'Any clause, condition, or agreement specific to this client that should appear in the contract', rows: 3 },
                },
              ],
            },
            {
              name: 'emailNotes',
              type: 'group',
              label: 'Email Customizations',
              admin: {
                description: 'Optional personal notes injected into each automated email. Blank = standard template.',
              },
              fields: [
                { name: 'welcome', type: 'textarea', label: 'Welcome Pack email — personal note', admin: { rows: 3, description: 'Appears as a highlighted block in the first email.' } },
                { name: 'contract', type: 'textarea', label: 'Service Agreement email — personal note', admin: { rows: 3, description: 'Appears in the contract email, above the action-required block.' } },
                { name: 'setup', type: 'textarea', label: 'Setup Instructions email — personal note', admin: { rows: 3, description: 'Appears in the setup email, to clarify anything agreed verbally.' } },
                { name: 'checkin', type: 'textarea', label: 'Week-one check-in email — personal note', admin: { rows: 3, description: 'Appears in the 7-day follow-up email.' } },
              ],
            }
          ]
        }
      ]
    }
  ]
}
