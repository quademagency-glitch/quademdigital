import type { CollectionConfig } from 'payload'
import { makeSlugHook } from '../hooks/slugify'

export const Services: CollectionConfig = {
  slug: 'services',
  labels: { singular: 'Service', plural: 'Services' },
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    components: {
      edit: {
        SaveButton: './components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
  access: { read: () => true },
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    {
      name: 'slug',
      label: 'Slug',
      type: 'text',
      required: true,
      unique: true,
      hooks: {
        beforeValidate: [makeSlugHook('title')],
      },
    },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'tags', label: 'Tags', type: 'array', fields: [{ name: 'tag', type: 'text' }] },
    { name: 'iconSvg', label: 'Icon SVG', type: 'textarea', admin: { description: 'Raw SVG code for the icon' } },
    { name: 'body', label: 'Body Content', type: 'json' },
    { name: 'order', label: 'Order', type: 'number' },
    { name: 'featuredImage', label: 'Featured Image (for Overview)', type: 'upload', relationTo: 'media' },
    { name: 'rawMedia', label: 'Hero Media (Image)', type: 'upload', relationTo: 'media', admin: { description: 'Image shown on the service page hero.' } },
    { name: 'mockupMedia', label: 'Mockup Image', type: 'upload', relationTo: 'media', admin: { description: 'Optional device-mockup image to show instead of the raw hero media.' } },
    { name: 'mockupStatus', label: 'Mockup Status', type: 'select', defaultValue: 'pending', options: [
      { label: 'Pending', value: 'pending' },
      { label: 'Processing', value: 'processing' },
      { label: 'Ready', value: 'ready' },
      { label: 'Failed', value: 'failed' },
    ] },
    /*
      Prices for the services that are rendered from this collection.

      WHY THIS IS HERE AND NOT IN ANOTHER GLOBAL

      Four services have a hand-built page and a CMS global each, and those
      globals carry the prices. The other three render from this collection
      through src/pages/services/[slug].astro, which had nowhere to read a price
      from, so AI Automation and Digital Marketing showed none at all. Not a
      wrong number: no number, on two of the seven things Quadem sells.

      The alternative was a global per service, which means a bespoke page per
      service. This is one field group that works for every service in the
      collection, present and future.

      THE SHAPE MATCHES THE FOUR GLOBALS ON PURPOSE

      Same field names as WebDesignPage and the rest, so scripts/pricing-audit.mjs
      can read every price on the site the same way, and so a tier can be moved
      between a global and this collection without renaming anything.

      TWO CURRENCIES, AND WHY BOTH ARE TEXT

      `price` is the cedi figure and `priceUsd` is what everyone else sees. They
      are text rather than numbers because the site prints them verbatim, and a
      number type forces render time formatting, which is where rounding creeps
      in. Leave priceUsd empty and that tier asks a visitor outside Ghana to get
      in touch rather than showing them a cedi figure they will misread as
      dollars.

      Ernest's floor, set 2 September 2026: nothing one-off under $3,000. It has
      two deliberate exceptions, both recorded where they live. See
      docs/pricing-audit-2026-09-02.md.
    */
    {
      name: 'pricingSection',
      label: 'Pricing',
      type: 'group',
      admin: {
        description:
          'Leave the tiers empty and the page shows no pricing at all, which is what AI Automation and Digital Marketing did until September 2026. If a service is genuinely quote-only, say so in the note rather than leaving the section blank.',
      },
      fields: [
        { name: 'heading', label: 'Heading', type: 'text' },
        { name: 'subtitle', label: 'Subtitle', type: 'textarea' },
        {
          name: 'note',
          label: 'Note under the tiers',
          type: 'textarea',
          admin: {
            description: 'The line that says a price is a starting point rather than a rate card.',
          },
        },
        {
          name: 'plans',
          label: 'Tiers',
          type: 'array',
          fields: [
            { name: 'name', label: 'Tier name', type: 'text', required: true },
            { name: 'price', label: 'Price (Ghana cedis)', type: 'text', required: true },
            {
              name: 'priceUsd',
              label: 'Price for visitors outside Ghana',
              type: 'text',
              admin: {
                description:
                  'What someone in the UK, the US or the Gulf sees instead of the cedi price. Write it as you want it read, for example "from $3,000". Leave it empty and that tier asks them to get in touch.',
              },
            },
            { name: 'period', label: 'Period', type: 'text', admin: { description: 'For example "a month", "starting at", "per project".' } },
            { name: 'description', label: 'Description', type: 'textarea' },
            { name: 'isPopular', label: 'Highlight this tier', type: 'checkbox', defaultValue: false },
            {
              name: 'features',
              label: 'What is included',
              type: 'array',
              fields: [{ name: 'feature', label: 'Line', type: 'text' }],
            },
          ],
        },
      ],
    },
    /*
      The enquiry form shown on this service's own page.

      Every service page used to send people to /contact/, where the first
      question is "what do you need help with?": a question they had already
      answered by being on the page. This puts the form on the page with that
      step filled in, and swaps it for questions only this service needs.

      The answers land in Leads.metadata, which is a `json` column, so adding a
      question here never needs a migration. Only this schema did.
    */
    {
      name: 'enquiryForm',
      label: 'Enquiry form (on this service page)',
      type: 'group',
      admin: {
        description:
          'Leave the questions empty and the page shows the general form instead: name, email, message and budget. Add questions and they become step one, with the service already filled in.',
      },
      fields: [
        {
          name: 'heading',
          label: 'Form heading',
          type: 'text',
          admin: { description: 'Above the form. For example: Tell me about your website.' },
        },
        {
          name: 'intro',
          label: 'Line under the heading',
          type: 'textarea',
          admin: { description: 'One sentence. What happens after they send it, or what you need from them.' },
        },
        {
          name: 'questionsHeading',
          label: 'Heading for the questions step',
          type: 'text',
          admin: { description: 'Shown above your questions. Defaults to "A few quick questions".' },
        },
        {
          name: 'buttonLabel',
          label: 'Send button wording',
          type: 'text',
          admin: { description: 'Defaults to "Send enquiry".' },
        },
        {
          name: 'questions',
          label: 'Questions',
          type: 'array',
          maxRows: 3,
          admin: {
            description:
              'Three at most, and that is deliberate: this form already asks for a name, an email, a message and a budget. Ask the things you cannot quote without.',
          },
          fields: [
            {
              name: 'label',
              label: 'Question',
              type: 'text',
              required: true,
              admin: { description: 'Ask it the way you would say it out loud. For example: Do you have a website already?' },
            },
            {
              /*
                The stable name this answer is filed under in Leads.metadata.
                Derived from the question, so an editor never types it, and kept
                as its own column so that rewording a question does not orphan
                every answer already collected under the old wording.
              */
              name: 'key',
              label: 'Stored as',
              type: 'text',
              admin: {
                readOnly: true,
                description: 'Filled in from the question. Answers are filed under this name, so it stays put when you reword the question.',
              },
              /*
                Derived from the question on this row.

                Deliberately not makeSlugHook('label'): that reads `data`, which
                for a field inside an array row is the whole service document,
                not the row. It would never find `label`, the key would stay
                empty, and the front end drops questions without a key, so every
                question would silently fail to render.
              */
              hooks: {
                beforeValidate: [
                  ({ value, siblingData }) => {
                    if (value) return value
                    const label = (siblingData as { label?: string } | undefined)?.label
                    if (!label) return value
                    return label
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-+|-+$/g, '')
                      .slice(0, 60)
                  },
                ],
              },
            },
            {
              name: 'inputType',
              label: 'Answer type',
              type: 'select',
              defaultValue: 'choice',
              options: [
                { label: 'Pick one from a list', value: 'choice' },
                { label: 'Short typed answer', value: 'text' },
                { label: 'Long typed answer', value: 'longtext' },
              ],
            },
            {
              name: 'required',
              label: 'Must be answered',
              type: 'checkbox',
              defaultValue: true,
            },
            {
              name: 'placeholder',
              label: 'Placeholder or hint',
              type: 'text',
              admin: {
                description: 'Only used for typed answers.',
                condition: (_: unknown, sibling: any) => sibling?.inputType !== 'choice',
              },
            },
            {
              name: 'choices',
              label: 'The options',
              type: 'array',
              admin: {
                description: 'Only used when the answer is picked from a list.',
                condition: (_: unknown, sibling: any) => sibling?.inputType === 'choice',
              },
              fields: [{ name: 'choice', label: 'Option', type: 'text', required: true }],
            },
          ],
        },
      ],
    },
  ],
}
