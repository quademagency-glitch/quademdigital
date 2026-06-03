export default {
  name: 'homepage',
  title: 'Homepage Content',
  type: 'document',
  fields: [
    {
      name: 'heroHeadline',
      title: 'Hero Headline',
      type: 'string',
    },
    {
      name: 'heroTagline',
      title: 'Hero Tagline',
      type: 'string',
    },
    {
      name: 'heroServices',
      title: 'Services (Typewriter Effect)',
      type: 'array',
      of: [{type: 'string'}]
    },
    {
      name: 'founderTitle',
      title: 'Founder Section Title',
      type: 'string',
    },
    {
      name: 'founderText',
      title: 'Founder Section Text (Paragraphs)',
      type: 'array',
      of: [{type: 'text'}]
    },
    {
      name: 'founderImage',
      title: 'Founder Image',
      type: 'image',
      options: { hotspot: true }
    },
    {
      name: 'newsletterHeading',
      title: 'Newsletter Heading',
      type: 'string',
    },
    {
      name: 'newsletterSubheading',
      title: 'Newsletter Subheading',
      type: 'string',
    },
    {
      name: 'contactHeading',
      title: 'Contact Section Heading',
      type: 'string',
      initialValue: "Let's build something great"
    },
    {
      name: 'contactSubheading',
      title: 'Contact Section Subheading',
      type: 'string',
      initialValue: 'Fill out the form below or chat directly with us on WhatsApp to get started.'
    },
    {
      name: 'contactInfoTitle',
      title: 'Contact Info Title',
      type: 'string',
      initialValue: 'Get in Touch'
    },
    {
      name: 'contactInfoText',
      title: 'Contact Info Text',
      type: 'text',
      initialValue: "We're ready to help you scale your business. Reach out today and let's start the conversation."
    },
    {
      name: 'contactWhatsappButtonText',
      title: 'WhatsApp Button Text',
      type: 'string',
      initialValue: 'Chat on WhatsApp'
    },
    {
      name: 'contactSubmitButtonText',
      title: 'Submit Button Text',
      type: 'string',
      initialValue: 'Send Message'
    },
    {
      name: 'contactFormSuccessMessage',
      title: 'Form Success Message',
      type: 'string',
      initialValue: "Thanks for reaching out! We'll be in touch shortly."
    }
  ]
}
