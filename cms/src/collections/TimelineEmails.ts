import type { CollectionConfig } from 'payload'
import { isAdmin, nobody } from '../access/roles'

/*
  Each email that told a client about their timeline (lib/clientTimeline.ts):
  the whole plan, or an update with what changed. One row per email, only ever
  added, written by the CMS alone and read by Ernest.

  `snapshot` is what that email showed, every step as it stood and the updates
  it carried, and is what the next day's run compares against to decide
  whether there is anything new to say. A row per email rather than a field on
  the client, because the client is versioned and a daily write there would
  push its real history out of the fifty versions it keeps.
*/

export const TimelineEmails: CollectionConfig = {
  slug: 'timeline-emails',
  labels: { singular: 'Timeline email', plural: 'Timeline emails' },
  admin: { group: 'CRM & Sales', useAsTitle: 'subject', defaultColumns: ['client', 'kind', 'summary', 'sentAt'], hidden: true },
  access: { read: isAdmin, create: nobody, update: nobody, delete: isAdmin },
  timestamps: true,
  fields: [
    { name: 'client', type: 'relationship', relationTo: 'clients', required: true, index: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'The whole timeline', value: 'plan' },
        { label: 'What changed', value: 'update' },
      ],
    },
    { name: 'sentAt', type: 'date', required: true, index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'to', type: 'text' },
    { name: 'subject', type: 'text' },
    // "2 steps done, 1 new date": what the portal shows beside it.
    { name: 'summary', type: 'text' },
    { name: 'snapshot', type: 'json' },
    // Resend's id for the message.
    { name: 'sendId', type: 'text' },
  ],
}
