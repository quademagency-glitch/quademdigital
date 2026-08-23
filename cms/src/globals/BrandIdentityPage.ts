import type { GlobalConfig } from 'payload';

export const BrandIdentityPage: GlobalConfig = {
  slug: 'brandIdentityPage',
  admin: { group: 'Pages' },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'hero',
      type: 'group',
      fields: [
        { name: 'badge', type: 'text', defaultValue: '🎨 Brand Identity' },
        { name: 'headline', type: 'text', defaultValue: 'Professional Brand & Graphic Design' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Distinct visual identities that make your brand memorable and professional.' },
        { name: 'primaryCtaText', type: 'text', defaultValue: 'Get a Free Quote', admin: { description: 'Links to /contact/. Only the wording is editable here.' } },
        { name: 'secondaryCtaText', type: 'text', defaultValue: 'View Pricing ↓', admin: { description: 'Scrolls to the pricing section on this page.' } },
        { name: 'media', type: 'upload', relationTo: 'media', admin: { description: 'Hero image or video' } },
      ],
    },
    {
      name: 'servicesSection',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'Brand Design Services' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Logo design, brand kits, visual identity systems, and more.' },
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
        { name: 'heading', type: 'text', defaultValue: 'Our Portfolio Showcase' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'A glimpse of our branding projects, from concept to delivery.' },
        { name: 'videoUrl', type: 'text', admin: { description: 'YouTube or Vimeo URL' } },
        { name: 'isComingSoon', type: 'checkbox', defaultValue: true },
      ],
    },
    {
      name: 'portfolioGallery',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'Our Work Gallery' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Explore some of our recent brand identity projects.' },
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
        { name: 'heading', type: 'text', defaultValue: 'Brand Identity Pricing' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Transparent pricing for brand design projects of any scale.' },
        { name: 'note', type: 'textarea', defaultValue: '* Prices are starting points. Final pricing is determined by project scope, complexity, and timeline.' },
        {
          name: 'plans',
          type: 'array',
          fields: [
            { name: 'name', type: 'text', required: true },
            { name: 'price', type: 'text', required: true },
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
        { name: 'heading', type: 'text', defaultValue: 'Brand Design FAQs' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Common questions about our branding services.' },
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
        { name: 'heading', type: 'text', defaultValue: 'Ready to build a memorable brand?' },
        { name: 'subtitle', type: 'textarea', defaultValue: "Book a free branding consultation and let's discuss your visual identity. No commitments, just a conversation about your goals." },
        { name: 'primaryButtonText', type: 'text', defaultValue: 'Book a Free Consultation', admin: { description: 'Links to /contact/.' } },
        { name: 'whatsappButtonText', type: 'text', defaultValue: '💬 Chat on WhatsApp', admin: { description: 'Opens WhatsApp with a message about branding.' } },
      ],
    },
  ],
};
