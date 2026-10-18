import type { CollectionConfig } from 'payload'
import { isAdmin, nobody } from '../access/roles'

/*
  What happened to an invoice once it left (Ernest, 18 October 2026: "in
  sending invoices, we should know how it is done"): each email that carried
  it, with whether the PDF went too; whether that email was delivered, opened
  or bounced (Resend tells the website, src/pages/api/resend-webhook.ts); each
  reminder; each time Ernest shared it on WhatsApp; and each time the client
  opened their link. Payments and receipts are already on their own records,
  and the portal puts all of it on one timeline (portal src/lib/invoice-timeline.ts).

  One row per thing that happened, only ever added. Writing these onto the
  invoice would make a version of it each time and push its real history out
  of the fifty it keeps, and two events for one email arrive at the same
  instant, which a read-change-write on one record would lose. Written only by
  the CMS's own endpoints (lib/invoiceDesk.ts), read only by Ernest.
*/

export const INVOICE_EVENT_KINDS = ['issued', 'emailed', 'resent', 'reminder', 'whatsapp', 'failed', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'viewed'] as const

export const InvoiceEvents: CollectionConfig = {
  slug: 'invoice-events',
  labels: { singular: 'Invoice event', plural: 'Invoice events' },
  admin: { group: 'CRM & Sales', useAsTitle: 'kind', defaultColumns: ['invoice', 'kind', 'to', 'at'], hidden: true },
  access: { read: isAdmin, create: nobody, update: nobody, delete: isAdmin },
  timestamps: true,
  fields: [
    { name: 'invoice', type: 'relationship', relationTo: 'invoices', required: true, index: true },
    { name: 'kind', type: 'select', required: true, index: true, options: INVOICE_EVENT_KINDS.map((k) => ({ label: k, value: k })) },
    { name: 'at', type: 'date', required: true, index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    // Who it went to: an email address, or the number it was shared to on WhatsApp.
    { name: 'to', type: 'text' },
    // Ties an email's delivered and opened to the email that carried the invoice.
    { name: 'sendId', type: 'text', index: true },
    { name: 'pdf', label: 'With the PDF', type: 'checkbox', defaultValue: false },
    { name: 'note', type: 'text' },
  ],
}
