import type { CollectionConfig } from 'payload'
import {
  lexicalHTMLField,
  lexicalEditor,
  UploadFeature
} from '@payloadcms/richtext-lexical'

/**
 * Recount a campaign's totals from its event log, in one statement.
 *
 * DISTINCT on the address, not a count of rows, because the two answer
 * different questions and only one of them is worth reading. Resend fires an
 * open every time the tracking pixel loads: reopening a message, a phone
 * syncing the mailbox twice, a corporate scanner prefetching it. Counting rows
 * would report thirty opens from a list of five and look like a triumph.
 *
 * Done as a recount rather than "add one to the total", because a webhook that
 * reads a number and writes it back loses events that arrive together, which
 * they do.
 */
const recountCampaign = async (payload: any, campaignId: number): Promise<void> => {
  const pool = (payload.db as { pool?: { query: Function } }).pool
  if (!pool?.query) throw new Error('No Postgres pool available to count campaign events.')

  await pool.query(
    `UPDATE "email_campaigns" AS c SET
       "stats_delivered"     = s.delivered,
       "stats_opened"        = s.opened,
       "stats_clicked"       = s.clicked,
       "stats_bounced"       = s.bounced,
       "stats_complained"    = s.complained,
       "stats_last_event_at" = s.last_at
     FROM (
       SELECT
         COUNT(DISTINCT "email") FILTER (WHERE "event" = 'delivered')  AS delivered,
         COUNT(DISTINCT "email") FILTER (WHERE "event" = 'opened')     AS opened,
         COUNT(DISTINCT "email") FILTER (WHERE "event" = 'clicked')    AS clicked,
         COUNT(DISTINCT "email") FILTER (WHERE "event" = 'bounced')    AS bounced,
         COUNT(DISTINCT "email") FILTER (WHERE "event" = 'complained') AS complained,
         MAX("occurred_at") AS last_at
       FROM "campaign_events"
       WHERE "campaign_id" = $1
     ) s
     WHERE c."id" = $1`,
    [campaignId],
  )
}

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
    /*
      The other direction: Resend telling us how the campaign did.

      The site's webhook is what Resend actually talks to, because that is where
      the signature is verified. It forwards anything carrying a campaign tag
      here, with the shared secret, and this writes the log row and recounts.

      Same reasoning as the delivery-event endpoint on Subscribers: doing this
      as a REST PATCH from the site means reading a document and writing it back,
      and simultaneous events then overwrite each other. An insert plus a
      recount cannot.
    */
    {
      path: '/record-event',
      method: 'post',
      handler: async (req: any) => {
        const secret = process.env.CMS_WEBHOOK_SECRET
        if (!secret || req.headers.get('x-quadem-secret') !== secret) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        let body: any
        try {
          body = await req.json()
        } catch {
          return Response.json({ error: 'Expected JSON.' }, { status: 400 })
        }

        const campaignId = Number.parseInt(String(body?.campaignId ?? ''), 10)
        const email = String(body?.email || '').trim().toLowerCase()
        const event = String(body?.event || '').trim()
        const allowed = ['delivered', 'opened', 'clicked', 'bounced', 'complained']

        if (!Number.isInteger(campaignId) || !email || !allowed.includes(event)) {
          return Response.json(
            { error: 'campaignId, email and a known event are required.' },
            { status: 400 },
          )
        }

        // A tag can outlive the campaign it names. Recording an event against a
        // campaign that has been deleted would fail on the foreign key anyway;
        // saying so plainly is better than a 500 Resend will retry all evening.
        const campaign = await req.payload
          .findByID({ collection: 'emailCampaigns', id: campaignId, depth: 0, overrideAccess: true })
          .catch(() => null)
        if (!campaign) return Response.json({ ok: true, known: false }, { status: 200 })

        /*
          Has this exact delivery already been recorded?

          Resend retries any webhook it did not get a clean answer to, and the
          second delivery of one open is not a second open. The unique index on
          eventId is what actually guarantees that, but relying on the insert to
          fail was a mistake: Payload checks `unique` itself, before Postgres
          ever sees the row, and throws a validation error rather than the
          duplicate-key error the catch below was written for. So a retry came
          back 500, Resend retried again, and the loop only ended when it gave
          up. Found by replaying an event, not by reading the code.

          The lookup answers it plainly. The catch stays as the backstop for two
          events arriving in the same instant, where the loser is told to retry
          and finds the row on its way back round.
        */
        const eventId = body?.eventId ? String(body.eventId) : null
        if (eventId) {
          const seen = await req.payload.find({
            collection: 'campaignEvents',
            where: { eventId: { equals: eventId } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })
          if (seen.totalDocs) return Response.json({ ok: true, duplicate: true }, { status: 200 })
        }

        const found = await req.payload.find({
          collection: 'subscribers',
          where: { email: { equals: email } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        try {
          await req.payload.create({
            collection: 'campaignEvents',
            overrideAccess: true,
            data: {
              campaign: campaignId,
              email,
              subscriber: found.docs?.[0]?.id ?? null,
              event,
              occurredAt: body?.at ? new Date(body.at).toISOString() : new Date().toISOString(),
              link: body?.link ? String(body.link).slice(0, 500) : null,
              eventId,
            },
          })
        } catch (err: any) {
          /*
            The unique index doing its job, on the narrow race the lookup above
            cannot close. Payload and Postgres report it differently, so both
            shapes are accepted: a validation error naming the field, and the
            raw duplicate-key error if the row got as far as the database.
          */
          const message = String(err?.message || '')
          const fields: any[] = Array.isArray(err?.data?.errors) ? err.data.errors : []
          const duplicate =
            message.includes('duplicate key') ||
            err?.code === '23505' ||
            fields.some((f) => f?.path === 'eventId' || f?.field === 'eventId')
          if (!duplicate) {
            req.payload.logger.error(err, `campaignEvents: could not record ${event} for ${email}`)
            return Response.json({ error: 'Could not record it.' }, { status: 500 })
          }
          return Response.json({ ok: true, duplicate: true }, { status: 200 })
        }

        try {
          await recountCampaign(req.payload, campaignId)
        } catch (err: any) {
          /*
            The row is in, which is the part that cannot be reconstructed. A
            total that is one behind is fixed by the next event, or by the
            Recount button. Returning 500 here would make Resend send the event
            again and the unique index would then throw it away, leaving the
            count wrong permanently.
          */
          req.payload.logger.error(err, `campaignEvents: recorded ${event} but could not recount`)
          return Response.json({ ok: true, recounted: false }, { status: 200 })
        }

        return Response.json({ ok: true, recounted: true }, { status: 200 })
      },
    },
    /*
      Recount by hand. Needed exactly once so far: the totals are written by the
      statement above, so a campaign whose events arrived while that was failing
      would otherwise stay wrong for ever.
    */
    {
      path: '/:id/recount',
      method: 'post',
      handler: async (req: any) => {
        if (!req.user) return Response.json({ error: 'Log in first.' }, { status: 401 })
        const id = Number.parseInt(String(req.routeParams?.id ?? ''), 10)
        if (!Number.isInteger(id)) return Response.json({ error: 'Bad id.' }, { status: 400 })

        try {
          await recountCampaign(req.payload, id)
        } catch (err: any) {
          req.payload.logger.error(err, 'Campaign recount failed')
          return Response.json({ error: 'Could not recount.' }, { status: 500 })
        }
        return Response.json({ ok: true }, { status: 200 })
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
    /*
      How it did. Counted from the Campaign Events log, never typed.

      Every number here is people, not events, so "Opened" means how many
      different addresses opened it at least once. A campaign that went to
      twenty and was opened by six says six, however many times those six came
      back to it.
    */
    {
      name: 'stats',
      label: 'How it did',
      type: 'group',
      admin: {
        description:
          'Counted from Campaign Events, which Resend writes. Each number is people, not opens: someone who opens a message four times is one. Empty until the first event arrives, which is usually within a minute of sending.',
      },
      fields: [
        {
          name: 'delivered',
          label: 'Reached an inbox',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'opened',
          label: 'Opened it',
          type: 'number',
          admin: {
            readOnly: true,
            description:
              'Undercounts. Most mail apps block the tracking pixel by default, so read this as a floor rather than a total.',
          },
        },
        {
          name: 'clicked',
          label: 'Clicked a link',
          type: 'number',
          admin: {
            readOnly: true,
            description: 'The number worth watching. A click is a person deciding to do something.',
          },
        },
        {
          name: 'bounced',
          label: 'Could not be delivered',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'complained',
          label: 'Marked it as spam',
          type: 'number',
          admin: {
            readOnly: true,
            description: 'Any number above zero here is worth stopping for.',
          },
        },
        {
          name: 'lastEventAt',
          label: 'Last heard anything',
          type: 'date',
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
        },
      ],
    },
  ],
}
