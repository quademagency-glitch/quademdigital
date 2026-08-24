import type { GlobalConfig } from 'payload'

export const Homepage: GlobalConfig = {
  slug: 'homepage',
  label: 'Homepage Content',
  admin: { group: 'Pages' },
  access: {
    read: () => true,
  },
  fields: [
    // ── Hero ──────────────────────────────────────────────────────────────
    { name: 'heroHeadline', label: 'Hero Headline', type: 'text' },
    { name: 'heroTagline', label: 'Hero Tagline', type: 'text' },
    { name: 'heroSubheadline', label: 'Hero Sub-headline', type: 'textarea', admin: { description: 'Supporting sentence beneath the tagline. Founder-led, honest tone.' } },
    {
      name: 'primaryCta',
      label: 'Primary CTA',
      type: 'group',
      fields: [
        { name: 'label', label: 'Button Label', type: 'text', defaultValue: 'Get a Free Audit' },
        { name: 'link', label: 'Link', type: 'text', defaultValue: '#contact' },
      ],
    },
    {
      name: 'secondaryCta',
      label: 'Secondary CTA',
      type: 'group',
      fields: [
        { name: 'label', label: 'Button Label', type: 'text', defaultValue: 'View Our Work' },
        { name: 'link', label: 'Link', type: 'text', defaultValue: '#work' },
      ],
    },
    {
      name: 'heroServices',
      label: 'Services (Typewriter Effect)',
      type: 'array',
      fields: [
        { name: 'prefix', label: 'Words Before (Optional)', type: 'text', admin: { description: 'Replaces the default text before the highlighted word for this specific service.' } },
        { name: 'service', label: 'Highlighted Word', type: 'text' },
        { name: 'suffix', label: 'Words After (Optional)', type: 'text', admin: { description: 'Replaces the default text after the highlighted word for this specific service.' } },
        { name: 'rawMedia', label: 'Service Media (Image/Video)', type: 'upload', relationTo: 'media', admin: { description: 'Image/video shown in the hero.' } },
        { name: 'mockupMedia', label: 'Mockup Image', type: 'upload', relationTo: 'media', admin: { description: 'Optional device-mockup image to show instead of the raw service media.' } },
        { name: 'mockupStatus', label: 'Mockup Status', type: 'select', defaultValue: 'pending', options: [
          { label: 'Pending', value: 'pending' },
          { label: 'Processing', value: 'processing' },
          { label: 'Ready', value: 'ready' },
          { label: 'Failed', value: 'failed' },
        ] },
      ],
    },

    // ── Trust Highlights (replaces stats when showStats is off) ───────────
    {
      name: 'showStats',
      label: 'Show Stats Counter Block',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Only enable once the Stats collection has real, verified numbers.' },
    },
    {
      name: 'trustHighlights',
      label: 'Trust Highlights',
      type: 'array',
      maxRows: 4,
      admin: { description: '3–4 short value cards shown in place of the stats counter. E.g. "Direct Founder Access / Built for Ghana / Results-Focused".' },
      fields: [
        { name: 'icon', label: 'Icon (emoji or SVG name)', type: 'text' },
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'description', label: 'Description', type: 'textarea', required: true },
      ],
    },

    // ── Risk Reversal Block ───────────────────────────────────────────────
    {
      name: 'riskReversal',
      label: 'Risk Reversal Block',
      type: 'group',
      admin: {
        description:
          'The strip under the hero. It removes the buyer\'s risk: say what they get and what protects them. Do NOT frame it around being new or unproven ("we\'re early", "bet on our hunger"): that reads as inexperience and costs conversions. State the guarantee with confidence instead.',
      },
      fields: [
        {
          name: 'enabled',
          label: 'Enabled',
          type: 'checkbox',
          defaultValue: true,
        },
        { name: 'heading', label: 'Heading', type: 'text', defaultValue: 'Your project, without the risk.' },
        {
          name: 'body',
          label: 'Body',
          type: 'textarea',
          defaultValue:
            'Know your exact price and timeline before we start. You pay in milestones, see progress every week, and we refine until you sign off.',
        },
      ],
    },

    /*
      The four service promo cards down the homepage. Each one is a badge, a
      two-part heading, a paragraph and a button; the illustration beside it is
      artwork rather than content, so `visual` picks which of the four is drawn
      and its colours come with it.

      Reordering the rows reorders the cards. Removing a row removes the card.
      Before this they were four hardcoded components and the copy could only
      be changed with a deploy.
    */
    {
      name: 'promoSections',
      label: 'Service Promo Cards',
      type: 'array',
      admin: {
        description:
          'The service cards down the homepage. Drag to reorder. Leave empty to fall back to the four built in cards.',
        components: {
          RowLabel: './components/PromoRowLabel#PromoRowLabel',
        },
      },
      fields: [
        {
          name: 'visual',
          label: 'Artwork',
          type: 'select',
          required: true,
          defaultValue: 'video',
          options: [
            { label: 'Play button (blue)', value: 'video' },
            { label: 'Browser window (blue)', value: 'webDesign' },
            { label: 'Logo and colour swatches (purple)', value: 'brandIdentity' },
            { label: 'Rising chart (green)', value: 'seo' },
          ],
          admin: {
            description:
              'The illustration drawn beside the words. The card takes its colour from this.',
          },
        },
        {
          name: 'badge',
          label: 'Small label above the heading',
          type: 'text',
          admin: { description: 'For example: Core Service. Leave empty for no label.' },
        },
        { name: 'heading', label: 'Heading', type: 'text', required: true },
        {
          name: 'headingAccent',
          label: 'Heading, coloured ending',
          type: 'text',
          admin: {
            description:
              'Added to the end of the heading in the brand gradient. Leave empty for a plain heading.',
          },
        },
        { name: 'body', label: 'Paragraph', type: 'textarea', required: true },
        {
          name: 'ctaLabel',
          label: 'Button label',
          type: 'text',
          admin: { description: 'The arrow is added for you. Leave empty for no button.' },
        },
        {
          name: 'ctaUrl',
          label: 'Button link',
          type: 'text',
          admin: { description: 'For example /services/web-design/ .' },
        },
      ],
    },

    // ── Founder Section ───────────────────────────────────────────────────
    { name: 'founderTitle', label: 'Founder Section Title', type: 'text' },
    {
      name: 'founderText',
      label: 'Founder Section Text (Paragraphs)',
      type: 'array',
      fields: [{ name: 'paragraph', type: 'textarea' }],
    },
    { name: 'founderImage', label: 'Founder Image', type: 'upload', relationTo: 'media' },
    { name: 'newsletterHeading', label: 'Newsletter Heading', type: 'text' },
    { name: 'newsletterSubheading', label: 'Newsletter Subheading', type: 'text' },
    { name: 'contactHeading', label: 'Contact Section Heading', type: 'text', defaultValue: "Let's build something great" },
    {
      name: 'contactSubheading',
      label: 'Contact Section Subheading',
      type: 'text',
      defaultValue: 'Fill out the form below or chat directly with us on WhatsApp to get started.',
    },
    { name: 'contactInfoTitle', label: 'Contact Info Title', type: 'text', defaultValue: 'Get in Touch' },
    {
      name: 'contactInfoText',
      label: 'Contact Info Text',
      type: 'textarea',
      defaultValue: "We're ready to help you scale your business. Reach out today and let's start the conversation.",
    },
    { name: 'contactWhatsappButtonText', label: 'WhatsApp Button Text', type: 'text', defaultValue: 'Chat on WhatsApp' },
    { name: 'contactSubmitButtonText', label: 'Submit Button Text', type: 'text', defaultValue: 'Send Message' },
    {
      name: 'contactFormSuccessMessage',
      label: 'Form Success Message',
      type: 'text',
      defaultValue: "Thanks for reaching out! We'll be in touch shortly.",
    },
  ],
}
