import type { Block } from 'payload'

export const HeroSection: Block = {
  slug: 'heroSection',
  interfaceName: 'HeroSectionBlock',
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'subheading', type: 'textarea' },
    { name: 'backgroundImage', type: 'upload', relationTo: 'media' },
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
