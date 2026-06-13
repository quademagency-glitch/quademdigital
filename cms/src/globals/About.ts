import type { GlobalConfig } from 'payload'

export const About: GlobalConfig = {
  slug: 'about',
  label: 'About Me',
  access: {
    read: () => true,
  },
  fields: [
    { name: 'title', label: 'Page Title', type: 'text', defaultValue: 'About Me' },
    { name: 'headline', label: 'Headline', type: 'text', admin: { description: 'The main headline for the about page' } },
    { name: 'bio', label: 'Biography', type: 'textarea', admin: { description: 'Use newlines to separate paragraphs' } },
    { name: 'mission', label: 'Mission Statement', type: 'textarea', admin: { description: 'The mission statement of the business' } },
    { name: 'vision', label: 'Vision Statement', type: 'textarea', admin: { description: 'The vision statement of the business' } },
    { name: 'founderImage', label: 'Founder Image', type: 'upload', relationTo: 'media' },
    {
      name: 'coreValues',
      label: 'Core Values',
      type: 'array',
      fields: [
        { name: 'title', label: 'Title', type: 'text' },
        { name: 'description', label: 'Description', type: 'textarea' },
      ],
    },
  ],
}
