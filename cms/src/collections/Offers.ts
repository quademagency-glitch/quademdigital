import type { CollectionConfig } from 'payload'
import { makeSlugHook } from '../hooks/slugify'

export const Offers: CollectionConfig = {
  slug: 'offers',
  labels: { singular: 'Offer', plural: 'Offers' },
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
    { name: 'title', label: 'Offer Title', type: 'text', required: true },
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
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    { name: 'image', label: 'Cover Image', type: 'upload', relationTo: 'media' },
    { name: 'cta', label: 'Call to Action Button Text', type: 'text', defaultValue: 'Claim Offer' },
    /*
      The thing being offered, when the thing is a file.

      Lead magnets were recorded and never delivered. Someone filled in the Free
      SEO Audit form, the request was written to the CMS, and the receipt said
      "I will come back to you within 24 hours" with nothing attached, because
      there was nowhere to attach anything. An offer that is a service still
      works that way, and should: leave this empty and the receipt is unchanged.

      Sent as a link rather than an attachment. A PDF on an email trips spam
      filters and bounces on size limits, and the link keeps working when
      somebody forwards the message to a colleague.
    */
    {
      name: 'deliverable',
      label: 'File to send them',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description:
          'Optional. Attach a guide, checklist or template and the receipt email carries a download link to it. Anyone with that link can open it, so put nothing here that is not meant to be given away.',
      },
    },
    {
      name: 'deliverableLabel',
      label: 'Wording on the download button',
      type: 'text',
      admin: {
        condition: (data) => Boolean(data?.deliverable),
        description: 'Defaults to "Download your copy". Say what it is: "Download the checklist".',
      },
    },
    { name: 'publishedAt', label: 'Published at', type: 'date', defaultValue: () => new Date().toISOString() },
  ],
}
