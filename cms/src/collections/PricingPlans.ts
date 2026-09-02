import type { CollectionConfig } from 'payload'

export const PricingPlans: CollectionConfig = {
  slug: 'pricingPlans',
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
    /*
      Which audience a plan is for.

      Ghana and the rest of the world are not the same offer at different
      exchange rates, they are different tiers. Ghana buys packages (Starter,
      Growth, Premium); the UK, US, Europe and the Gulf buy service lines
      (website build, video retainer, growth retainer). Before this field the
      site had one list and showed a converted cedi price abroad, so a website
      was $425 on the homepage and "from $1,200" on the international page, and
      anyone who saw both pages saw the cheaper number.

      The site renders both sets and reveals one after the geo lookup, because
      public pages are edge-cached for 60 seconds and a server-rendered choice
      would be handed to the wrong country.
    */
    {
      name: 'market',
      type: 'select',
      label: 'Shown to',
      required: true,
      defaultValue: 'ghana',
      options: [
        { label: 'Ghana (cedi prices)', value: 'ghana' },
        { label: 'International (USD prices)', value: 'international' },
      ],
      admin: {
        description:
          'Ghana plans appear to visitors in Ghana. International plans appear to everyone else, on the homepage and on /global.',
      },
    },
    { name: 'price', type: 'text', required: true },
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
    /*
      Where this card leads.

      src/components/home/PricingSection.astro has read `plan.pageUrl` since it
      was written, both for the card's own button and for a "View Details" link
      under it. The field never existed, so the expression was always undefined:
      every card fell back to /contact/ and the View Details link never rendered
      once. Found 2 September 2026.

      The effect was that the homepage pricing was a closed loop. A visitor who
      read the cards and wanted to know what "Website build" actually covers was
      sent to a contact form instead of to /services/web-design/, which is where
      that answer lives, and the seven service pages were unreachable from the
      one section on the homepage that quotes prices.

      Leave it empty and the card behaves as it always has, going to /contact/.
    */
    {
      name: 'pageUrl',
      label: 'Where this card leads',
      type: 'text',
      admin: {
        description:
          'A path on this site, with the trailing slash, for example /services/web-design/. The card button goes here and a "View Details" link appears under it. Leave empty to send people to the contact form instead. trailingSlash is "always" on the site, so a path without the final slash costs a redirect.',
      },
    },
    { name: 'order', type: 'number' },
  ],
}
