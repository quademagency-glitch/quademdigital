import type { CollectionConfig } from 'payload'
import { OWNER_OPTIONS, STAGE_OPTIONS } from './JourneyTemplates'

/*
  One client's actual steps, copied from a template and owned by them from then
  on.

  A copy rather than a reference on purpose. Editing "Web design build" in six
  months must not rewrite what a client who signed today was told they would
  get, and a client's own journey is edited constantly: a step is dropped, a
  date moves, something is added that was never in any template.

  WHY A COLLECTION AND NOT AN ARRAY ON THE CLIENT

  `clients` is versioned, so an array field there mirrors into `_clients_v` and
  every tick of a checkbox writes a whole new version of the client record. A
  row per step also means the portal can read the client's steps with one
  filtered query, and a step can be found across every client (everything due
  this week, everything waiting on a client) which an array cannot do.
*/

export const ClientJourneySteps: CollectionConfig = {
  slug: 'client-journey-steps',
  labels: { singular: 'Journey Step', plural: 'Client Journey' },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'title',
    defaultColumns: ['title', 'client', 'owner', 'status', 'dueDate'],
    description:
      'Every step of every client journey. Created from a journey template when a proposal is provisioned, and editable per client from then on.',
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'client',
      label: 'Client',
      type: 'relationship',
      relationTo: 'clients',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    { name: 'title', label: 'Step', type: 'text', required: true },
    { name: 'detail', label: 'What it involves', type: 'textarea', admin: { rows: 2 } },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          defaultValue: 'todo',
          options: [
            { label: 'To do', value: 'todo' },
            { label: 'In progress', value: 'in-progress' },
            { label: 'Done', value: 'done' },
            { label: 'Blocked', value: 'blocked' },
          ],
        },
        { name: 'owner', label: 'Who does it', type: 'select', defaultValue: 'quadem', options: OWNER_OPTIONS },
        { name: 'stage', label: 'Stage', type: 'select', defaultValue: 'onboarding', options: STAGE_OPTIONS },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'dueDate',
          label: 'Due',
          type: 'date',
          index: true,
          admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } },
        },
        {
          name: 'completedAt',
          label: 'Completed',
          type: 'date',
          admin: {
            readOnly: true,
            date: { pickerAppearance: 'dayAndTime' },
            description: 'Written when the status is set to done, and cleared if it moves back.',
          },
        },
      ],
    },
    {
      name: 'clientVisible',
      label: 'Show this step to the client',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'order',
      label: 'Order',
      type: 'number',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
        description: 'Position in the journey. Copied from the template, edit to reorder.',
      },
    },
    {
      name: 'sourceTemplate',
      label: 'Came from',
      type: 'relationship',
      relationTo: 'journey-templates',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'The template this step was copied from. Editing that template does not change this step.',
      },
    },
  ],
  hooks: {
    beforeChange: [
      /*
        The completion date follows the status rather than being typed. A step
        marked done with no date is the ordinary case (nobody fills in a second
        field to say "now"), and a date left behind on a step moved back to
        "to do" would report work as finished that is not.
      */
      ({ data, originalDoc }) => {
        if (!data) return data
        const wasDone = originalDoc?.status === 'done'
        const isDone = data.status === 'done'
        if (isDone && !wasDone && !data.completedAt) data.completedAt = new Date().toISOString()
        if (!isDone && data.status) data.completedAt = null
        return data
      },
    ],
  },
}
