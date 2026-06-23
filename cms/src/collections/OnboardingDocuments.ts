import type { CollectionConfig } from 'payload'
import { generateEmailDraft } from '../utils/aiEmailGenerator'

export const OnboardingDocuments: CollectionConfig = {
  slug: 'onboarding-documents',
  labels: { singular: 'Onboarding Document', plural: 'Onboarding Documents' },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'filename',
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  upload: {
    staticDir: 'media/onboarding',
    mimeTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
  fields: [
    {
      name: 'client',
      type: 'relationship',
      relationTo: 'clients',
      label: 'Related Client',
      required: true,
      admin: {
        description: 'Which client is this document for?'
      }
    },
    {
      name: 'documentType',
      type: 'select',
      label: 'Document Type',
      required: true,
      options: [
        { label: 'SLA', value: 'sla' },
        { label: 'Onboarding Guide', value: 'guide' },
        { label: 'Setup Instructions', value: 'setup' },
        { label: 'Combined / Multiple', value: 'combined' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'emailDraftGenerated',
      type: 'checkbox',
      label: 'Email Draft Generated',
      defaultValue: false,
      admin: {
        readOnly: true,
        description: 'Indicates if an AI email draft was successfully generated for this document.'
      }
    }
  ],
  hooks: {
    afterChange: [
      async ({ doc, req, operation }) => {
        if (operation === 'create' && !doc.emailDraftGenerated) {
          // Trigger AI Email Generation in the background so it doesn't block the upload response
          generateEmailDraft(doc, req.payload).catch((error) => {
            req.payload.logger.error(`Failed to generate email draft for document ${doc.id}:`, error)
          })
        }
        return doc
      }
    ]
  }
}
