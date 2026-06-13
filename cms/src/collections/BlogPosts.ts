import type { CollectionConfig } from 'payload'

export const BlogPosts: CollectionConfig = {
  slug: 'blogPosts',
  labels: {
    singular: 'Blog Post',
    plural: 'Blog Posts',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'publishedAt'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'title',
      label: 'Title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      label: 'Slug',
      type: 'text',
      required: true,
      unique: true,
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (!value && data?.title) {
              return data.title.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '')
            }
            return value
          },
        ],
      },
    },
    {
      name: 'excerpt',
      label: 'Excerpt',
      type: 'textarea',
      admin: {
        description: 'A short summary shown on blog listing cards (max ~160 chars)',
      },
    },
    {
      name: 'linkedInPost',
      label: 'Custom LinkedIn Post (Optional)',
      type: 'textarea',
      admin: {
        description: 'Write exactly what you want posted on LinkedIn (max 3000 chars).',
      },
      maxLength: 3000,
    },
    {
      name: 'coverImage',
      label: 'Cover Image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'category',
      label: 'Category',
      type: 'relationship',
      relationTo: 'blogCategories',
    },
    {
      name: 'body',
      label: 'Body',
      type: 'json',
      admin: { description: 'PortableText JSON from Sanity' },
    },
    {
      name: 'publishedAt',
      label: 'Published At',
      type: 'date',
    },
    {
      name: 'author',
      label: 'Author',
      type: 'text',
      defaultValue: 'Quadem Digital',
    },
    {
      name: 'seoDescription',
      label: 'SEO Description',
      type: 'textarea',
      admin: {
        description: 'Meta description for search engines',
      },
    },
  ],
}
