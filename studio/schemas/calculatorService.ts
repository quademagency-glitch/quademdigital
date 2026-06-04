import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'calculatorService',
  title: 'Calculator Service',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Service Name',
      type: 'string',
      validation: Rule => Rule.required(),
      description: 'e.g., Web Design & Development'
    }),
    defineField({
      name: 'priceUSD',
      title: 'Base Price (USD)',
      type: 'number',
      validation: Rule => Rule.required(),
      description: 'The base price used for global conversion (e.g., 5000)'
    }),
    defineField({
      name: 'priceGHS',
      title: 'Fixed Price (Ghana Cedis)',
      type: 'number',
      validation: Rule => Rule.required(),
      description: 'The fixed price for visitors in Ghana (e.g., 60000)'
    }),
    defineField({
      name: 'billingCycle',
      title: 'Billing Cycle',
      type: 'string',
      description: 'Optional: e.g., " / mo", " one-time". Leave blank if none.'
    }),
    defineField({
      name: 'order',
      title: 'Order',
      type: 'number',
      description: 'The order in which it appears in the calculator (e.g. 1, 2, 3)'
    })
  ],
  orderings: [
    {
      title: 'Manual Order',
      name: 'manualOrder',
      by: [{field: 'order', direction: 'asc'}]
    }
  ]
})
