export default {
  name: 'quaderpPage',
  title: 'QuadERP Landing Page',
  type: 'document',
  groups: [
    { name: 'hero', title: 'Hero Section' },
    { name: 'features', title: 'Features' },
    { name: 'showcase', title: 'App Showcase' },
    { name: 'pricing', title: 'Pricing' },
    { name: 'contact', title: 'Contact & CTA' },
    { name: 'seo', title: 'SEO' },
  ],
  fields: [
    // ===== HERO =====
    {
      name: 'heroBadge',
      title: 'Hero Badge Text',
      type: 'string',
      initialValue: '🚀 Introducing QuadERP',
      group: 'hero',
    },
    {
      name: 'heroTitle',
      title: 'Hero Title (before gradient)',
      type: 'string',
      initialValue: 'Take Control of Your',
      group: 'hero',
    },
    {
      name: 'heroTitleGradient',
      title: 'Hero Title (gradient text)',
      type: 'string',
      initialValue: 'Store Operations',
      group: 'hero',
    },
    {
      name: 'heroSubtitle',
      title: 'Hero Subtitle',
      type: 'text',
      initialValue: 'Real-time sales tracking, smart inventory management, staff oversight, and theft prevention — all in one powerful platform built for modern retail.',
      group: 'hero',
    },
    {
      name: 'heroImage',
      title: 'Hero Dashboard Image',
      type: 'image',
      options: { hotspot: true },
      group: 'hero',
      description: 'The main dashboard screenshot displayed in the hero section',
    },
    {
      name: 'trustBadges',
      title: 'Trust Badges',
      type: 'array',
      of: [{ type: 'string' }],
      initialValue: ['No credit card required', '14-day free trial', 'Setup in under 5 minutes'],
      group: 'hero',
    },

    // ===== FEATURES =====
    {
      name: 'featuresHeading',
      title: 'Features Section Heading',
      type: 'string',
      initialValue: 'Everything You Need to Run Your Store',
      group: 'features',
    },
    {
      name: 'featuresSubtitle',
      title: 'Features Section Subtitle',
      type: 'string',
      initialValue: 'Powerful tools designed for retail businesses of every size — from single shops to multi-location chains.',
      group: 'features',
    },
    {
      name: 'features',
      title: 'Feature Cards',
      type: 'array',
      group: 'features',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'title', title: 'Title', type: 'string' },
            { name: 'description', title: 'Description', type: 'text' },
            { name: 'icon', title: 'Icon SVG', type: 'text', description: 'SVG markup for the icon (optional — leave blank to use default)' },
          ],
          preview: {
            select: { title: 'title', subtitle: 'description' },
          },
        },
      ],
    },

    // ===== SHOWCASE =====
    {
      name: 'showcaseHeading',
      title: 'Showcase Section Heading',
      type: 'string',
      initialValue: 'See QuadERP in Action',
      group: 'showcase',
    },
    {
      name: 'showcaseItems',
      title: 'Showcase Screens',
      type: 'array',
      group: 'showcase',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'label', title: 'Section Label', type: 'string', description: 'e.g. "Sales Dashboard"' },
            { name: 'heading', title: 'Heading (before gradient)', type: 'string' },
            { name: 'headingGradient', title: 'Heading (gradient text)', type: 'string' },
            { name: 'description', title: 'Description', type: 'text' },
            { name: 'image', title: 'Screenshot', type: 'image', options: { hotspot: true } },
            {
              name: 'bulletPoints',
              title: 'Feature Bullet Points',
              type: 'array',
              of: [{ type: 'string' }],
            },
          ],
          preview: {
            select: { title: 'label', subtitle: 'heading', media: 'image' },
          },
        },
      ],
    },

    // ===== PRICING =====
    {
      name: 'pricingHeading',
      title: 'Pricing Section Heading',
      type: 'string',
      initialValue: 'Simple, Transparent Pricing',
      group: 'pricing',
    },
    {
      name: 'pricingSubtitle',
      title: 'Pricing Section Subtitle',
      type: 'string',
      initialValue: 'Start free. Scale as you grow. No hidden fees, ever.',
      group: 'pricing',
    },
    {
      name: 'pricingPlans',
      title: 'Pricing Plans',
      type: 'array',
      group: 'pricing',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'name', title: 'Plan Name', type: 'string' },
            { name: 'price', title: 'Price (e.g. "$29")', type: 'string' },
            { name: 'period', title: 'Period (e.g. "/mo")', type: 'string' },
            { name: 'description', title: 'Plan Description', type: 'text' },
            { name: 'isPopular', title: 'Is Most Popular?', type: 'boolean', initialValue: false },
            { name: 'buttonText', title: 'Button Text', type: 'string', initialValue: 'Get Started' },
            {
              name: 'features',
              title: 'Included Features',
              type: 'array',
              of: [{ type: 'string' }],
            },
          ],
          preview: {
            select: { title: 'name', subtitle: 'price' },
          },
        },
      ],
    },
    {
      name: 'pricingNote',
      title: 'Pricing Footnote',
      type: 'string',
      initialValue: '🔒 All plans include a 14-day free trial. Prices are placeholder and subject to change.',
      group: 'pricing',
    },

    // ===== CONTACT =====
    {
      name: 'contactHeading',
      title: 'Contact Section Heading',
      type: 'string',
      initialValue: 'Get Started With QuadERP',
      group: 'contact',
    },
    {
      name: 'contactSubtitle',
      title: 'Contact Section Subtitle',
      type: 'string',
      initialValue: "Tell us about your business and we'll set you up with the perfect plan.",
      group: 'contact',
    },
    {
      name: 'formspreeEndpoint',
      title: 'Formspree Endpoint',
      type: 'string',
      initialValue: 'https://formspree.io/f/xgobwrdw',
      group: 'contact',
      description: 'The Formspree form URL for demo requests',
    },
    {
      name: 'calendlyUrl',
      title: 'Calendly Demo URL',
      type: 'url',
      initialValue: 'https://calendly.com/quademdigitalenterprise/quaderp-demo-call',
      group: 'contact',
    },
    {
      name: 'whatsappNumber',
      title: 'WhatsApp Number',
      type: 'string',
      initialValue: '233530890302',
      group: 'contact',
      description: 'Without + sign (e.g. 233530890302)',
    },
    {
      name: 'whatsappMessage',
      title: 'WhatsApp Pre-filled Message',
      type: 'string',
      initialValue: "Hi Quadem! I'm interested in QuadERP for my store. Can we talk?",
      group: 'contact',
    },

    // ===== SEO =====
    {
      name: 'seoTitle',
      title: 'Page Title (SEO)',
      type: 'string',
      initialValue: 'QuadERP — All-in-One Store Management Platform | Quadem Digital',
      group: 'seo',
    },
    {
      name: 'seoDescription',
      title: 'Meta Description (SEO)',
      type: 'text',
      initialValue: 'QuadERP is a powerful, cloud-based ERP for retail stores. Track sales, manage inventory, oversee staff, and prevent losses — all in one app.',
      group: 'seo',
    },
  ],
}
