export default {
  name: 'siteSettings',
  title: 'Site Settings',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Site Title',
      type: 'string',
    },
    {
      name: 'description',
      title: 'Site Description',
      type: 'text',
    },
    {
      name: 'email',
      title: 'Contact Email',
      type: 'string',
    },
    {
      name: 'whatsappNumber',
      title: 'WhatsApp Number',
      type: 'string',
      description: 'Include country code, no spaces or + sign (e.g. 1234567890)'
    },
    {
      name: 'socialLinks',
      title: 'Social Links',
      type: 'object',
      description: 'Add your social media profile URLs. Leave blank to hide a platform.',
      fields: [
        { name: 'linkedin', title: 'LinkedIn', type: 'url' },
        { name: 'instagram', title: 'Instagram', type: 'url' },
        { name: 'twitter', title: 'Twitter / X', type: 'url' },
        { name: 'facebook', title: 'Facebook', type: 'url' },
        { name: 'youtube', title: 'YouTube', type: 'url' },
        { name: 'tiktok', title: 'TikTok', type: 'url' },
        { name: 'github', title: 'GitHub', type: 'url' },
        { name: 'behance', title: 'Behance', type: 'url' },
        { name: 'dribbble', title: 'Dribbble', type: 'url' },
        { name: 'threads', title: 'Threads', type: 'url' },
      ]
    },
    {
      name: 'footerTagline',
      title: 'Footer Tagline',
      type: 'string',
    },
    {
      name: 'clientLogos',
      title: 'Client Logos',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }]
    },
    {
      name: 'navLinks',
      title: 'Navigation Links',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'label', title: 'Label', type: 'string' },
            { name: 'url', title: 'URL Path (e.g. /services)', type: 'string' }
          ]
        }
      ]
    },
    {
      name: 'footerLinks',
      title: 'Footer Links',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'label', title: 'Label', type: 'string' },
            { name: 'url', title: 'URL Path', type: 'string' }
          ]
        }
      ]
    }
  ]
}
