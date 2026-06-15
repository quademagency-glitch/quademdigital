import type { Block } from 'payload'

export const CallToAction: Block = {
  slug: 'callToAction',
  interfaceName: 'CallToActionBlock',
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'text', type: 'textarea' },
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
