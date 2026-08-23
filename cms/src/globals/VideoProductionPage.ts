import type { GlobalConfig } from 'payload'

// Editing a `defaultValue` here does NOT change the live page: Payload only
// applies defaults when a document is first created, and this one was created
// long ago. To change what visitors see, run `scripts/repoint-video-to-ai.ts`
// against production. These defaults are kept honest so a fresh environment
// seeds with the right copy.
export const VideoProductionPage: GlobalConfig = {
  slug: 'videoProductionPage',
  admin: { group: 'Pages' },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'hero',
      type: 'group',
      fields: [
        { name: 'badge', type: 'text', defaultValue: '✨ AI Video & Reels' },
        { name: 'headline', type: 'text', defaultValue: 'AI Video & Reels that keep your brand posting, with no shoot day' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Every reel is built with AI from your logo, your products and your offer. No camera, no crew, nothing for you to organise. You approve the script, we deliver video you can post the same week.' },
        { name: 'primaryCtaText', type: 'text', defaultValue: 'Get a Free Quote', admin: { description: 'Links to /contact/. Only the wording is editable here.' } },
        { name: 'secondaryCtaText', type: 'text', defaultValue: 'View Pricing ↓', admin: { description: 'Scrolls to the pricing section on this page.' } },
        { name: 'media', type: 'upload', relationTo: 'media', admin: { description: 'Hero image or video' } },
      ],
    },
    {
      name: 'servicesSection',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'What we make' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Short-form video for the places your customers actually scroll.' },
        {
          name: 'services',
          type: 'array',
          fields: [
            { name: 'title', type: 'text' },
            { name: 'description', type: 'textarea' },
            { name: 'iconSvg', type: 'textarea', admin: { description: 'Paste SVG code here' } },
          ],
        },
      ],
    },
    {
      name: 'showreel',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'Our Showreel' },
        { name: 'subtitle', type: 'textarea', defaultValue: "A few of the reels we've made recently." },
        {
          name: 'videoFile',
          label: 'Upload a showreel',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description:
              'Upload the reel itself. It is optimised automatically after upload and plays from this site, so nothing sends your visitors to YouTube. Set the media item to "Plays with sound" if it has audio. Leave this empty to embed a YouTube or Vimeo link below instead.',
          },
        },
        {
          name: 'videoUrl',
          label: 'Or embed a YouTube / Vimeo URL',
          type: 'text',
          admin: {
            description: 'Only used when no showreel is uploaded above.',
          },
        },
        { name: 'isComingSoon', type: 'checkbox', defaultValue: true },
      ],
    },
    {
      name: 'portfolioGallery',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'Our Work Gallery' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Recent AI video and reels. Upload the reels themselves, not stills of them.' },
        {
          name: 'images',
          label: 'Gallery items',
          type: 'array',
          admin: {
            description:
              'Each item can be a still or a video. This page sells video, so a reel that plays says more than a frame of one.',
          },
          fields: [
            {
              name: 'image',
              label: 'Image or video',
              type: 'upload',
              relationTo: 'media',
              required: true,
              admin: {
                description:
                  'A video is transcoded automatically after upload and shows a poster frame until it is on screen, so it costs a visitor nothing until they scroll to it. Leave the media item on "Background loop" for a silent reel that plays by itself; set it to "Plays with sound" and it gets play controls here instead.',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'processSection',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'How it works' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'Four steps, no shoot day, and nothing goes out without your sign-off.' },
        {
          name: 'steps',
          type: 'array',
          fields: [
            { name: 'number', type: 'text', admin: { description: 'e.g. 01' } },
            { name: 'title', type: 'text' },
            { name: 'description', type: 'textarea' },
          ],
        },
      ],
    },
    {
      name: 'pricingSection',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'AI Video & Reels pricing' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'One batch to try it, or a monthly plan that keeps you posting. Prices in Ghana Cedis, MoMo and bank transfer accepted.' },
        { name: 'note', type: 'textarea', defaultValue: '* One-off packs are billed up front. Monthly plans are billed monthly and you can cancel anytime. Add-ons: paid-ad management (10 to 15% of ad spend) and one-off launch campaigns.' },
        {
          name: 'plans',
          type: 'array',
          fields: [
            { name: 'name', type: 'text', required: true },
            { name: 'price', type: 'text', required: true },
            { name: 'period', type: 'text' },
            { name: 'description', type: 'textarea' },
            { name: 'isPopular', type: 'checkbox', defaultValue: false },
            {
              name: 'features',
              type: 'array',
              fields: [
                { name: 'feature', type: 'text' },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'faqSection',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'Frequently Asked Questions' },
        { name: 'subtitle', type: 'textarea', defaultValue: 'The questions people actually ask before buying AI video.' },
        {
          name: 'faqs',
          type: 'array',
          fields: [
            { name: 'question', type: 'text', required: true },
            { name: 'answer', type: 'textarea', required: true },
          ],
        },
      ],
    },
    {
      name: 'ctaSection',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'Ready to stop going quiet?' },
        { name: 'subtitle', type: 'textarea', defaultValue: "Book a free 15-minute call. We'll show you exactly what your first three reels would look like, before you pay anything." },
        { name: 'primaryButtonText', type: 'text', defaultValue: 'Book a Free Consultation', admin: { description: 'Links to /contact/.' } },
        { name: 'whatsappButtonText', type: 'text', defaultValue: '💬 Chat on WhatsApp', admin: { description: 'Opens WhatsApp with a message about AI Video and Reels.' } },
      ],
    },
  ],
}
