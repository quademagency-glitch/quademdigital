import { defineField, defineType } from 'sanity';

export default defineType({
    name: 'clientPortal',
    title: 'Client Portals',
    type: 'document',
    fields: [
        defineField({
            name: 'clientName',
            title: 'Client Name',
            type: 'string',
            validation: Rule => Rule.required(),
        }),
        defineField({
            name: 'clientEmail',
            title: 'Client Email Address',
            type: 'string',
            validation: Rule => Rule.required().email(),
            description: 'The email address to send the secure access code to.',
        }),
        defineField({
            name: 'projectName',
            title: 'Project Name',
            type: 'string',
            description: 'The name of the project (e.g. "Website Redesign", "Brand Identity Package").',
        }),
        defineField({
            name: 'slug',
            title: 'Slug (Unique ID)',
            type: 'slug',
            options: {
                source: 'clientName',
                maxLength: 96,
            },
            validation: Rule => Rule.required(),
            description: 'Used internally to identify the client.',
        }),
        defineField({
            name: 'accessCode',
            title: 'Access Code (Password)',
            type: 'string',
            validation: Rule => Rule.required(),
            description: 'The secret code the client uses to log in.',
        }),
        defineField({
            name: 'projectStatus',
            title: 'Current Project Status',
            type: 'string',
            options: {
                list: [
                    { title: 'Onboarding', value: 'onboarding' },
                    { title: 'In Progress - Design', value: 'design' },
                    { title: 'In Progress - Development', value: 'development' },
                    { title: 'In Review', value: 'review' },
                    { title: 'Completed', value: 'completed' },
                    { title: 'Maintenance / Retainer', value: 'retainer' },
                ],
            },
            validation: Rule => Rule.required(),
        }),
        defineField({
            name: 'welcomeMessage',
            title: 'Welcome Message',
            type: 'text',
            description: 'A personalized message displayed on the client dashboard.',
        }),
        defineField({
            name: 'onboardingGuide',
            title: 'Onboarding Guide',
            type: 'reference',
            to: [{ type: 'onboardingGuide' }],
            description: 'Select an onboarding guide to display to this client.',
        }),
        defineField({
            name: 'timeline',
            title: 'Project Timeline',
            type: 'array',
            description: 'Chronological milestones and updates for the client to track.',
            of: [
                {
                    type: 'object',
                    fields: [
                        { name: 'date', title: 'Date', type: 'date', validation: (Rule: any) => Rule.required() },
                        { name: 'title', title: 'Title', type: 'string', validation: (Rule: any) => Rule.required() },
                        { name: 'description', title: 'Description', type: 'text', rows: 2 },
                    ],
                    preview: {
                        select: { title: 'title', subtitle: 'date' },
                    },
                }
            ]
        }),
        defineField({
            name: 'invoices',
            title: 'Invoices',
            type: 'array',
            description: 'Client invoices with status tracking.',
            of: [
                {
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Invoice Title', type: 'string', validation: (Rule: any) => Rule.required() },
                        { name: 'amountGHS', title: 'Amount (GH₵)', type: 'number', validation: (Rule: any) => Rule.required().positive(), description: 'The invoice amount in Ghana Cedis.' },
                        { name: 'amountUSD', title: 'Amount (USD)', type: 'number', description: 'Optional USD equivalent for international clients. Will be auto-converted to their local currency.' },
                        { name: 'dueDate', title: 'Due Date', type: 'date' },
                        {
                            name: 'status',
                            title: 'Status',
                            type: 'string',
                            options: {
                                list: [
                                    { title: 'Paid', value: 'paid' },
                                    { title: 'Pending', value: 'pending' },
                                    { title: 'Overdue', value: 'overdue' },
                                ],
                            },
                            validation: (Rule: any) => Rule.required(),
                        },
                        { name: 'url', title: 'Invoice Link / Download URL', type: 'url', description: 'Link to the invoice PDF or payment page.' },
                    ],
                    preview: {
                        select: { title: 'title', subtitle: 'status' },
                    },
                }
            ]
        }),
        defineField({
            name: 'deliverables',
            title: 'Deliverables & Links',
            type: 'array',
            of: [
                {
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title (e.g. Invoice, Figma File)', type: 'string' },
                        {
                            name: 'category',
                            title: 'Category',
                            type: 'string',
                            options: {
                                list: [
                                    { title: 'Design Files', value: 'design' },
                                    { title: 'Brand Assets', value: 'brand' },
                                    { title: 'Documents', value: 'documents' },
                                    { title: 'Videos', value: 'videos' },
                                    { title: 'Other', value: 'other' },
                                ],
                            },
                            initialValue: 'other',
                        },
                        { name: 'url', title: 'URL', type: 'url', description: 'Link to an external resource' },
                        { name: 'file', title: 'File Upload', type: 'file', description: 'Upload a file directly (e.g. PDF, video, zip)' },
                    ],
                    preview: {
                        select: { title: 'title', subtitle: 'category' },
                    },
                }
            ]
        }),
    ],
    preview: {
        select: {
            title: 'clientName',
            subtitle: 'projectStatus',
        },
    },
});
