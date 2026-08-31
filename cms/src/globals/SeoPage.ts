import type { GlobalConfig } from 'payload';

export const SeoPage: GlobalConfig = {
  slug: 'seoPage',
  admin: { group: 'Pages' },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'hero',
      type: 'group',
      fields: [
        { name: 'badge', type: 'text', defaultValue: '📈 SEO & Content Marketing' },
        { name: 'headline', type: 'text', defaultValue: 'Be Found When They Search' },
        { name: 'subtitle', type: 'textarea', defaultValue: "We don't just chase vanity metrics. We build data-driven SEO and content strategies that increase your visibility, drive qualified traffic, and generate real revenue." },
        { name: 'primaryCtaText', type: 'text', defaultValue: 'Get a Free SEO Audit', admin: { description: 'Opens WhatsApp with a message about an SEO audit.' } },
        { name: 'secondaryCtaText', type: 'text', defaultValue: 'View Pricing', admin: { description: 'Scrolls to the pricing section on this page.' } },
        { name: 'media', type: 'upload', relationTo: 'media', admin: { description: 'Hero image or video' } },
      ],
    },
    {
      name: 'servicesSection',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'Our SEO Arsenal' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Comprehensive search marketing to dominate every stage of the funnel.' },
        {
          name: 'services',
          type: 'array',
          fields: [
            { name: 'title', type: 'text' },
            { name: 'description', type: 'textarea' },
            { name: 'iconSvg', type: 'textarea', admin: { description: 'Paste SVG code here' } },
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
      name: 'portfolioGallery',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'SEO Case Studies & Results' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'See how we have driven traffic and revenue for our clients.' },
        {
          name: 'images',
          type: 'array',
          fields: [
            { name: 'image', type: 'upload', relationTo: 'media', required: true },
          ],
        },
      ],
    },
    {
      name: 'processSection',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'The Ranking Process' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'How we take your site from obscurity to the top of the SERPs.' },
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
        { name: 'heading', type: 'text', defaultValue: 'SEO Retainers' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Transparent monthly pricing. No long-term lock-ins. Proven results.' },
        { name: 'note', type: 'textarea' },
        {
          name: 'plans',
          type: 'array',
          fields: [
            { name: 'name', type: 'text', required: true },
            /*
              The cedi price. Shown to visitors in Ghana.

              Every tier on this page held a cedi figure and showed it to
              everyone, including the buyers /global exists to reach. A landing
              page reading GH₵ 2,500 is about $425 next to an international
              website price of $3,000, so the two live pages contradicted each
              other and the cheaper one won.
            */
            { name: 'price', label: 'Price (Ghana cedis)', type: 'text', required: true },
            {
              name: 'priceUsd',
              label: 'Price for visitors outside Ghana',
              type: 'text',
              admin: {
                description:
                  'What someone in the UK, the US or the Gulf sees instead of the cedi price. Leave it empty and that tier asks them to get in touch rather than showing a cedi figure. Write it as you want it read, for example "from $3,000".',
              },
            },
            { name: 'period', type: 'text' },
            { name: 'description', type: 'textarea' },
            { name: 'isPopular', type: 'checkbox', defaultValue: false },
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
      name: 'faqSection',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'SEO FAQs' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Everything you need to know about our SEO process.' },
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
      name: 'ctaSection',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'Stop Losing Traffic to Competitors' },
        { name: 'subtitle', type: 'textarea', defaultValue: "Let's run a comprehensive audit on your website and discover exactly what it takes to get you to page one." },
        { name: 'primaryButtonText', type: 'text', defaultValue: 'Request Your Free Audit', admin: { description: 'Links to the free SEO audit offer, /offers/free-seo-audit/.' } },
        { name: 'whatsappButtonText', type: 'text' },
      ],
    },
  ],
};
