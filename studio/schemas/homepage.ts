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
    }
  ]
}
