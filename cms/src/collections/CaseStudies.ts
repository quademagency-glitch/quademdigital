import type { CollectionConfig } from 'payload'
import { makeSlugHook } from '../hooks/slugify'

export const CaseStudies: CollectionConfig = {
  slug: 'caseStudies',
  labels: { singular: 'Case Study', plural: 'Case Studies' },
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    components: {
      edit: {
        SaveButton: '../components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
  access: { read: () => true },
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    {
      name: 'slug',
      label: 'Slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      hooks: {
        beforeValidate: [makeSlugHook('title')],
      },
    },
    { name: 'tag', label: 'Tag (e.g. E-commerce)', type: 'text' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'resultMetric', label: 'Result Metric (e.g. 300%)', type: 'text' },
    { name: 'resultText', label: 'Result Text (e.g. Increase in traffic)', type: 'text' },
    { name: 'coverImage', label: 'Cover Image', type: 'upload', relationTo: 'media' },
    { name: 'body', label: 'Body Content', type: 'json' },
    {
      name: 'imageGallery',
      label: 'Image Gallery',
      type: 'array',
      fields: [{ name: 'image', type: 'upload', relationTo: 'media' }],
    },
    {
      name: 'videoGallery',
      label: 'Video Gallery',
      type: 'array',
      fields: [
        { name: 'title', label: 'Video Title', type: 'text' },
        { name: 'videoUrl', label: 'External Video URL', type: 'text' },
        { name: 'videoFile', label: 'Direct Video Upload (MP4)', type: 'upload', relationTo: 'media' },
      ],
    },
    { name: 'order', label: 'Order', type: 'number' },
    {
      name: 'projectType',
      label: 'Project Type',
      type: 'select',
      defaultValue: 'concept',
      options: [
        { label: 'Client Work', value: 'client' },
        { label: 'Concept / Spec', value: 'concept' },
        { label: 'Internal / Self', value: 'self' },
      ],
      admin: { description: 'Displayed as a badge on the site. "Concept" means no real client relationship.' },
    },
    {
      name: 'published',
      label: 'Published',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Only publish when the entry is real and complete.' },
    },
  ],
}
