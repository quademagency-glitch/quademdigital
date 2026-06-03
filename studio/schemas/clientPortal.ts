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
            name: 'deliverables',
            title: 'Deliverables & Links',
            type: 'array',
            of: [
                {
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title (e.g. Invoice, Figma File)', type: 'string' },
                        { name: 'url', title: 'URL', type: 'url' },
                    ]
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
