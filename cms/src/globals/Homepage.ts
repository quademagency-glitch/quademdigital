import type { GlobalConfig } from 'payload'

export const Homepage: GlobalConfig = {
  slug: 'homepage',
  label: 'Homepage Content',
  admin: { group: 'Pages' },
  access: {
    read: () => true,
  },
  fields: [
    // ── Hero ──────────────────────────────────────────────────────────────
    { name: 'heroPresentation', label: 'Main hero', type: 'group', fields: [
      { name: 'heading', label: 'Headline, first line', type: 'text', defaultValue: 'Make your business' },
      { name: 'accent', label: 'Headline, italic line', type: 'text', defaultValue: 'the clear choice.' },
      { name: 'body', label: 'Supporting text', type: 'textarea', defaultValue: 'A sharper brand. A better website. A clearer path from first impression to enquiry.' },
      { name: 'note', label: 'Note below the buttons', type: 'text', admin: { description: 'Leave blank to use the founder name from About.' } },
      { name: 'image', label: 'Hero image', type: 'upload', relationTo: 'media', admin: { description: 'Leave empty to use the cinematic studio image. Add the appropriate caption and credit when replacing it.' } },
      { name: 'caption', label: 'Image caption', type: 'text' },
      { name: 'credit', label: 'Image credit or qualification', type: 'text' },
    ] },
    { name: 'heroHeadline', label: 'Introduction headline below the hero', type: 'text', admin: { description: 'The | character is replaced by the Introduction words below.' } },
    { name: 'heroTagline', label: 'Business summary for search engines', type: 'text', admin: { description: 'Used in the homepage business structured data.' } },
    { name: 'heroSubheadline', label: 'Introduction supporting text', type: 'textarea', admin: { description: 'Shown beneath the introduction headline, below the hero.' } },
    {
      name: 'heroEyebrow',
      label: 'Hero Eyebrow',
      type: 'text',
      admin: {
        description:
          'Small label above the main hero headline. Leave blank for the studio default.',
      },
    },
    {
      name: 'heroMetaLabels',
      label: 'Hero Meta Line',
      type: 'text',
      admin: {
        description:
          'Up to four short labels separated by commas. Shown at the foot of the main hero. Leave blank for the studio and location defaults.',
      },
    },
    {
      name: 'primaryCta',
      label: 'Primary CTA',
      type: 'group',
      fields: [
        { name: 'label', label: 'Button Label', type: 'text', defaultValue: 'Get a Free Audit' },
        { name: 'link', label: 'Link', type: 'text', defaultValue: '#contact' },
      ],
    },
    {
      name: 'secondaryCta',
      label: 'Secondary CTA',
      type: 'group',
      fields: [
        { name: 'label', label: 'Button Label', type: 'text', defaultValue: 'View Our Work' },
        { name: 'link', label: 'Link', type: 'text', defaultValue: '#work' },
      ],
    },
    {
      name: 'heroServices',
      label: 'Introduction words',
      type: 'array',
      admin: {
        description:
          'Inserted, separated by commas, at the | in the introduction headline below the main hero.',
      },
      fields: [
        { name: 'service', label: 'Highlighted Word', type: 'text' },
        /*
          Everything below is kept, hidden, and read by nothing.
          The hero used to pair each word with a picture or a video in a
          carousel, and that carousel is gone. The columns stay because
          dropping them is a one way door: `rawMedia` and `mockupMedia` are
          foreign keys into `media`, so a DROP would make those uploads look
          orphaned in the media library, and no `down()` could put the
          relationships back. Nothing is gained by removing three columns
          nothing reads.

          `prefix` has never done anything at all. The site's mapper returned
          `{ service, suffix, ... }` and never read `prefix`, so the "Words
          Before" box in the admin has always been inert. It is hidden here for
          the same reason as the rest rather than singled out.
        */
        { name: 'prefix', label: 'Words Before (Optional)', type: 'text', admin: { hidden: true } },
        { name: 'suffix', label: 'Words After (Optional)', type: 'text', admin: { hidden: true } },
        { name: 'rawMedia', label: 'Service Media (Image/Video)', type: 'upload', relationTo: 'media', admin: { hidden: true } },
        { name: 'mockupMedia', label: 'Mockup Image', type: 'upload', relationTo: 'media', admin: { hidden: true } },
        { name: 'mockupStatus', label: 'Mockup Status', type: 'select', defaultValue: 'pending', admin: { hidden: true }, options: [
          { label: 'Pending', value: 'pending' },
          { label: 'Processing', value: 'processing' },
          { label: 'Ready', value: 'ready' },
          { label: 'Failed', value: 'failed' },
        ] },
      ],
    },

    // ── Trust Highlights (replaces stats when showStats is off) ───────────
    {
      name: 'showStats',
      label: 'Show Stats Counter Block',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Only enable once the Stats collection has real, verified numbers.' },
    },
    {
      name: 'trustHighlights',
      label: 'Trust Highlights',
      type: 'array',
      maxRows: 4,
      admin: { description: '3–4 short value cards shown in place of the stats counter. E.g. "Direct Founder Access / Built for Ghana / Results-Focused".' },
      fields: [
        { name: 'icon', label: 'Icon (emoji or SVG name)', type: 'text' },
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'description', label: 'Description', type: 'textarea', required: true },
      ],
    },

    // ── Risk Reversal Block ───────────────────────────────────────────────
    {
      name: 'riskReversal',
      label: 'Risk Reversal Block',
      type: 'group',
      admin: {
        description:
          'The strip under the hero. It removes the buyer\'s risk: say what they get and what protects them. Do NOT frame it around being new or unproven ("we\'re early", "bet on our hunger"): that reads as inexperience and costs conversions. State the guarantee with confidence instead.',
      },
      fields: [
        {
          name: 'enabled',
          label: 'Enabled',
          type: 'checkbox',
          defaultValue: true,
        },
        { name: 'heading', label: 'Heading', type: 'text', defaultValue: 'Your project, without the risk.' },
        {
          name: 'body',
          label: 'Body',
          type: 'textarea',
          defaultValue:
            'Know your exact price and timeline before we start. You pay in milestones, see progress every week, and we refine until you sign off.',
        },
      ],
    },

    /*
      The service cards down the homepage. Each one is a badge, a
      two-part heading, a paragraph and a button; the illustration beside it is
      artwork rather than content, so `visual` picks which work image family is shown
      and its colours come with it.

      Reordering the rows reorders the cards. Removing a row removes the card.
      Before this they were four hardcoded components and the copy could only
      be changed with a deploy.
    */
    {
      name: 'promoSections',
      label: 'Service Promo Cards',
      type: 'array',
      admin: {
        description:
          'The service cards down the homepage. Drag to reorder. Leave empty to show the Services collection instead.',
        components: {
          RowLabel: './components/PromoRowLabel#PromoRowLabel',
        },
      },
      fields: [
        {
          name: 'visual',
          label: 'Artwork',
          type: 'select',
          required: true,
          defaultValue: 'video',
          options: [
            { label: 'Video portfolio frames', value: 'video' },
            { label: 'Website presentation', value: 'webDesign' },
            { label: 'Brand identity presentation', value: 'brandIdentity' },
            { label: 'Search research', value: 'seo' },
            { label: 'Automation demo', value: 'aiAutomation' },
            { label: 'Fieldwork delivery evidence', value: 'fieldwork' },
            { label: 'Campaign portfolio frames', value: 'digitalMarketing' },
          ],
          admin: {
            description:
              'The work image family shown above these words. Source captions stay with the image.',
          },
        },
        {
          name: 'badge',
          label: 'Small label above the heading',
          type: 'text',
          admin: { description: 'For example: Core Service. Leave empty for no label.' },
        },
        { name: 'heading', label: 'Heading', type: 'text', required: true },
        {
          name: 'headingAccent',
          label: 'Heading, coloured ending',
          type: 'text',
          admin: {
            description:
              'Added to the end of the card heading. Leave empty for a plain heading.',
          },
        },
        { name: 'body', label: 'Paragraph', type: 'textarea', required: true },
        {
          name: 'ctaLabel',
          label: 'Button label',
          type: 'text',
          admin: { description: 'The arrow is added for you. Leave empty for no button.' },
        },
        {
          name: 'ctaUrl',
          label: 'Button link',
          type: 'text',
          admin: { description: 'For example /services/web-design/ .' },
        },
      ],
    },

    // ── Founder Section ───────────────────────────────────────────────────
    { name: 'founderTitle', label: 'Founder Section Title', type: 'text' },
    {
      name: 'founderText',
      label: 'Founder Section Text (Paragraphs)',
      type: 'array',
      fields: [{ name: 'paragraph', type: 'textarea' }],
    },
    { name: 'founderImage', label: 'Founder Image', type: 'upload', relationTo: 'media' },
    { name: 'newsletterHeading', label: 'Newsletter Heading', type: 'text' },
    { name: 'newsletterSubheading', label: 'Newsletter Subheading', type: 'text' },
    { name: 'contactHeading', label: 'Contact Section Heading', type: 'text', defaultValue: "Let's build something great" },
    {
      name: 'contactSubheading',
      label: 'Contact Section Subheading',
      type: 'text',
      defaultValue: 'Fill out the form below or chat directly with us on WhatsApp to get started.',
    },
    { name: 'contactInfoTitle', label: 'Contact Info Title', type: 'text', defaultValue: 'Get in Touch' },
    {
      name: 'contactInfoText',
      label: 'Contact Info Text',
      type: 'textarea',
      defaultValue: "We're ready to help you scale your business. Reach out today and let's start the conversation.",
    },
    { name: 'contactWhatsappButtonText', label: 'WhatsApp Button Text', type: 'text', defaultValue: 'Chat on WhatsApp' },
    { name: 'contactSubmitButtonText', label: 'Submit Button Text', type: 'text', defaultValue: 'Send Message' },
    {
      name: 'contactFormSuccessMessage',
      label: 'Form Success Message',
      type: 'text',
      defaultValue: "Thanks for reaching out! We'll be in touch shortly.",
    },
  ],
}
