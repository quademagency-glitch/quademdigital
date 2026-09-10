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

      Africa and the rest of the world are not the same offer at different
      exchange rates, they are different tiers. Africa buys packages (Starter,
      Growth, Premium), priced in cedis; everyone else buys service lines
      (website build, video retainer, growth retainer), priced in dollars. Each
      visitor then sees their list in their own money: see src/lib/markets.js
      in the site repo. Before this field the site had one list and showed a
      converted cedi price abroad, so a website was $425 on the homepage and
      "from $1,200" on the international page, and anyone who saw both pages
      saw the cheaper number.

      The site renders both sets and reveals one after the geo lookup, because
      public pages are edge-cached for 60 seconds and a server-rendered choice
      would be handed to the wrong country.

      The stored value is still 'ghana', from before the cedi list was shown
      across the continent. Renaming it would need a migration and would orphan
      every plan already filed, so only the label changed. CMS_AFRICA_MARKET in
      src/lib/markets.js is the one place that translates it.
    */
    {
      name: 'market',
      type: 'select',
      label: 'Shown to',
      required: true,
      defaultValue: 'ghana',
      options: [
        { label: 'Africa (cedi packages)', value: 'ghana' },
        { label: 'Everyone else (dollar service lines)', value: 'international' },
      ],
      admin: {
        description:
          'Africa plans appear to visitors anywhere in Africa, priced from the cedi figure and converted into their own currency. International plans appear to everyone else, on the homepage and on /global.',
      },
    },
    { name: 'price', type: 'text', required: true },
    /*
      One price per plan, and the admin shows only the one the site uses.

      Until 10 September 2026 both boxes showed on every plan, and the Africa
      packages still carried dollar figures from before the market rule: $425
      on Starter, $950 on Growth, $1,955 on Premium, the cedi prices converted
      at an old rate. Nothing on the site reads them (PricingSection.astro
      prices an Africa plan from priceGHS and nothing else), but the box beside
      them said "Shown to visitors outside Ghana", so the admin reported that
      foreigners were being quoted $425 for a website when they were not. A
      figure the site ignores should not be on the screen next to a label
      saying the site uses it.
    */
    {
      name: 'priceUSD',
      type: 'number',
      label: 'Price (USD)',
      admin: {
        condition: (data) => data?.market === 'international',
        description: 'The price for visitors outside Africa, in US dollars. The page converts it into the visitor\'s own currency, so London sees pounds and Berlin sees euros.',
      },
    },
    {
      name: 'priceGHS',
      type: 'number',
      label: 'Price (GH₵)',
      admin: {
        condition: (data) => data?.market !== 'international',
        description: 'The price for visitors in Africa, in cedis. Ghana sees it as written; the rest of Africa sees it converted into their own currency, naira in Lagos, shillings in Nairobi.',
      },
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
