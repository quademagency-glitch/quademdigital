import type { CollectionConfig } from 'payload'

export const CalculatorServices: CollectionConfig = {
  slug: 'calculatorServices',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'basePrice', type: 'number', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'order', type: 'number' },
  ],
}
