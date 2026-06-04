export default {
  name: 'pricingPlan',
  title: 'Pricing Plan',
  type: 'document',
  fields: [
    {
      name: 'name',
      title: 'Plan Name',
      type: 'string',
    },
    {
      name: 'priceUSD',
      title: 'Base Price (USD)',
      type: 'number',
      description: 'The base price in US Dollars. This will be automatically converted to the visitor\'s local currency.',
    },
    {
      name: 'priceGHS',
      title: 'Fixed Price (Ghana Cedis)',
      type: 'number',
      description: 'The exact price to show visitors from Ghana (GH₵).',
    },
    {
      name: 'billingCycle',
      title: 'Billing Cycle',
      type: 'string',
      description: 'e.g., "/mo", "one-time", "/year"',
    },
    {
      name: 'description',
      title: 'Description',
      type: 'text',
    },
    {
      name: 'features',
      title: 'Features',
      type: 'array',
      of: [{type: 'string'}]
    },
    {
      name: 'isPopular',
      title: 'Is Most Popular?',
      type: 'boolean',
      initialValue: false
    },
    {
      name: 'buttonText',
      title: 'Button Text',
      type: 'string',
    },
    {
      name: 'order',
      title: 'Order',
      type: 'number',
    }
  ],
  orderings: [
    {
      title: 'Manual Order',
      name: 'manualOrder',
      by: [{field: 'order', direction: 'asc'}]
    }
  ]
}
