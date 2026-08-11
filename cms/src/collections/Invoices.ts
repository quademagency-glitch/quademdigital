import type { CollectionConfig } from 'payload'

export const Invoices: CollectionConfig = {
  slug: 'invoices',
  labels: { singular: 'Invoice', plural: 'Invoices' },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'invoiceId',
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
  fields: [
    { name: 'invoiceId', label: 'Invoice ID', type: 'text', required: true, unique: true },
    { name: 'client', label: 'Client', type: 'relationship', relationTo: 'clients', required: true },
    { name: 'dateIssued', label: 'Date Issued', type: 'date', defaultValue: () => new Date().toISOString() },
    { name: 'dueDate', label: 'Due Date', type: 'date' },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Overdue', value: 'overdue' }
      ]
    },
    {
      name: 'currency',
      label: 'Currency',
      type: 'text',
      defaultValue: 'USD',
      // Kept as text (not a select) so no Postgres enum type is involved.
      // Validated because Paystack matches the currency case-sensitively and
      // settlement refuses to mark an invoice paid on a mismatch.
      validate: (value: unknown) => {
        if (!value) return true
        const supported = ['GHS', 'USD', 'NGN', 'ZAR', 'KES', 'EUR', 'GBP']
        return supported.includes(String(value).toUpperCase())
          ? true
          : `Currency must be one of: ${supported.join(', ')}`
      },
      hooks: {
        beforeChange: [({ value }) => (value ? String(value).trim().toUpperCase() : 'USD')],
      },
    },
    { name: 'taxRate', label: 'Tax Rate (%)', type: 'number', defaultValue: 0 },
    {
      name: 'items',
      label: 'Line Items',
      type: 'array',
      fields: [
        { name: 'description', label: 'Description', type: 'text', required: true },
        { name: 'quantity', label: 'Quantity', type: 'number', required: true, defaultValue: 1 },
        { name: 'rate', label: 'Rate (Amount)', type: 'number', required: true }
      ]
    },

    /* ── Payment + access, all machine-managed ──────────────────────────────
       These are written by the settlement path and the invoice link builder,
       never by hand. See migration 20260811_000000_add_invoice_payment_fields. */
    {
      name: 'accessToken',
      label: 'Access Token',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Auto-generated. Forms part of the invoice link; without it the page 404s.',
      },
      hooks: {
        beforeChange: [({ value }) => value || `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')],
      },
    },
    {
      name: 'tokenIssuedAt',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar', hidden: true },
    },
    {
      name: 'amountMinor',
      label: 'Amount (minor units)',
      type: 'number',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description:
          'Authoritative total in minor units (e.g. pesewas). Recomputed on save; settlement compares Paystack against this, never against a figure from the browser.',
      },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            const items = (siblingData?.items ?? []) as { rate?: number; quantity?: number }[]
            const subtotal = items.reduce(
              (acc, i) => acc + Number(i?.rate ?? 0) * Number(i?.quantity ?? 0),
              0,
            )
            const total = subtotal * (1 + Number(siblingData?.taxRate ?? 0) / 100)
            return Math.round(total * 100)
          },
        ],
      },
    },
    { name: 'paidAt', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
    {
      name: 'paystackReference',
      label: 'Paystack Reference',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Idempotency key. A reference can settle exactly one invoice, once.',
      },
    },
    {
      name: 'paystackAmountMinor',
      type: 'number',
      admin: { readOnly: true, position: 'sidebar', description: 'What Paystack actually collected.' },
    },
    { name: 'paystackStatus', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
  ]
}
