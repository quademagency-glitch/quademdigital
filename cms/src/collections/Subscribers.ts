import crypto from 'crypto'
import type { CollectionConfig } from 'payload'

/**
 * The mailing list, owned here rather than rented from Resend.
 *
 * Until this collection existed, a newsletter signup was written to a Resend
 * audience and nowhere else. That made Resend the only record of who had asked
 * to hear from Quadem, when they asked, and what they were told they would get.
 * Losing that account, or a mistaken bulk edit inside it, would have lost the
 * list with no way to reconstruct it, and there was no answer at all to
 * "prove this person consented", which is the question that matters when
 * someone complains.
 *
 * Resend stays as the transport. This is the system of record: Payload decides
 * who is on the list and what state they are in, and pushes that to Resend.
 * Where the two disagree, this wins.
 */

/** A capability token: whoever holds it can act on this subscriber, so it has to be unguessable. */
const newToken = (): string => crypto.randomBytes(24).toString('base64url')

export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  labels: { singular: 'Subscriber', plural: 'Subscribers' },
  admin: {
    group: 'Marketing',
    useAsTitle: 'email',
    defaultColumns: ['email', 'status', 'source', 'consentAt'],
    description:
      'Everyone who has asked to hear from you, and the record of when they asked. Resend is only the postman.',
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    // The site adds subscribers from the footer form and the lead magnets,
    // authenticating as the editor account, so this is not public.
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  /*
    History, not drafts. Consent is the thing being recorded, so being able to
    show when someone's status changed, and to what, is the point. Capped
    because the bounce webhook writes here on a schedule of its own.

    That history earned itself within an hour of shipping: it is what showed
    that a delivery event was reverting a confirmation. See the endpoint below.
  */
  versions: { maxPerDoc: 50 },
  /*
    Delivery events, written the only way that is safe.

    The site's Resend webhook used to PATCH this collection over REST. Resend
    sends several events for one message and they arrive at the same instant, so
    two requests would read the row, each merge its own change onto the copy it
    had read, and the slower one would write back everything it had seen. On
    2026-08-25 that took a subscriber who had just confirmed and just hard
    bounced, and put them back to pending with no confirmation date, 37
    milliseconds later. Nothing errored. The version history is the only reason
    it was visible at all.

    `payload.db.updateOne` writes the named columns and touches nothing else, so
    a delivery event cannot revert a confirmation, an unsubscribe, or anything
    else it was not told about. Same reason videoPipeline.ts uses it. It fires
    no hooks either, so it cannot recurse.
  */
  endpoints: [
    {
      path: '/delivery-event',
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

        const email = String(body?.email || '').trim().toLowerCase()
        const event = String(body?.event || '').trim()
        if (!email || !event) {
          return Response.json({ error: 'email and event are required.' }, { status: 400 })
        }

        const found = await req.payload.find({
          collection: 'subscribers',
          where: { email: { equals: email } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const doc = found.docs?.[0]
        // Not everyone Resend emails is on the list. Nothing to record, and
        // that is not an error worth making Resend retry over.
        if (!doc) return Response.json({ ok: true, known: false }, { status: 200 })

        const at = body?.at ? new Date(body.at).toISOString() : new Date().toISOString()
        const data: Record<string, unknown> = {
          delivery: {
            lastEvent: event,
            lastEventAt: at,
            detail: body?.detail ? String(body.detail).slice(0, 500) : null,
          },
        }
        if (event === 'sent' || event === 'delivered') data.lastEmailAt = at

        /*
          A decision the person made is never overwritten by a machine. Somebody
          who unsubscribed and later bounces is still an unsubscribe.
        */
        const final = body?.final === 'bounced' || body?.final === 'complained' ? body.final : null
        if (final && doc.status !== 'unsubscribed') data.status = final

        try {
          await req.payload.db.updateOne({
            collection: 'subscribers',
            id: doc.id,
            data,
            returning: false,
          })
        } catch (err: any) {
          req.payload.logger.error(err, `subscribers: could not record ${event} for ${email}`)
          return Response.json({ error: 'Could not record it.' }, { status: 500 })
        }

        return Response.json({ ok: true, known: true, status: data.status ?? doc.status }, { status: 200 })
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (!data) return data

        // One person is one row. Addresses arrive from forms with stray
        // whitespace and inconsistent case, and "Ama@Example.com" and
        // "ama@example.com" are the same inbox, so the unique index below is
        // only meaningful once they are normalised.
        if (typeof data.email === 'string') data.email = data.email.trim().toLowerCase()

        /*
          Generated here rather than at the call site, so a subscriber added by
          hand in the admin can still be unsubscribed by a link.

          `operation === 'create'` matters. Without it every update regenerates
          the token, because a PATCH does not name it, and every unsubscribe
          link already sitting in somebody's inbox stops working the moment a
          delivery event touches their row.
        */
        if (operation === 'create' && !data.unsubscribeToken) data.unsubscribeToken = newToken()

        return data
      },
    ],
  },
  fields: [
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      admin: { description: 'Optional. Most footer signups give an address only.' },
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      defaultValue: 'subscribed',
      index: true,
      options: [
        { label: 'Pending confirmation', value: 'pending' },
        { label: 'Subscribed', value: 'subscribed' },
        { label: 'Unsubscribed', value: 'unsubscribed' },
        { label: 'Bounced', value: 'bounced' },
        { label: 'Complained', value: 'complained' },
      ],
      admin: {
        description:
          'Only "Subscribed" receives a campaign. Bounced and Complained are set by Resend, not by hand.',
      },
    },
    {
      name: 'source',
      label: 'Where they came from',
      type: 'select',
      defaultValue: 'other',
      options: [
        { label: 'Newsletter form', value: 'newsletter' },
        { label: 'Contact form opt-in', value: 'contact-form' },
        { label: 'Lead magnet', value: 'lead-magnet' },
        { label: 'Became a client', value: 'client' },
        { label: 'Imported from Resend', value: 'import' },
        { label: 'Added by hand', value: 'manual' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'sourceDetail',
      label: 'Which one',
      type: 'text',
      admin: {
        description: 'The offer or page, where the source alone does not say enough.',
      },
    },
    {
      name: 'interests',
      label: 'Interested in',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Everything', value: 'general' },
        { label: 'SEO and paid ads', value: 'seo' },
        { label: 'Web design', value: 'web-design' },
        { label: 'Brand identity', value: 'brand-identity' },
        { label: 'AI video and reels', value: 'video' },
      ],
      admin: {
        description:
          'Used to send a campaign to part of the list instead of all of it. Empty means they get everything.',
      },
    },
    {
      name: 'consentAt',
      label: 'Asked to join on',
      type: 'date',
      admin: {
        description: 'When they submitted the form. This is the record that they opted in.',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'confirmedAt',
      label: 'Confirmed on',
      type: 'date',
      admin: {
        description: 'When they clicked the confirmation link, once double opt-in is switched on.',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'unsubscribedAt',
      label: 'Left on',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'lastEmailAt',
      label: 'Last emailed',
      type: 'date',
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'delivery',
      label: 'Delivery problems',
      type: 'group',
      admin: {
        description:
          'Written by Resend when a message fails. A hard bounce or a complaint stops all further sending to this address.',
      },
      fields: [
        {
          name: 'lastEvent',
          label: 'What happened',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'lastEventAt',
          label: 'When',
          type: 'date',
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'detail',
          label: 'Reason given',
          type: 'textarea',
          admin: { readOnly: true },
        },
      ],
    },
    {
      name: 'unsubscribeToken',
      label: 'Unsubscribe token',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description:
          'The secret inside the unsubscribe link for this person. Generated automatically, and never worth pasting anywhere.',
      },
    },
    {
      name: 'resendContactId',
      label: 'Resend contact',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'The matching row at Resend, so the two can be kept in step.',
      },
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
    },
  ],
}
