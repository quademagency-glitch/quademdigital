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
      both currencies, an overseas visitor was quoted $1,500 for the service a
      local was quoted GH₵1,500 for, roughly a 12x overquote. Nothing errored;
      the page just showed a confident wrong number.

      Neither is ever worked out from the other (see F-13/F-14): these are two
      prices you set, so a moving exchange rate can never reprice your work.
      The cost of that choice is that both must actually be filled in.

      What IS converted, since the market rule of 4 September 2026, is the
      display: the dollar price is shown to everyone outside Africa in their own
      money, and the cedi price to everyone in Africa in theirs. The labels
      below said "visitors in Ghana" and "Not converted" until 10 September,
      which had stopped being true of both.
    */
    {
      name: 'priceUSD',
      type: 'number',
      label: 'Price (USD)',
      required: true,
      admin: { description: 'The price for visitors outside Africa, in US dollars. Set it by hand; it is never worked out from the cedi price. The page converts it into the visitor\'s own currency.' },
    },
    {
      name: 'priceGHS',
      type: 'number',
      label: 'Price (GH₵)',
      required: true,
      admin: { description: 'The price for visitors in Africa, in cedis. Set it by hand; it is never worked out from the dollar price. Ghana sees it as written; the rest of Africa sees it converted into their own currency.' },
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
