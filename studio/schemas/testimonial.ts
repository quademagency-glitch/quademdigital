export default {
  name: 'testimonial',
  title: 'Testimonial',
  type: 'document',
  fields: [
    {
      name: 'authorName',
      title: 'Author Name',
      type: 'string',
    },
    {
      name: 'authorRole',
      title: 'Author Role',
      type: 'string',
    },
    {
      name: 'quote',
      title: 'Quote',
      type: 'text',
    },
    {
      name: 'stars',
      title: 'Stars (Rating out of 5)',
      type: 'number',
      validation: Rule => Rule.min(1).max(5)
    },
    {
      name: 'avatar',
      title: 'Avatar Image',
      type: 'image',
      options: { hotspot: true }
    },
    {
      name: 'order',
      title: 'Order',
      type: 'number',
    }
  ],
  orderings: [
    {
      title: 'Manual Order',
      name: 'manualOrder',
      by: [{field: 'order', direction: 'asc'}]
    }
  ]
}
