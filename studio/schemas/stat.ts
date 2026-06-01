export default {
  name: 'stat',
  title: 'Stat',
  type: 'document',
  fields: [
    {
      name: 'value',
      title: 'Stat Value',
      type: 'number',
    },
    {
      name: 'label',
      title: 'Stat Label',
      type: 'string',
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
