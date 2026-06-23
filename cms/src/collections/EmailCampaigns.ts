import type { CollectionConfig } from 'payload'
import {
  lexicalHTMLField,
  lexicalEditor,
  UploadFeature
} from '@payloadcms/richtext-lexical'

export const EmailCampaigns: CollectionConfig = {
  slug: 'emailCampaigns',
  labels: { singular: 'Email Campaign', plural: 'Email Campaigns' },
  admin: {
    group: 'Marketing',
    useAsTitle: 'subject',
    components: {
      edit: {
        SaveButton: './components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
  access: { read: () => true },
  fields: [
    { name: 'client', type: 'relationship', relationTo: 'clients', label: 'Target Client' },
    { name: 'subject', label: 'Subject', type: 'text', required: true },
    { name: 'previewText', label: 'Preview Text', type: 'text' },
    {
      name: 'body',
      label: 'Body',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures,
          UploadFeature(),
        ],
      }),
    },
    lexicalHTMLField({ lexicalFieldName: 'body', htmlFieldName: 'body_html' }),
    { name: 'ctaText', label: 'CTA Text', type: 'text' },
    { name: 'ctaUrl', label: 'CTA URL', type: 'text' },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Sent', value: 'sent' },
      ]
    },
  ],
}
