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
    }
  ]
}
