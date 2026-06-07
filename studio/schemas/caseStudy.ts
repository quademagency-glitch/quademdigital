export default {
  name: 'caseStudy',
  title: 'Case Study',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title' }
    },
    {
      name: 'tag',
      title: 'Tag (e.g. E-commerce)',
      type: 'string',
    },
    {
      name: 'description',
      title: 'Description',
      type: 'text',
    },
    {
      name: 'resultMetric',
      title: 'Result Metric (e.g. 300%)',
      type: 'string',
    },
    {
      name: 'resultText',
      title: 'Result Text (e.g. Increase in traffic)',
      type: 'string',
    },
    {
      name: 'coverImage',
      title: 'Cover Image',
      type: 'image',
      options: { hotspot: true }
    },
    {
      name: 'body',
      title: 'Body Content',
      type: 'array',
      of: [{ type: 'block' }]
    },
    {
      name: 'imageGallery',
      title: 'Image Gallery',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
      description: 'Upload high-resolution images for the case study gallery.'
    },
    {
      name: 'videoGallery',
      title: 'Video Gallery',
      type: 'array',
      of: [
        {
          type: 'object',
          title: 'Video Item',
          fields: [
            {
              name: 'title',
              title: 'Video Title',
              type: 'string',
            },
            {
              name: 'videoUrl',
              title: 'External Video URL (YouTube/Vimeo)',
              type: 'url',
              description: 'Paste a YouTube or Vimeo link here.',
            },
            {
              name: 'videoFile',
              title: 'Direct Video Upload (MP4)',
              type: 'file',
              options: { accept: 'video/mp4,video/webm,video/quicktime' },
              description: 'Upload a video file directly if you do not want to use YouTube/Vimeo.',
            }
          ]
        }
      ],
      description: 'Add videos related to the case study.'
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
