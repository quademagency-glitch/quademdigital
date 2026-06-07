import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'formSubmission',
  title: 'Form Submissions',
  type: 'document',
  fields: [
    defineField({
      name: 'source',
      title: 'Source',
      type: 'string',
      description: 'Where this lead came from (e.g. Contact Form, Quote Calculator)'
    }),
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: Rule => Rule.required()
    }),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'string',
      validation: Rule => Rule.required()
    }),
    defineField({
      name: 'message',
      title: 'Message',
      type: 'text'
    }),
    defineField({
      name: 'metadata',
      title: 'Additional Data',
      type: 'text',
      description: 'Extra data like selected services or budget'
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          { title: 'New', value: 'new' },
          { title: 'Contacted', value: 'contacted' },
          { title: 'Converted', value: 'converted' },
          { title: 'Archived', value: 'archived' }
        ],
        layout: 'radio'
      },
      initialValue: 'new'
    }),
    defineField({
      name: 'submittedAt',
      title: 'Submitted At',
      type: 'datetime',
      initialValue: (new Date()).toISOString()
    })
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'source',
      date: 'submittedAt'
    },
    prepare({ title, subtitle, date }) {
      return {
        title: title,
        subtitle: `${subtitle} - ${new Date(date).toLocaleDateString()}`
      }
    }
  }
})
