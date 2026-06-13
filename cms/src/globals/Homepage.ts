import type { GlobalConfig } from 'payload'

export const Homepage: GlobalConfig = {
  slug: 'homepage',
  label: 'Homepage Content',
  access: {
    read: () => true,
  },
  fields: [
    { name: 'heroHeadline', label: 'Hero Headline', type: 'text' },
    { name: 'heroTagline', label: 'Hero Tagline', type: 'text' },
    {
      name: 'heroServices',
      label: 'Services (Typewriter Effect)',
      type: 'array',
      fields: [{ name: 'service', type: 'text' }],
    },
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
