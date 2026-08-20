import type { GlobalConfig } from 'payload'

export const QuadERPPage: GlobalConfig = {
  slug: 'quaderpPage',
  admin: { group: 'Landing Pages' },
  access: { read: () => true },
  fields: [
    { name: 'heroBadge', type: 'text', defaultValue: '🚀 Introducing QuadERP' },
    { name: 'heroTitle', type: 'text', defaultValue: 'Take Control of Your' },
    { name: 'heroTitleGradient', type: 'text', defaultValue: 'Store Operations' },
    { name: 'heroSubtitle', type: 'textarea', defaultValue: 'Real-time sales tracking, smart inventory management, staff oversight, and theft prevention, all in one powerful platform built for modern retail.' },
    { name: 'trustBadges', type: 'array', fields: [{ name: 'badge', type: 'text' }] },

    { name: 'featuresHeading', type: 'text', defaultValue: 'Everything You Need to Run Your Store' },
    { name: 'featuresSubtitle', type: 'textarea', defaultValue: 'Powerful tools designed for retail businesses of every size, from single shops to multi-location chains.' },
    {
      name: 'features',
      type: 'array',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'description', type: 'textarea' },
        { name: 'icon', type: 'text' },
      ]
    },

    { name: 'showcaseHeading', type: 'text', defaultValue: 'See QuadERP in Action' },
    {
      name: 'showcaseItems',
      type: 'array',
      fields: [
        { name: 'label', type: 'text' },
        { name: 'heading', type: 'text' },
        { name: 'headingGradient', type: 'text' },
        { name: 'description', type: 'textarea' },
        { name: 'bulletPoints', type: 'array', fields: [{ name: 'point', type: 'text' }] },
      ]
    },

    { name: 'pricingHeading', type: 'text', defaultValue: 'Simple, Transparent Pricing' },
    { name: 'pricingSubtitle', type: 'textarea', defaultValue: 'Start free. Scale as you grow. No hidden fees, ever.' },
    {
      name: 'pricingPlans',
      type: 'array',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'price', type: 'text' },
        { name: 'period', type: 'text' },
        { name: 'description', type: 'textarea' },
        { name: 'features', type: 'array', fields: [{ name: 'feature', type: 'text' }] },
        { name: 'isPopular', type: 'checkbox' },
        { name: 'buttonText', type: 'text' },
      ]
    },
    { name: 'pricingNote', type: 'textarea', defaultValue: '🔒 All plans include a 14-day free trial. Prices are placeholder and subject to change.' },

    { name: 'contactHeading', type: 'text', defaultValue: 'Get Started With QuadERP' },
    { name: 'contactSubtitle', type: 'textarea', defaultValue: "Tell us about your business and we'll set you up with the perfect plan." },
    { name: 'formspreeEndpoint', type: 'text', defaultValue: 'https://formspree.io/f/xgobwrdw' },
    { name: 'calendlyUrl', type: 'text', defaultValue: 'https://calendly.com/quademdigitalenterprise/quaderp-demo-call' },
    { name: 'whatsappNumber', type: 'text', defaultValue: '233530890302' },
    { name: 'whatsappMessage', type: 'textarea', defaultValue: "Hi Quadem! I'm interested in QuadERP for my store. Can we talk?" },

    { name: 'seoTitle', type: 'text' },
    { name: 'seoDescription', type: 'textarea' },
  ]
}
