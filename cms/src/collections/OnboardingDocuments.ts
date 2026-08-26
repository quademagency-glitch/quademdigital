import type { CollectionConfig } from 'payload'
import { generateEmailDraft } from '../utils/aiEmailGenerator'

export const OnboardingDocuments: CollectionConfig = {
  slug: 'onboarding-documents',
  labels: { singular: 'Onboarding Document', plural: 'Onboarding Documents' },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'client', 'documentType', 'sentToClientAt'],
    description:
      'Every document a client has been sent, including the ones the client-won automation writes. Stored in the private bucket, so a link to one is useless to anybody not logged in.',
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
        { label: 'Service Agreement', value: 'sla' },
        { label: 'Onboarding Guide', value: 'guide' },
        { label: 'Setup Instructions', value: 'setup' },
        { label: 'Combined / Multiple', value: 'combined' },
        { label: 'Other', value: 'other' },
      ],
    },
    /*
      Where this came from, and it decides whether an email gets drafted.

      A document Ernest uploads by hand needs a covering email, which is what
      the AI draft below is for. The three the client-won automation writes
      already have one: the automation composes and schedules its own. Without
      this the automation would have fired three pointless Gemini calls per
      client and produced three drafts nobody asked for.
    */
    {
      name: 'origin',
      type: 'select',
      label: 'Where it came from',
      defaultValue: 'by-hand',
      options: [
        { label: 'Uploaded by hand', value: 'by-hand' },
        { label: 'Written by the client-won automation', value: 'automation' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'sentToClientAt',
      type: 'date',
      label: 'Emailed to the client',
      admin: {
        readOnly: true,
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description:
          'When it was, or is due to be, sent. The automation staggers its emails over the first week, so a date here can be in the future.',
      },
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
        // Nothing to draft for a document the automation already wrote an
        // email for. See the note on `origin`.
        if (operation === 'create' && doc.origin !== 'automation' && !doc.emailDraftGenerated) {
          // Trigger AI Email Generation in the background so it doesn't block the upload response
          // The upload's own bytes travel with the call. See the note in
          // generateEmailDraft: re-fetching them over HTTP asks a route that
          // requires a login, from a place that has none.
          generateEmailDraft(doc, req.payload, req.file?.data).catch((error) => {
            req.payload.logger.error(`Failed to generate email draft for document ${doc.id}:`, error)
          })
        }
        return doc
      }
    ]
  }
}
