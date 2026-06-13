import type { CollectionConfig } from 'payload'

export const PricingPlans: CollectionConfig = {
  slug: 'pricingPlans',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'price', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'isPopular', type: 'checkbox', defaultValue: false },
    { name: 'features', type: 'array', fields: [{ name: 'feature', type: 'text' }] },
    { name: 'order', type: 'number' },
  ],
}
