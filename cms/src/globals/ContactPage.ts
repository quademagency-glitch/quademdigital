import type { GlobalConfig } from 'payload'

export const ContactPage: GlobalConfig = {
  slug: 'contactPage',
  admin: { group: 'Pages' },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'heroHeading', type: 'text' },
    { name: 'heroSubtitle', type: 'text' },
    { name: 'contactSubtitle', type: 'text' },
    { name: 'contactText', type: 'textarea' },
    { name: 'whatsappButtonText', type: 'text' },
    { name: 'whatsappMessage', type: 'textarea' },
    { name: 'formSuccessMessage', type: 'textarea' },
    { name: 'submitButtonText', type: 'text' },
    { name: 'bookingDividerText', type: 'text' },
    { name: 'bookingHeading', type: 'text' },
    { name: 'bookingSubtitle', type: 'textarea' },
    { name: 'calendlyUrl', type: 'text' },
    { name: 'showBookingSection', type: 'checkbox', defaultValue: true },
  ],
}
