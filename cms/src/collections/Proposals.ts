import type { CollectionConfig } from 'payload'
import { SERVICE_OPTIONS, OWNER_OPTIONS, STAGE_OPTIONS } from './JourneyTemplates'
import { parseProposal } from '../utils/proposalParser'
import { provisionFromProposal } from '../utils/provisionFromProposal'

/*
  Upload the proposal, get the client.

  The other way in. A client can still be typed in by hand, and a won lead still
  converts itself (hooks/convertWonLeadToClient.ts), but the document that
  actually decided the job already contains every fact those two ask for, so
  this reads it and fills the form in.

  TWO STEPS, AND THE SECOND ONE IS A PERSON

  Uploading parses. Parsing writes nothing but fields on this record, all of
  them editable. Nothing exists yet: no client, no invoice, no email.

  Pressing "Create everything" provisions: it creates the client as won, which
  fires the automation that writes the contract and the welcome pack and
  schedules the four emails, drafts an unsent invoice, and copies the matching
  journey template onto the client as dated steps. That order is deliberate and
  it is the only thing that sends anything.

  The split exists because the first step is a language model reading a PDF and
  the second step spends money and emails a client. A wrong number that sits in
  a field is a typo; the same number in an invoice is a wrong invoice.
*/

export const Proposals: CollectionConfig = {
  slug: 'proposals',
  labels: { singular: 'Proposal', plural: 'Proposals' },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'clientName',
    defaultColumns: ['clientName', 'service', 'total', 'status', 'createdAt'],
    description:
      'Drop in the proposal PDF. It reads the client, the scope and the prices out of it, you check them, and one button creates the client, the invoice and the journey.',
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  upload: {
    staticDir: 'media/proposals',
    /* PDF only. Word is not accepted because a proposal is sent as a PDF and
       accepting both doubles the parsing paths for a format nobody sends. */
    mimeTypes: ['application/pdf'],
  },
  endpoints: [
    {
      path: '/:id/provision',
      method: 'post',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'Unauthorised' }, { status: 401 })

        const id = (req.routeParams as { id?: string })?.id
        if (!id) return Response.json({ error: 'Missing proposal id' }, { status: 400 })

        try {
          const result = await provisionFromProposal(id, req.payload, req)
          return Response.json(result, { status: result.ok ? 200 : 400 })
        } catch (err: any) {
          req.payload.logger.error({ err }, '[proposals] provisioning failed')
          return Response.json(
            { ok: false, error: err?.message || 'Provisioning failed.' },
            { status: 500 },
          )
        }
      },
    },
  ],
  fields: [
    {
      name: 'review',
      type: 'ui',
      admin: {
        components: { Field: './components/ProposalReview#ProposalReview' },
      },
    },

    /* ── What the PDF said, all editable ─────────────────────────────────── */
    {
      type: 'row',
      fields: [
        { name: 'clientName', label: 'Business / Client Name', type: 'text' },
        { name: 'contactName', label: 'Contact Person', type: 'text' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'clientEmail', label: 'Email Address', type: 'email' },
        { name: 'phone', label: 'WhatsApp / Phone', type: 'text' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'country',
          label: 'Country (2-letter code)',
          type: 'text',
          maxLength: 2,
          admin: {
            placeholder: 'GH',
            description: 'Decides the currency on their invoices. Blank means dollars.',
          },
          hooks: {
            beforeChange: [({ value }) => (value ? String(value).trim().toUpperCase().slice(0, 2) : value)],
          },
          validate: (value: unknown) =>
            !value || /^[A-Za-z]{2}$/.test(String(value)) ? true : 'Use the two-letter country code, e.g. GH or NG.',
        },
        { name: 'service', label: 'Service', type: 'select', options: SERVICE_OPTIONS },
        { name: 'packageName', label: 'Package / Plan Name', type: 'text' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'currency',
          label: 'Currency',
          type: 'text',
          admin: { placeholder: 'GHS', description: 'What the proposal quoted. Blank takes it from the country.' },
          validate: (value: unknown) => {
            if (!value) return true
            const supported = ['GHS', 'USD', 'NGN', 'ZAR', 'KES', 'EUR', 'GBP']
            return supported.includes(String(value).toUpperCase())
              ? true
              : `Currency must be one of: ${supported.join(', ')}`
          },
          hooks: { beforeChange: [({ value }) => (value ? String(value).trim().toUpperCase() : value)] },
        },
        { name: 'total', label: 'Total', type: 'number', min: 0 },
        {
          name: 'recurring',
          label: 'Charged monthly',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Tick if the total above is a monthly fee rather than a one-off.' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'depositPercent',
          label: 'Deposit (%)',
          type: 'number',
          min: 0,
          max: 100,
          admin: { description: 'Carried onto the invoice, so the client can pay half now.' },
        },
        {
          name: 'startDate',
          label: 'Start Date',
          type: 'date',
          admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } },
        },
        { name: 'durationMonths', label: 'Duration (months)', type: 'number', min: 1 },
      ],
    },
    { name: 'paymentTerms', label: 'Payment Terms', type: 'text' },
    { name: 'specialTerms', label: 'Special Terms', type: 'textarea', admin: { rows: 2 } },
    {
      name: 'summary',
      label: 'What this job is',
      type: 'textarea',
      admin: { rows: 2, description: 'Lands in the client\'s internal notes.' },
    },
    {
      name: 'deliverables',
      label: 'Deliverables',
      type: 'array',
      labels: { singular: 'Deliverable', plural: 'Deliverables' },
      admin: { description: 'Appended to the contract as the custom deliverables list.' },
      fields: [{ name: 'item', type: 'text', required: true }],
    },
    {
      name: 'lineItems',
      label: 'Invoice Line Items',
      type: 'array',
      labels: { singular: 'Line', plural: 'Lines' },
      admin: {
        description:
          'What the invoice will say. Leave empty and it becomes a single line for the total above.',
      },
      fields: [
        { name: 'description', type: 'text', required: true },
        {
          type: 'row',
          fields: [
            { name: 'quantity', type: 'number', required: true, defaultValue: 1, min: 1 },
            { name: 'rate', label: 'Rate', type: 'number', required: true, min: 0 },
          ],
        },
      ],
    },
    /*
      The journey for this client, written from this proposal.

      A template per service was the first version and it was the wrong unit: two
      web design jobs sold on the same page can differ by a content migration, a
      photoshoot and three weeks of scope, and a template flattens all of that
      into the same five steps. So the steps are drafted from the proposal's own
      deliverables and dates, and they sit here, editable, before anything is
      created.

      The template relationship below is the fallback and nothing more: it is
      used only when this list is empty, which happens when the PDF could not be
      read at all.
    */
    {
      name: 'journeySteps',
      label: 'Journey for this client',
      type: 'array',
      labels: { singular: 'Step', plural: 'Steps' },
      admin: {
        description:
          'Drafted from the proposal. Edit, reorder or delete before creating the client, because these become the client\'s real steps.',
        initCollapsed: true,
      },
      fields: [
        { name: 'title', label: 'Step', type: 'text', required: true },
        { name: 'detail', label: 'What it involves', type: 'textarea', admin: { rows: 2 } },
        {
          type: 'row',
          fields: [
            {
              name: 'owner',
              label: 'Who does it',
              type: 'select',
              defaultValue: 'quadem',
              options: OWNER_OPTIONS,
              admin: { width: '33%' },
            },
            {
              name: 'stage',
              label: 'Stage',
              type: 'select',
              defaultValue: 'onboarding',
              options: STAGE_OPTIONS,
              admin: { width: '33%' },
            },
            {
              name: 'dueOffsetDays',
              label: 'Due (days from start)',
              type: 'number',
              defaultValue: 0,
              min: 0,
              admin: { width: '33%' },
            },
          ],
        },
        { name: 'clientVisible', label: 'Show this step to the client', type: 'checkbox', defaultValue: true },
      ],
    },
    {
      name: 'journeyTemplate',
      label: 'Fallback journey template',
      type: 'relationship',
      relationTo: 'journey-templates',
      admin: {
        description:
          'Only used if the steps above are empty, which means the PDF could not be read. Left blank, the template matching the service is used, or the one marked as the fallback.',
      },
    },

    /* ── Machine-managed ─────────────────────────────────────────────────── */
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      defaultValue: 'parsing',
      options: [
        { label: 'Reading the PDF', value: 'parsing' },
        { label: 'Needs review', value: 'needs-review' },
        { label: 'Client created', value: 'provisioned' },
        { label: 'Could not be read', value: 'failed' },
      ],
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'parsedAt',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'parseError',
      label: 'What went wrong',
      type: 'textarea',
      admin: {
        position: 'sidebar',
        readOnly: true,
        rows: 4,
        condition: (data) => Boolean(data?.parseError),
      },
    },
    {
      name: 'client',
      label: 'Client created',
      type: 'relationship',
      relationTo: 'clients',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'invoice',
      label: 'Invoice drafted',
      type: 'relationship',
      relationTo: 'invoices',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'provisionedAt',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'provisionLog',
      label: 'What was created',
      type: 'textarea',
      admin: {
        readOnly: true,
        rows: 5,
        condition: (data) => Boolean(data?.provisionLog),
      },
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, req, operation, context }) => {
        /* Only a fresh upload is read, and never the parser's own write back or
           the provisioning update, both of which are updates and both of which
           say so in context. Without that guard the parse would re-enter itself
           and the model would be called on every save. */
        if (operation !== 'create') return doc
        if (context?.fromParser || context?.fromProvisioning) return doc

        parseProposal(doc, req.payload, req.file?.data).catch((err) => {
          req.payload.logger.error({ err }, `[proposals] parse failed for ${doc.id}`)
        })
        return doc
      },
    ],
  },
}
