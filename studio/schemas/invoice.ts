import { defineField, defineType } from 'sanity';

export default defineType({
    name: 'invoice',
    title: 'Invoices',
    type: 'document',
    fields: [
        defineField({
            name: 'invoiceId',
            title: 'Invoice Number',
            type: 'string',
            validation: Rule => Rule.required(),
            description: 'E.g., INV-2026-042',
        }),
        defineField({
            name: 'client',
            title: 'Client Portal',
            type: 'reference',
            to: [{ type: 'clientPortal' }],
            validation: Rule => Rule.required(),
            description: 'Link this invoice to a specific client portal.',
        }),
        defineField({
            name: 'dateIssued',
            title: 'Date Issued',
            type: 'date',
            validation: Rule => Rule.required(),
        }),
        defineField({
            name: 'dueDate',
            title: 'Due Date',
            type: 'date',
            validation: Rule => Rule.required(),
        }),
        defineField({
            name: 'status',
            title: 'Status',
            type: 'string',
            options: {
                list: [
                    { title: 'Pending', value: 'PENDING' },
                    { title: 'Paid', value: 'PAID' },
                    { title: 'Overdue', value: 'OVERDUE' },
                    { title: 'Cancelled', value: 'CANCELLED' },
                ],
            },
            initialValue: 'PENDING',
            validation: Rule => Rule.required(),
        }),
        defineField({
            name: 'currency',
            title: 'Currency',
            type: 'string',
            options: {
                list: [
                    { title: 'USD ($)', value: 'USD' },
                    { title: 'GHS (GH₵)', value: 'GHS' },
                    { title: 'EUR (€)', value: 'EUR' },
                    { title: 'GBP (£)', value: 'GBP' },
                ],
            },
            initialValue: 'USD',
            validation: Rule => Rule.required(),
        }),
        defineField({
            name: 'taxRate',
            title: 'Tax Rate (%)',
            type: 'number',
            description: 'Enter as a percentage (e.g., 5 for 5%). Leave 0 for no tax.',
            initialValue: 0,
        }),
        defineField({
            name: 'items',
            title: 'Line Items',
            type: 'array',
            of: [
                {
                    type: 'object',
                    fields: [
                        { name: 'description', title: 'Description', type: 'string', validation: Rule => Rule.required() },
                        { name: 'rate', title: 'Rate / Price', type: 'number', validation: Rule => Rule.required().positive() },
                        { name: 'quantity', title: 'Quantity', type: 'number', initialValue: 1, validation: Rule => Rule.required().positive() },
                    ],
                    preview: {
                        select: {
                            title: 'description',
                            rate: 'rate',
                            qty: 'quantity'
                        },
                        prepare(selection: any) {
                            const { title, rate, qty } = selection;
                            return {
                                title: title,
                                subtitle: `${qty} x ${rate} = ${qty * rate}`
                            }
                        }
                    }
                }
            ],
            validation: Rule => Rule.required().min(1),
        }),
        defineField({
            name: 'notes',
            title: 'Notes / Payment Instructions',
            type: 'text',
            description: 'Optional notes or specific payment instructions for this invoice.',
        }),
    ],
    preview: {
        select: {
            title: 'invoiceId',
            clientName: 'client.clientName',
            status: 'status',
        },
        prepare(selection: any) {
            const { title, clientName, status } = selection;
            return {
                title: `${title} - ${clientName}`,
                subtitle: `Status: ${status}`
            }
        }
    },
});
