export default {
  name: 'webapp',
  title: 'Web Application / Product',
  type: 'document',
  fields: [
    {
      name: 'name',
      title: 'App Name',
      type: 'string',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'tagline',
      title: 'Tagline',
      type: 'string',
      description: 'A short, punchy description (e.g. "The ultimate agency operating system")',
    },
    {
      name: 'description',
      title: 'Description',
      type: 'text',
      description: 'A longer explanation of what the app does.',
    },
    {
      name: 'logo',
      title: 'App Logo',
      type: 'image',
      options: { hotspot: true },
    },
    {
      name: 'coverImage',
      title: 'Cover Image / Screenshot',
      type: 'image',
      options: { hotspot: true },
    },
    {
      name: 'link',
      title: 'Link / URL',
      type: 'string',
      description: 'Where should this card link to? (e.g., "/store-manager" or "https://app.com")',
    },
    {
      name: 'status',
      title: 'Status Badge',
      type: 'string',
      options: {
        list: [
          { title: 'Live', value: 'Live' },
          { title: 'Beta', value: 'Beta' },
          { title: 'In Development', value: 'In Development' },
        ],
        layout: 'radio',
      },
      initialValue: 'Live',
    },
    {
      name: 'order',
      title: 'Order',
      type: 'number',
      description: 'Use this to manually sort the apps (e.g., 1, 2, 3)',
    },
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'tagline',
      media: 'logo',
    },
  },
}
