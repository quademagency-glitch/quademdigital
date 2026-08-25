import type { CollectionConfig } from 'payload'
import {
  lexicalHTMLField,
  lexicalEditor,
  UploadFeature
} from '@payloadcms/richtext-lexical'

export const EmailCampaigns: CollectionConfig = {
  slug: 'emailCampaigns',
  labels: { singular: 'Email Campaign', plural: 'Email Campaigns' },
  admin: {
    group: 'Marketing',
    useAsTitle: 'subject',
    components: {
      edit: {
        SaveButton: './components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  /*
    The send button's other half.

    The site does the sending, because the shared email layout, the unsubscribe
    links and the subscriber helpers all live there and a second copy of the
    template in here is exactly what this work removes. This endpoint exists so
    that the shared secret stays on a server: a button in the admin panel runs
    in a browser, and anything it can read is public.

    It replaces /admin/campaigns.astro, which asked for a password that was
    compiled into the page's own JavaScript.
  */
  endpoints: [
    {
      path: '/:id/send',
      method: 'post',
      handler: async (req: any) => {
        if (!req.user) {
          return Response.json({ error: 'Log in first.' }, { status: 401 })
        }

        const siteUrl = process.env.ASTRO_SITE_URL || 'https://quademdigital.com'
        const secret = process.env.CMS_WEBHOOK_SECRET
        if (!secret) {
          return Response.json(
            { error: 'CMS_WEBHOOK_SECRET is not set on this service, so sending is switched off.' },
            { status: 503 },
          )
        }

        try {
          const res = await fetch(`${siteUrl.replace(/\/$/, '')}/api/campaigns/send/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-quadem-secret': secret },
            body: JSON.stringify({ campaignId: req.routeParams?.id }),
          })
          const body = await res.json().catch(() => ({}))
          return Response.json(body, { status: res.status })
        } catch (err: any) {
          req.payload.logger.error(err, 'Campaign send could not reach the site')
          return Response.json({ error: 'Could not reach the site to send.' }, { status: 502 })
        }
      },
    },
  ],
  fields: [
    { name: 'client', type: 'relationship', relationTo: 'clients', label: 'Target Client' },
    { name: 'subject', label: 'Subject', type: 'text', required: true },
    { name: 'previewText', label: 'Preview Text', type: 'text' },
    {
      name: 'body',
      label: 'Body',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures,
          UploadFeature(),
        ],
      }),
    },
    lexicalHTMLField({ lexicalFieldName: 'body', htmlFieldName: 'body_html' }),
    { name: 'ctaText', label: 'CTA Text', type: 'text' },
    { name: 'ctaUrl', label: 'CTA URL', type: 'text' },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Sent', value: 'sent' },
      ]
    },
    /*
      Everything below turns this collection from a place drafts are typed into
      a record of what was actually sent.

      It used to hold a subject and a body and nothing else, and the thing that
      did the sending never read it and never wrote back. So there was no answer
      to "who received this", "when did it go", or "did it go at all". The Gemini
      drafts written by aiEmailGenerator landed in a collection nothing could
      send from.
    */
    {
      name: 'sendButton',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: './components/SendCampaignButton#SendCampaignButton' },
      },
    },
    {
      name: 'segment',
      label: 'Who gets this',
      type: 'select',
      defaultValue: 'all',
      options: [
        { label: 'Everyone subscribed', value: 'all' },
        { label: 'Interested in SEO and paid ads', value: 'seo' },
        { label: 'Interested in web design', value: 'web-design' },
        { label: 'Interested in brand identity', value: 'brand-identity' },
        { label: 'Interested in AI video and reels', value: 'video' },
        { label: 'Nobody, a test to Ernest only', value: 'test' },
      ],
      admin: {
        description:
          'Only people who ticked the box on a form are ever included. Someone with no interests chosen counts as interested in everything. Send a test to yourself first.',
      },
    },
    {
      name: 'sentAt',
      label: 'Sent',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Filled in by the send. A campaign with a date here cannot be sent twice.',
      },
    },
    {
      name: 'recipientCount',
      label: 'People it went to',
      type: 'number',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'sendLog',
      label: 'What happened',
      type: 'textarea',
      admin: {
        readOnly: true,
        description: 'Written by the send, including anything that failed and why.',
      },
    },
  ],
}
