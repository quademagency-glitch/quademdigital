import type { GlobalConfig } from 'payload'

export const VideoProductionPage: GlobalConfig = {
  slug: 'videoProductionPage',
  admin: { group: 'Pages' },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'hero',
      type: 'group',
      fields: [
        { name: 'badge', type: 'text', defaultValue: '🎬 Video Production' },
        { name: 'headline', type: 'text', defaultValue: 'Professional Video Production' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'From concept to final cut — we produce high-quality video content that captures attention, tells your story, and drives results for your brand.' },
        { name: 'primaryCtaText', type: 'text', defaultValue: 'Get a Free Quote' },
        { name: 'secondaryCtaText', type: 'text', defaultValue: 'View Pricing ↓' },
      ],
    },
    {
      name: 'servicesSection',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'What We Produce' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'From polished corporate content to high-energy social media videos, we cover it all.' },
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
        { name: 'subtitle', type: 'textarea', defaultValue: 'A taste of our recent work — from concept to final delivery.' },
        { name: 'videoUrl', type: 'text', admin: { description: 'YouTube or Vimeo URL' } },
        { name: 'isComingSoon', type: 'checkbox', defaultValue: true },
      ],
    },
    {
      name: 'processSection',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'Our Production Process' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'A streamlined workflow that takes your project from idea to screen.' },
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
        { name: 'heading', type: 'text', defaultValue: 'Video Production Pricing' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Transparent pricing designed for businesses at every stage. All prices are starting points — we tailor every project to your needs.' },
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
        { name: 'heading', type: 'text', defaultValue: 'Frequently Asked Questions' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Everything you need to know about our video production services.' },
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
        { name: 'heading', type: 'text', defaultValue: 'Ready to bring your vision to life?' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Book a free video consultation and let\'s discuss your next project. No commitments — just a conversation about your goals.' },
        { name: 'primaryButtonText', type: 'text', defaultValue: 'Book a Free Consultation' },
        { name: 'whatsappButtonText', type: 'text', defaultValue: '💬 Chat on WhatsApp' },
      ],
    },
  ],
}
