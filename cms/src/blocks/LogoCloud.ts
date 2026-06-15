import type { Block } from 'payload'

export const LogoCloud: Block = {
  slug: 'logoCloud',
  interfaceName: 'LogoCloudBlock',
  fields: [
    { name: 'heading', type: 'text', admin: { description: 'e.g. Trusted by innovative companies' } },
    {
      name: 'logos',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'logo', type: 'upload', relationTo: 'media', required: true },
        { name: 'companyName', type: 'text' }
      ]
    }
  ]
}
