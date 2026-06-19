import type { CollectionConfig } from 'payload'

export const CalculatorServices: CollectionConfig = {
  slug: 'calculatorServices',
  admin: {
    group: 'Marketing',
    useAsTitle: 'name',
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'basePrice', type: 'number', required: true },
    {
      name: 'priceUSD',
      type: 'number',
      label: 'Price (USD)',
      admin: { description: 'Base price in US Dollars. If empty, falls back to Base Price.' },
    },
    {
      name: 'priceGHS',
      type: 'number',
      label: 'Price (GH₵)',
      admin: { description: 'Fixed price in Ghana Cedis. If empty, falls back to Base Price.' },
    },
    {
      name: 'billingCycle',
      type: 'text',
      label: 'Billing Cycle',
      admin: { description: 'e.g. "/mo", "/yr", or leave empty for one-time pricing.' },
    },
    { name: 'description', type: 'textarea' },
    { name: 'order', type: 'number' },
  ],
}
