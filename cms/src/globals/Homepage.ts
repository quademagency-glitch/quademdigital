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
    { name: 'heroSubheadline', label: 'Hero Sub-headline', type: 'textarea', admin: { description: 'Supporting sentence beneath the tagline — founder-led, honest tone.' } },
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
        { name: 'service', label: 'Highlighted Word', type: 'text' },
        { name: 'suffix', label: 'Words After (Optional)', type: 'text', admin: { description: 'Replaces the default text after the highlighted word for this specific service.' } }
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
      admin: { description: '"New agency. No risk to you." Retire this block once you have a real track record by unchecking Enabled.' },
      fields: [
        {
          name: 'enabled',
          label: 'Enabled',
          type: 'checkbox',
          defaultValue: true,
        },
        { name: 'heading', label: 'Heading', type: 'text', defaultValue: 'New agency. No risk to you.' },
        {
          name: 'body',
          label: 'Body',
          type: 'textarea',
          defaultValue: "We're early, and we know trust is earned. That's why we back every engagement with a clear scope, weekly updates, and a satisfaction guarantee — if we don't deliver what we promised, you don't pay.",
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
