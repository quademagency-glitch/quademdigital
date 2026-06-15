import type { Block } from 'payload'

export const VideoEmbed: Block = {
  slug: 'videoEmbed',
  interfaceName: 'VideoEmbedBlock',
  fields: [
    { name: 'heading', type: 'text' },
    { name: 'videoUrl', type: 'text', required: true, admin: { description: 'YouTube or Vimeo URL' } },
    { name: 'caption', type: 'textarea' },
    { name: 'thumbnailImage', type: 'upload', relationTo: 'media', admin: { description: 'Custom placeholder image before playing' } }
  ]
}
