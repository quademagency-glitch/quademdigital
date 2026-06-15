import type { Block } from 'payload'

export const TestimonialSlider: Block = {
  slug: 'testimonialSlider',
  interfaceName: 'TestimonialSliderBlock',
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'testimonials',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'quote', type: 'textarea', required: true },
        { name: 'authorName', type: 'text', required: true },
        { name: 'authorRole', type: 'text' },
        { name: 'authorImage', type: 'upload', relationTo: 'media' },
        { name: 'companyLogo', type: 'upload', relationTo: 'media' }
      ]
    }
  ]
}
