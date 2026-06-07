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
      title: 'Social Media Links',
      description: 'Add, remove, or reorder your social media profiles.',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {
              name: 'platform',
              title: 'Platform',
              type: 'string',
              options: {
                list: [
                  { title: 'LinkedIn', value: 'linkedin' },
                  { title: 'Instagram', value: 'instagram' },
                  { title: 'Twitter / X', value: 'twitter' },
                  { title: 'Facebook', value: 'facebook' },
                  { title: 'YouTube', value: 'youtube' },
                  { title: 'TikTok', value: 'tiktok' },
                  { title: 'GitHub', value: 'github' },
                  { title: 'Behance', value: 'behance' },
                  { title: 'Dribbble', value: 'dribbble' },
                  { title: 'Threads', value: 'threads' },
                  { title: 'Pinterest', value: 'pinterest' },
                  { title: 'Snapchat', value: 'snapchat' },
                  { title: 'Other', value: 'other' },
                ],
              },
              validation: (Rule: any) => Rule.required(),
            },
            {
              name: 'url',
              title: 'Profile URL',
              type: 'url',
              validation: (Rule: any) => Rule.required(),
            },
            {
              name: 'label',
              title: 'Custom Label (only for "Other")',
              type: 'string',
              description: 'If you selected "Other", give it a name (e.g. "WhatsApp", "Discord")',
              hidden: ({ parent }: any) => parent?.platform !== 'other',
            },
          ],
          preview: {
            select: { platform: 'platform', url: 'url', label: 'label' },
            prepare({ platform, url, label }: any) {
              const names: Record<string, string> = {
                linkedin: 'LinkedIn', instagram: 'Instagram', twitter: 'Twitter / X',
                facebook: 'Facebook', youtube: 'YouTube', tiktok: 'TikTok',
                github: 'GitHub', behance: 'Behance', dribbble: 'Dribbble',
                threads: 'Threads', pinterest: 'Pinterest', snapchat: 'Snapchat',
                other: label || 'Other',
              }
              return { title: names[platform] || platform, subtitle: url }
            },
          },
        },
      ],
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
