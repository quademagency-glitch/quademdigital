import type { Block } from 'payload'

/**
 * The site had a renderer for a `contactFormSection` block since the Sanity
 * migration, but no such block was ever defined here, so the branch could
 * never run. This is the missing half.
 *
 * Submissions go to /api/submit-form on the site with `source: cms-page`,
 * which is already a listed value on the Leads collection.
 */
export const ContactForm: Block = {
  slug: 'contactForm',
  interfaceName: 'ContactFormBlock',
  labels: { singular: 'Contact Form', plural: 'Contact Forms' },
  fields: [
    { name: 'heading', type: 'text', defaultValue: 'Tell me about your project' },
    { name: 'subheading', type: 'textarea' },
    {
      name: 'buttonLabel',
      type: 'text',
      defaultValue: 'Send message',
      admin: {
        description:
          'One form per page. A second one still sends, but without the inline thank-you message.',
      },
    },
  ],
}
