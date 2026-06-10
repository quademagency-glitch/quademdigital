export default {
    name: 'offer',
    title: 'Offers',
    type: 'document',
    fields: [
        {
            name: 'title',
            title: 'Offer Title',
            type: 'string',
            validation: (Rule: any) => Rule.required(),
        },
        {
            name: 'slug',
            title: 'Slug',
            type: 'slug',
            options: {
                source: 'title',
                maxLength: 96,
            },
            validation: (Rule: any) => Rule.required(),
        },
        {
            name: 'description',
            title: 'Description',
            type: 'text',
            rows: 3,
            validation: (Rule: any) => Rule.required(),
        },
        {
            name: 'image',
            title: 'Cover Image',
            type: 'image',
            options: {
                hotspot: true,
            },
        },
        {
            name: 'cta',
            title: 'Call to Action Button Text',
            type: 'string',
            initialValue: 'Claim Offer',
        },
        {
            name: 'publishedAt',
            title: 'Published at',
            type: 'datetime',
            initialValue: () => new Date().toISOString()
        }
    ],
    preview: {
        select: {
            title: 'title',
            media: 'image',
        },
    },
};
