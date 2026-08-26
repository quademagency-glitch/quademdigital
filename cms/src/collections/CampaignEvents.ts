import type { CollectionConfig } from 'payload'

/**
 * One row per thing that happened to one campaign email.
 *
 * The bounce webhook already knew when a message was opened, clicked, bounced
 * or complained about, and it wrote the last one of those onto the subscriber,
 * overwriting the one before. So the answer to "how did that campaign do" was
 * nowhere: the subscriber row remembered only the most recent event, and the
 * campaign remembered nothing at all beyond how many messages left the building.
 *
 * A separate row per event, rather than counters nudged up and down, for one
 * reason: Resend sends several events for one message at the same instant, and
 * anything that reads a total, adds one and writes it back loses some of them.
 * That exact race put a subscriber back to pending on 2026-08-25. Inserts do not
 * race with each other, so the log is written first and the totals on the
 * campaign are recalculated from it afterwards, in a single statement.
 *
 * `eventId` is Resend's own id for the delivery, and it is unique here. Resend
 * retries a webhook it did not get a clean answer to, and without that index a
 * retry would count the same open twice.
 */
export const CampaignEvents: CollectionConfig = {
  slug: 'campaignEvents',
  labels: { singular: 'Campaign Event', plural: 'Campaign Events' },
  admin: {
    group: 'Marketing',
    useAsTitle: 'email',
    defaultColumns: ['email', 'event', 'campaign', 'occurredAt'],
    description:
      'Who opened and clicked what. Written by Resend, never by hand. The totals on each campaign are counted from here.',
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    // Written only by the endpoint on Email Campaigns, which authenticates with
    // the shared secret. Nothing types into this by hand.
    create: ({ req: { user } }) => Boolean(user),
    update: () => false,
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'campaign',
      label: 'Campaign',
      type: 'relationship',
      relationTo: 'emailCampaigns',
      required: true,
      index: true,
    },
    {
      name: 'email',
      label: 'Address',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'subscriber',
      label: 'Subscriber',
      type: 'relationship',
      relationTo: 'subscribers',
      admin: {
        description: 'Empty when the address is not on the list, which a test send is.',
      },
    },
    {
      name: 'event',
      label: 'What happened',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Delivered', value: 'delivered' },
        { label: 'Opened', value: 'opened' },
        { label: 'Clicked a link', value: 'clicked' },
        { label: 'Bounced', value: 'bounced' },
        { label: 'Marked as spam', value: 'complained' },
      ],
    },
    {
      name: 'occurredAt',
      label: 'When',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'link',
      label: 'Link clicked',
      type: 'text',
      admin: { description: 'Only on a click.' },
    },
    {
      name: 'eventId',
      label: 'Resend event id',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'What stops a retried webhook counting the same open twice.',
      },
    },
  ],
}
