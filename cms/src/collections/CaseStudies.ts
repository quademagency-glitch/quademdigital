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
        SaveButton: './components/RedirectAfterSave#SaveAndRedirectButton',
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

    /*
      Measured before and after.

      resultMetric and resultText above hold one number and one sentence, which
      is right for "300% increase in traffic" and cannot express a comparison.
      A performance case study is a comparison or it is nothing, and it is a
      repeatable product for this business rather than a one-off, so it gets a
      field rather than a table typed into the body.

      Three rules the render depends on:

      1. before and after are text, not numbers. The real values are "19.3s",
         "300ms", "100/100" and "0.001". A number type would force a unit column
         and then force formatting at render time, which is where rounding
         creeps in, and rounding a measurement is how a true claim becomes a
         false one.
      2. An empty before or after renders as "not recorded". Never blank, never
         a dash, never an estimate. Some of the July desktop sub-metrics were
         genuinely not captured and saying so is the honest answer.
      3. metricsSource is not decoration. Anyone can re-run a speed test on the
         after and nobody can re-run the before, so naming the tool, the device
         and both dates is the whole reason the numbers are believable.
    */
    {
      name: 'metricsTitle',
      label: 'Metrics: heading',
      type: 'text',
      admin: { description: 'For example: Measured before and after. Leave empty to hide the whole block.' },
    },
    {
      name: 'metricsBeforeLabel',
      label: 'Metrics: "before" column heading',
      type: 'text',
      admin: { description: 'Use the date the measurement was taken, not the word "before".' },
    },
    {
      name: 'metricsAfterLabel',
      label: 'Metrics: "after" column heading',
      type: 'text',
      admin: { description: 'Use the date the measurement was taken, not the word "after".' },
    },
    {
      name: 'metricsSource',
      label: 'Metrics: where the numbers came from',
      type: 'textarea',
      admin: {
        description:
          'The tool, the device, the settings and both dates. Printed under the table. Without it the table is a claim rather than evidence.',
      },
    },
    {
      name: 'metrics',
      label: 'Metrics: rows',
      type: 'array',
      admin: { description: 'One row per measurement. Rows are shown in this order.' },
      fields: [
        {
          name: 'section',
          label: 'Group',
          type: 'text',
          admin: { description: 'For example Mobile or Desktop. Rows sharing a group are banded together.' },
        },
        { name: 'label', label: 'What was measured', type: 'text', required: true },
        {
          name: 'before',
          label: 'Before',
          type: 'text',
          admin: { description: 'Exactly as the tool reported it, units and all. Leave empty if it was never recorded.' },
        },
        {
          name: 'after',
          label: 'After',
          type: 'text',
          admin: { description: 'Exactly as the tool reported it, units and all. Leave empty if it was never recorded.' },
        },
        {
          name: 'highlight',
          label: 'Show above the table',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Up to three rows also appear as large figures above the table. Pick the ones a non-technical reader would feel.' },
        },
      ],
    },
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
      name: 'showUnderServices',
      label: 'Show under services',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Web Design', value: 'web-design' },
        { label: 'SEO & Paid Ads', value: 'seo' },
        { label: 'Branding & Graphic Design', value: 'brand-identity' },
        { label: 'AI Video & Reels', value: 'video-production' },
        { label: 'Digital Marketing & Social Media', value: 'digital-marketing' },
      ],
      admin: {
        description:
          'Which service pages this project appears on, in the "Work we have delivered" section. Pick as many as apply. Only published projects show.',
      },
    },
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
