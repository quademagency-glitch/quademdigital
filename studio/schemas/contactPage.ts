export default {
  name: 'contactPage',
  title: 'Contact Page',
  type: 'document',
  fields: [
    {
      name: 'heroHeading',
      title: 'Hero Heading',
      type: 'string',
      initialValue: 'Contact Us'
    },
    {
      name: 'heroSubtitle',
      title: 'Hero Subtitle',
      type: 'string',
      initialValue: "Let's build something great together."
    },
    {
      name: 'contactSubtitle',
      title: 'Contact Info Subtitle',
      type: 'string',
      initialValue: 'Get in Touch'
    },
    {
      name: 'contactText',
      title: 'Contact Info Text',
      type: 'text',
      initialValue: "We're ready to help you scale your business. Reach out today and let's start the conversation."
    },
    {
      name: 'whatsappButtonText',
      title: 'WhatsApp Button Text',
      type: 'string',
      initialValue: 'Chat on WhatsApp'
    },
    {
      name: 'whatsappMessage',
      title: 'WhatsApp Pre-filled Message',
      type: 'string',
      initialValue: "Hi Quadem Digital! I'd like to discuss a project."
    },
    {
      name: 'formSuccessMessage',
      title: 'Form Success Message',
      type: 'string',
      initialValue: "Thanks for reaching out! We'll be in touch shortly."
    },
    {
      name: 'submitButtonText',
      title: 'Submit Button Text',
      type: 'string',
      initialValue: 'Send Message'
    }
  ]
}
