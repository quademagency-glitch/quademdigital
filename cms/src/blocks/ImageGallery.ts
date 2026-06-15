import type { Block } from 'payload'

export const ImageGallery: Block = {
  slug: 'imageGallery',
  interfaceName: 'ImageGalleryBlock',
  fields: [
    { name: 'heading', type: 'text' },
    { name: 'layout', type: 'select', options: ['grid', 'masonry', 'carousel'], defaultValue: 'grid' },
    {
      name: 'images',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'caption', type: 'text' }
      ]
    }
  ]
}
