export default {
  name: 'processStep',
  title: 'Process Step',
  type: 'document',
  fields: [
    {
      name: 'stepNumber',
      title: 'Step Number',
      type: 'number',
    },
    {
      name: 'title',
      title: 'Title',
      type: 'string',
    },
    {
      name: 'description',
      title: 'Description',
      type: 'text',
    }
  ],
  orderings: [
    {
      title: 'Step Number',
      name: 'stepNumberAsc',
      by: [{field: 'stepNumber', direction: 'asc'}]
    }
  ]
}
