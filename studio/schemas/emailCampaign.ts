import { defineField, defineType } from 'sanity';

export default defineType({
    name: 'emailCampaign',
    title: 'Email Campaigns',
    type: 'document',
    icon: () => '📧',
    fields: [
        defineField({
            name: 'subject',
            title: 'Email Subject',
            type: 'string',
            validation: Rule => Rule.required(),
            description: 'The subject line recipients will see in their inbox.',
        }),
        defineField({
            name: 'previewText',
            title: 'Preview Text',
            type: 'string',
            description: 'Short preview text shown next to the subject in most email clients (keep under 90 characters).',
        }),
        defineField({
            name: 'body',
            title: 'Email Body',
            type: 'array',
            of: [
                { type: 'block' },
                {
                    type: 'image',
                    options: { hotspot: true },
                    fields: [
                        {
                            name: 'caption',
                            title: 'Caption',
                            type: 'string',
                        },
                        {
                            name: 'alt',
                            title: 'Alt Text',
                            type: 'string',
                        },
                    ],
                },
            ],
            validation: Rule => Rule.required(),
            description: 'The main content of your email. Use rich text formatting, add images, etc.',
        }),
        defineField({
            name: 'videoUrl',
            title: 'Video URL (YouTube / Vimeo)',
            type: 'url',
            description: 'Optional: Link to a YouTube or Vimeo video. A thumbnail and play link will be included in the email.',
        }),
        defineField({
            name: 'videoFile',
            title: 'Video File Upload',
            type: 'file',
            options: {
                accept: 'video/*',
            },
            description: 'Optional: Upload a video file directly. A download link will be included in the email.',
        }),
        defineField({
            name: 'ctaText',
            title: 'Call-to-Action Button Text',
            type: 'string',
            description: 'Optional: Text for a CTA button (e.g. "Visit Our Website", "Book a Call").',
        }),
        defineField({
            name: 'ctaUrl',
            title: 'Call-to-Action Button URL',
            type: 'url',
            description: 'URL the CTA button links to.',
        }),
        defineField({
            name: 'status',
            title: 'Status',
            type: 'string',
            options: {
                list: [
                    { title: 'Draft', value: 'draft' },
                    { title: 'Sent', value: 'sent' },
                    { title: 'Scheduled', value: 'scheduled' },
                ],
            },
            initialValue: 'draft',
            readOnly: true,
            description: 'Automatically updated when the campaign is sent.',
        }),
        defineField({
            name: 'sentAt',
            title: 'Sent At',
            type: 'datetime',
            readOnly: true,
            description: 'Timestamp of when the campaign was sent.',
        }),
    ],
    orderings: [
        {
            title: 'Created (Newest)',
            name: 'createdDesc',
            by: [{ field: '_createdAt', direction: 'desc' }],
        },
    ],
    preview: {
        select: {
            title: 'subject',
            subtitle: 'status',
        },
        prepare({ title, subtitle }) {
            const statusEmoji = subtitle === 'sent' ? '✅' : subtitle === 'scheduled' ? '⏰' : '📝';
            return {
                title: title,
                subtitle: `${statusEmoji} ${subtitle?.charAt(0).toUpperCase()}${subtitle?.slice(1) || 'Draft'}`,
            };
        },
    },
});
