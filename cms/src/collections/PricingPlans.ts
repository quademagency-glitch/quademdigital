import type { CollectionConfig } from 'payload'

export const PricingPlans: CollectionConfig = {
  slug: 'pricingPlans',
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
      admin: { description: 'Base price in US Dollars. Shown to visitors outside Ghana and used for live currency conversion.' },
    },
    {
      name: 'priceGHS',
      type: 'number',
      label: 'Price (GH₵)',
      admin: { description: 'Fixed price in Ghana Cedis. Shown to visitors in Ghana.' },
    },
    {
      name: 'priceLabel',
      type: 'text',
      label: 'Price Label (optional)',
      admin: { description: 'Optional text label shown instead of a number (e.g. "Custom", "Retainer"). If set, this overrides the numeric prices on the card.' },
    },
    {
      name: 'billingCycle',
      type: 'text',
      label: 'Billing Cycle',
      admin: { description: 'e.g. "/mo", "/yr", or leave empty for one-time pricing.' },
    },
    { name: 'description', type: 'textarea' },
    { name: 'isPopular', type: 'checkbox', defaultValue: false },
    { name: 'features', type: 'array', fields: [{ name: 'feature', type: 'text' }] },
    { name: 'buttonText', type: 'text', admin: { description: 'CTA button text, e.g. "Get Started", "Book a Call"' } },
    { name: 'order', type: 'number' },
    // Keep legacy 'price' field hidden so old data isn't lost during migration
    { name: 'price', type: 'text', admin: { hidden: true } },
  ],
}
