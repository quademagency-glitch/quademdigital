import type { Block } from 'payload'

export const PricingCards: Block = {
  slug: 'pricingCards',
  interfaceName: 'PricingCardsBlock',
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'subheading', type: 'textarea' },
    {
      name: 'cards',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'tierName', type: 'text', required: true },
        { name: 'price', type: 'text', required: true },
        { name: 'billingPeriod', type: 'text', admin: { description: 'e.g. /month' } },
        { name: 'description', type: 'textarea' },
        {
          name: 'features',
          type: 'array',
          fields: [{ name: 'feature', type: 'text' }]
        },
        { name: 'buttonLabel', type: 'text', required: true },
        { name: 'buttonUrl', type: 'text', required: true },
        { name: 'isPopular', type: 'checkbox', label: 'Highlight as popular tier?' }
      ]
    }
  ]
}
