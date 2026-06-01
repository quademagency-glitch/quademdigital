export default {
  name: 'about',
  title: 'About Me',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Page Title',
      type: 'string',
      initialValue: 'About Me'
    },
    {
      name: 'headline',
      title: 'Headline',
      type: 'string',
      description: 'The main headline for the about page'
    },
    {
      name: 'bio',
      title: 'Biography',
      type: 'text',
      description: 'Use newlines to separate paragraphs'
    },
    {
      name: 'mission',
      title: 'Mission Statement',
      type: 'text',
      description: 'The mission statement of the business'
    },
    {
      name: 'vision',
      title: 'Vision Statement',
      type: 'text',
      description: 'The vision statement of the business'
    },
    {
      name: 'founderImage',
      title: 'Founder Image',
      type: 'image',
      options: {
        hotspot: true,
      },
    },
    {
      name: 'coreValues',
      title: 'Core Values',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'title', type: 'string', title: 'Title' },
            { name: 'description', type: 'text', title: 'Description' }
          ]
        }
      ]
    }
  ]
}
