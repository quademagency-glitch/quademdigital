import type { CollectionConfig } from 'payload'
import { isAdminOrEditor } from '../access/isAdminOrEditor'
import { makeSlugHook } from '../hooks/slugify'
import { autoPublishCollectionHook } from '../hooks/autoPublish'

export const BlogPosts: CollectionConfig = {
  slug: 'blogPosts',
  labels: {
    singular: 'Blog Post',
    plural: 'Blog Posts',
  },
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'publishedAt'],
    components: {
      edit: {
        PublishButton: './components/RedirectAfterSave#PublishAndRedirectButton',
        SaveDraftButton: './components/HiddenButton#HiddenButton',
      },
    },
  },
  versions: {
    drafts: true,
  },
  hooks: {
    beforeChange: [autoPublishCollectionHook],
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
      validate: (value: string | null | undefined) => {
        if (value && value.length > 3000) return `LinkedIn post must be 3000 characters or fewer (currently ${value.length})`
        return true
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
      label: 'Body',
      type: 'richText',
    },
    {
      name: 'publishedAt',
      label: 'Published At',
      type: 'date',
      index: true,
      defaultValue: () => new Date().toISOString(),
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
