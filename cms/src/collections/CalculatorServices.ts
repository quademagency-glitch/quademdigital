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
    {
      name: 'priceUSD',
      type: 'number',
      label: 'Price (USD)',
      required: true,
      admin: { description: 'Base price in US Dollars. Shown to visitors outside Ghana and used for live currency conversion.' },
    },
    {
      name: 'priceGHS',
      type: 'number',
      label: 'Price (GH₵)',
      required: true,
      admin: { description: 'Fixed price in Ghana Cedis. Shown to visitors in Ghana.' },
    },
    {
      name: 'billingCycle',
      type: 'text',
      label: 'Billing Cycle',
      admin: { description: 'e.g. "/mo", "/yr", or leave empty for one-time pricing.' },
    },
    { name: 'description', type: 'textarea' },
    { name: 'order', type: 'number' },
    // Keep legacy 'basePrice' field hidden so old data isn't lost during migration
    { name: 'basePrice', type: 'number', admin: { hidden: true } },
  ],
}
