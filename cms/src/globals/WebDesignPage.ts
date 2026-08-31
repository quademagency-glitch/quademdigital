import type { GlobalConfig } from 'payload';

export const WebDesignPage: GlobalConfig = {
  slug: 'webDesignPage',
  admin: { group: 'Pages' },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'hero',
      type: 'group',
      fields: [
        { name: 'badge', type: 'text', defaultValue: '🖥️ Web Design' },
        { name: 'headline', type: 'text', defaultValue: 'Professional Web Design' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Custom, responsive websites built to convert visitors into loyal customers and grow your business.' },
        { name: 'primaryCtaText', type: 'text', defaultValue: 'Get a Free Quote', admin: { description: 'Links to /contact/. Only the wording is editable here.' } },
        { name: 'secondaryCtaText', type: 'text', defaultValue: 'View Pricing ↓', admin: { description: 'Scrolls to the pricing section on this page.' } },
        { name: 'media', type: 'upload', relationTo: 'media', admin: { description: 'Hero image or video' } },
      ],
    },
    {
      name: 'servicesSection',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'Web Design Services' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'From custom websites to e‑commerce platforms, we craft digital experiences that work.' },
        {
          name: 'services',
          type: 'array',
          fields: [
            { name: 'title', type: 'text' },
            { name: 'description', type: 'textarea' },
            { name: 'iconSvg', type: 'textarea', admin: { description: 'Paste SVG code here' } },
          ],
        },
      ],
    },
    {
      name: 'showreel',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'Our Showreel' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'A taste of our web design projects, from concept to launch.' },
        { name: 'videoUrl', type: 'text', admin: { description: 'YouTube or Vimeo URL' } },
        { name: 'isComingSoon', type: 'checkbox', defaultValue: true },
      ],
    },
    {
      name: 'portfolioGallery',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'Our Work Gallery' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Explore some of our recent web design projects.' },
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
        { name: 'heading', type: 'text', defaultValue: 'Our Design Process' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'A streamlined workflow that takes your project from idea to launch.' },
        {
          name: 'steps',
          type: 'array',
          fields: [
            { name: 'number', type: 'text', admin: { description: 'e.g. 01' } },
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
        { name: 'heading', type: 'text', defaultValue: 'Web Design Pricing' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Transparent pricing for websites of any scale.' },
        { name: 'note', type: 'textarea', defaultValue: '* Prices are starting points. Final pricing is determined by project scope, complexity, and timeline.' },
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
        { name: 'heading', type: 'text', defaultValue: 'Web Design FAQs' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Common questions about our web design services.' },
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
        { name: 'heading', type: 'text', defaultValue: 'Ready to launch your website?' },
        { name: 'subtitle', type: 'textarea', defaultValue: "Book a free web design consultation and let's discuss your project. No commitments, just a conversation about your goals." },
        { name: 'primaryButtonText', type: 'text', defaultValue: 'Book a Free Consultation', admin: { description: 'Links to the web dev discount offer, /offers/web-dev-discount/.' } },
        { name: 'whatsappButtonText', type: 'text', defaultValue: '💬 Chat on WhatsApp', admin: { description: 'Opens WhatsApp with a message about web design.' } },
      ],
    },
  ],
};
