import type { CollectionConfig } from 'payload'

export const Invoices: CollectionConfig = {
  slug: 'invoices',
  labels: { singular: 'Invoice', plural: 'Invoices' },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'invoiceId',
    components: {
      edit: {
        SaveButton: '../components/RedirectAfterSave#SaveAndRedirectButton',
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
    { name: 'currency', label: 'Currency', type: 'text', defaultValue: 'USD' },
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
    }
  ]
}
