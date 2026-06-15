import type { Block } from 'payload'
import { lexicalEditor, lexicalHTMLField, UploadFeature } from '@payloadcms/richtext-lexical'

export const TextBlock: Block = {
  slug: 'textBlock',
  interfaceName: 'TextBlockBlock',
  fields: [
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
  ]
}
