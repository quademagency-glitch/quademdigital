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
    },
    {
      name: 'bookingDividerText',
      title: 'Booking Divider Text',
      type: 'string',
      initialValue: 'Or book a call directly',
      description: 'The text shown between the contact form and the booking calendar'
    },
    {
      name: 'bookingHeading',
      title: 'Booking Section Heading',
      type: 'string',
      initialValue: 'Schedule a Free Strategy Call'
    },
    {
      name: 'bookingSubtitle',
      title: 'Booking Section Subtitle',
      type: 'string',
      initialValue: 'Pick a time that works for you. No commitment, just a conversation about your goals.'
    },
    {
      name: 'calendlyUrl',
      title: 'Calendly Embed URL',
      type: 'url',
      description: 'Your Calendly scheduling page URL (e.g. https://calendly.com/your-name/meeting-type)',
      initialValue: 'https://calendly.com/quadem-agency/free-strategy-call'
    },
    {
      name: 'showBookingSection',
      title: 'Show Booking Section',
      type: 'boolean',
      description: 'Toggle the booking/calendar section on or off',
      initialValue: true
    }
  ]
}
