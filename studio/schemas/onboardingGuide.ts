import { defineField, defineType } from 'sanity';

export default defineType({
    name: 'onboardingGuide',
    title: 'Onboarding Guides',
    type: 'document',
    fields: [
        defineField({
            name: 'title',
            title: 'Guide Title',
            type: 'string',
            validation: Rule => Rule.required(),
            description: 'e.g. "Web Development Onboarding", "Brand Strategy Guide"',
        }),
        defineField({
            name: 'description',
            title: 'Short Description',
            type: 'text',
            rows: 2,
            description: 'A brief summary of what this guide covers.',
        }),
        defineField({
            name: 'content',
            title: 'Guide Content',
            type: 'array',
            of: [
                { type: 'block' },
                { type: 'image', options: { hotspot: true } }
            ],
            description: 'The rich text content of the onboarding guide.',
        })
    ],
    preview: {
        select: {
            title: 'title',
            subtitle: 'description',
        }
    }
});
