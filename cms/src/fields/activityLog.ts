import type { Field } from 'payload'

/**
 * A record of contact, and the date of the next one.
 *
 * Leads and Clients both had a status and nothing else. A status says where
 * something got to; it does not say what was said, when, or what was promised,
 * so the only place any of that lived was Ernest's memory and his WhatsApp
 * history. "Did I ever ring them back" had no answer in the CRM.
 *
 * Defined once and used by both, because the two are the same record at
 * different stages: a lead becomes a client, and the history should not change
 * shape or disappear when it does.
 *
 * Deliberately not a separate collection. The log belongs to the record and is
 * only ever read beside it, and one person typing into an admin panel is not
 * going to race themselves. `nextFollowUp` is the exception and sits at the top
 * level, indexed, because that one is read across every record at once, which
 * is the question a CRM exists to answer: who is waiting on me today.
 */

export const nextFollowUpField = (what: 'lead' | 'client'): Field => ({
  name: 'nextFollowUp',
  label: 'Follow up on',
  type: 'date',
  index: true,
  admin: {
    position: 'sidebar',
    date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' },
    description:
      what === 'lead'
        ? 'Anything dated today or earlier shows on the dashboard until you move it or clear it.'
        : 'A check-in, a renewal conversation, a promise you made. Shows on the dashboard when it comes due.',
  },
})

/**
 * `team: true` is the leads version (spec 4.2): each row also says which way it
 * went, what kind of contact it was, who wrote it and when it was written. The
 * last two are set by the server (lib/leadRules.ts) and never typed.
 */
export const activityField = ({ team = false }: { team?: boolean } = {}): Field => ({
  name: 'activity',
  label: 'Contact history',
  type: 'array',
  labels: { singular: 'Entry', plural: 'Entries' },
  admin: {
    description:
      'One entry per conversation. Newest first is easiest to read, so add new ones at the top and drag if they get out of order.',
    initCollapsed: true,
    components: {
      RowLabel: './components/ActivityRowLabel#ActivityRowLabel',
    },
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'at',
          label: 'When',
          type: 'date',
          required: true,
          // Today, because the overwhelmingly common case is writing this up
          // straight after the call. Changing a date is quicker than typing one.
          defaultValue: () => new Date().toISOString(),
          admin: {
            width: '50%',
            date: { pickerAppearance: 'dayAndTime', displayFormat: 'd MMM yyyy, HH:mm' },
          },
        },
        {
          name: 'kind',
          label: 'How',
          type: 'select',
          defaultValue: 'whatsapp',
          options: [
            { label: 'WhatsApp', value: 'whatsapp' },
            { label: 'Phone call', value: 'call' },
            { label: 'Email', value: 'email' },
            { label: 'Meeting', value: 'meeting' },
            { label: 'Note to self', value: 'note' },
            ...(team
              ? [
                  { label: 'Instagram', value: 'instagram' },
                  { label: 'Facebook', value: 'facebook' },
                  { label: 'Text message', value: 'sms' },
                ]
              : []),
          ],
          admin: { width: '50%' },
        },
      ],
    },
    ...(team ? teamActivityFields : []),
    {
      name: 'note',
      label: 'What was said',
      type: 'textarea',
      required: true,
      admin: {
        description:
          'Write it for yourself in three months. What they asked for, what you promised, and what happens next.',
      },
    },
  ],
})

const teamActivityFields: Field[] = [
  {
    type: 'row',
    fields: [
      {
        name: 'type',
        label: 'What',
        type: 'select',
        options: [
          { label: 'First message', value: 'first-message' },
          { label: 'Follow-up', value: 'follow-up' },
          { label: 'Reply received', value: 'reply' },
          { label: 'Call', value: 'call' },
          { label: 'Proposal sent', value: 'proposal-sent' },
          { label: 'Other', value: 'other' },
        ],
        admin: { width: '34%', description: 'Sets the follow-up date, by the gaps in Settings (2, 5, then 10 working days unless changed).' },
      },
      {
        name: 'direction',
        label: 'Which way',
        type: 'select',
        options: [
          { label: 'Out', value: 'out' },
          { label: 'In', value: 'in' },
        ],
        admin: { width: '33%' },
      },
      {
        name: 'by',
        label: 'By',
        type: 'relationship',
        relationTo: 'users',
        admin: { width: '33%', readOnly: true },
      },
    ],
  },
  {
    name: 'recordedAt',
    type: 'date',
    admin: { hidden: true },
  },
]
