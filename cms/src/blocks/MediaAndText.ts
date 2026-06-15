import type { Block } from 'payload'
import { lexicalEditor, lexicalHTMLField, UploadFeature } from '@payloadcms/richtext-lexical'

export const MediaAndText: Block = {
  slug: 'mediaAndText',
  interfaceName: 'MediaAndTextBlock',
  fields: [
    { name: 'mediaAlignment', type: 'select', options: ['left', 'right'], defaultValue: 'left' },
    { name: 'media', type: 'upload', relationTo: 'media', required: true },
    { name: 'heading', type: 'text' },
    {
      name: 'content',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures,
          UploadFeature(),
        ],
      }),
    },
    lexicalHTMLField({ lexicalFieldName: 'content', htmlFieldName: 'content_html' }),
    {
      name: 'buttons',
      type: 'array',
      maxRows: 2,
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
        { name: 'style', type: 'select', options: ['primary', 'secondary', 'outline'], defaultValue: 'primary' }
      ]
    }
  ]
}
