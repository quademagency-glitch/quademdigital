import type { CollectionConfig } from 'payload'

export const CalculatorServices: CollectionConfig = {
  slug: 'calculatorServices',
  admin: {
    group: 'Marketing',
    useAsTitle: 'name',
    components: {
      edit: {
        SaveButton: './components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'basePrice', type: 'number', required: true },
    /*
      Both currencies are required on purpose.

      They used to be optional, each falling back to Base Price when blank. All
      three services had only a Base Price, so the same number was served as
      both currencies — an overseas visitor was quoted $1,500 for the service a
      local was quoted GH₵1,500 for, roughly a 12x overquote. Nothing errored;
      the page just showed a confident wrong number.

      There is deliberately no automatic conversion (see F-13/F-14): these are
      two prices you set, so a moving exchange rate can never reprice your work.
      The cost of that choice is that both must actually be filled in.
    */
    {
      name: 'priceUSD',
      type: 'number',
      label: 'Price (USD)',
      required: true,
      admin: { description: 'Price shown to visitors outside Ghana, in US Dollars. Not converted — set it deliberately.' },
    },
    {
      name: 'priceGHS',
      type: 'number',
      label: 'Price (GH₵)',
      required: true,
      admin: { description: 'Price shown to visitors in Ghana, in Cedis. Not converted — set it deliberately.' },
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
