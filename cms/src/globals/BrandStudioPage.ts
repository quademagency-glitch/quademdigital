import type { GlobalConfig } from 'payload';

export const BrandStudioPage: GlobalConfig = {
  slug: 'brandStudioPage',
  admin: { group: 'Pages' },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'title', type: 'text', admin: { description: 'Browser tab + search result title (SEO).' }, defaultValue: "Quadem Brand Studio | Your Brand's Content Team, On Subscription" },
    { name: 'description', type: 'textarea', admin: { description: 'Meta description shown in search results (SEO).' }, defaultValue: 'Premium social posts, reels and ad creatives every month, with no shoots and no hassle. A monthly content subscription for Ghanaian brands that want to grow.' },
    {
      name: 'settings',
      type: 'group',
      fields: [
        { name: 'whatsappNumber', type: 'text', admin: { description: 'Overrides the site WhatsApp number for this page. Leave blank to use Site Settings.' } },
        { name: 'calendlyUrl', type: 'text', defaultValue: 'https://calendly.com/quadem-agency/free-strategy-call' },
      ],
    },
    {
      name: 'hero',
      type: 'group',
      fields: [
        { name: 'eyebrow', type: 'text', defaultValue: 'New · Quadem Brand Studio' },
        { name: 'headingTop', type: 'text', defaultValue: "Your brand's content team," },
        { name: 'headingAccent', type: 'text', defaultValue: 'on subscription.', admin: { description: 'Shown in the gradient accent colour.' } },
        { name: 'subheading', type: 'textarea', defaultValue: 'Premium posts, reels and ad creatives, produced and published every month. No shoots to organise and no one to hire. You pay a fixed monthly fee and we keep your brand visible.' },
        { name: 'primaryCtaText', type: 'text', defaultValue: 'Book a Free Strategy Call' },
        { name: 'secondaryCtaText', type: 'text', defaultValue: 'See Plans & Pricing' },
        { name: 'trustText', type: 'text', defaultValue: 'Built for Ghana. MoMo payments accepted, and you deal with the founder directly.' },
      ],
    },
    {
      name: 'howSection',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'How Brand Studio works' },
        { name: 'subheading', type: 'textarea', defaultValue: 'Set it up once and fresh content lands in your inbox every month.' },
        {
          name: 'steps',
          type: 'array',
          fields: [
            { name: 'number', type: 'text', admin: { description: 'e.g. 1' } },
            { name: 'title', type: 'text' },
            { name: 'description', type: 'textarea' },
          ],
        },
      ],
    },
    {
      name: 'pricingSection',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'Simple monthly plans' },
        { name: 'subheading', type: 'textarea', defaultValue: 'Fixed price, fixed scope, and you can cancel anytime. Prices in Ghana Cedis.' },
        { name: 'addonsText', type: 'textarea', defaultValue: 'paid-ad management (10 to 15% of ad spend), one-off launch campaigns, and product-photo packs.', admin: { description: 'Shown after a bold "Add-ons:" label.' } },
        { name: 'unsureText', type: 'text', defaultValue: 'Not sure which plan fits?' },
        {
          name: 'plans',
          type: 'array',
          admin: { description: 'Price is shown as "GHS {price}/mo" — enter just the number, e.g. 1,800.' },
          fields: [
            { name: 'name', type: 'text', required: true },
            { name: 'price', type: 'text', required: true },
            { name: 'blurb', type: 'textarea' },
            { name: 'isPopular', type: 'checkbox', defaultValue: false },
            { name: 'ctaText', type: 'text' },
            {
              name: 'features',
              type: 'array',
              fields: [
                { name: 'feature', type: 'text' },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'whySection',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'Why brands choose Brand Studio' },
        {
          name: 'items',
          type: 'array',
          fields: [
            { name: 'title', type: 'text' },
            { name: 'description', type: 'textarea' },
          ],
        },
      ],
    },
    {
      name: 'faqSection',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'Frequently asked questions' },
        {
          name: 'faqs',
          type: 'array',
          fields: [
            { name: 'question', type: 'text', required: true },
            { name: 'answer', type: 'textarea', required: true },
          ],
        },
      ],
    },
    {
      name: 'finalCta',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'Ready to never worry about content again?' },
        { name: 'subheading', type: 'textarea', defaultValue: "Book a free 15-minute call. We'll show you exactly what your first month would look like." },
        { name: 'primaryCtaText', type: 'text', defaultValue: 'Book a Free Strategy Call' },
        { name: 'whatsappCtaText', type: 'text', defaultValue: 'Chat on WhatsApp' },
      ],
    },
  ],
};
