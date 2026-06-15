import type { Block } from 'payload'

export const TeamGrid: Block = {
  slug: 'teamGrid',
  interfaceName: 'TeamGridBlock',
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'subheading', type: 'textarea' },
    {
      name: 'members',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media' },
        { name: 'name', type: 'text', required: true },
        { name: 'role', type: 'text', required: true },
        { name: 'bio', type: 'textarea' },
        { name: 'linkedinUrl', type: 'text' },
        { name: 'twitterUrl', type: 'text' }
      ]
    }
  ]
}
