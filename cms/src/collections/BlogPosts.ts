import type { CollectionConfig } from 'payload'
import { isAdminOrEditor } from '../access/isAdminOrEditor'
import { makeSlugHook } from '../hooks/slugify'
import { previewUrl } from '../lib/preview'

export const BlogPosts: CollectionConfig = {
  slug: 'blogPosts',
  labels: {
    singular: 'Blog Post',
    plural: 'Blog Posts',
  },
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'updatedAt'],
    components: {
      edit: {
        PublishButton: './components/RedirectAfterSave#PublishAndRedirectButton',
      },
    },
    preview: (doc) => previewUrl(doc, 'blogPosts', (slug) => `/blog/${slug}/`),
  },
  versions: {
    drafts: true,
  },
  access: {
    read: () => true,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
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
        beforeValidate: [makeSlugHook('title')],
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
      label: 'Legacy Body (JSON)',
      type: 'json',
      admin: {
        description: 'Legacy Sanity portable text. Do not edit. Use the Content field below instead.',
      },
    },
    {
      name: 'content',
      label: 'Content',
      type: 'richText',
    },
    {
      name: 'publishedAt',
      label: 'Published At',
      type: 'date',
      index: true,
    },
    {
      name: 'author',
      label: 'Author',
      type: 'text',
      // A named human, not the company: the blog is founder-led positioning,
      // and the article schema declares this as a Person.
      defaultValue: 'Ernest Avorwlanu',
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
