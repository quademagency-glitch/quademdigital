import type { Field } from 'payload'
import { EMPTY, area, storyStep, text } from './hero'

/*
  The words of the home page proof section (row D final, 24 October 2026):
  the receipts chat on the phone, in eight steps.

  Every box may be left empty: the site then shows the approved words in
  src/lib/homeD/proof.defaults.json, whose shape this group matches field for
  field. Every number keeps its source and date beside it.

  The client quote comes from the Testimonials collection when a testimonial
  is published there (the one by Emmanuel Korsah first); the quote boxes here
  are only used when none is.
*/

export const dProof: Field = {
  name: 'dProof',
  label: 'Proof section (receipts)',
  type: 'group',
  admin: {
    description:
      'The results section after the hero. Leave any box empty to use the approved words. Only real, measured numbers, each with its source and date.',
  },
  fields: [
    {
      name: 'steps',
      label: 'Story steps',
      type: 'array',
      maxRows: 8,
      admin: { description: 'Eight steps in a fixed order: the opening, the six receipts (score, speed, replies, leads, search, the client quote), then "Your turn".' },
      fields: storyStep('results'),
    },
    {
      name: 'cta',
      label: 'Main button',
      type: 'group',
      fields: [text('label', 'Button words'), text('href', 'Button link', `Leave empty to use the Primary CTA link (the free check-up). ${EMPTY}`)],
    },
    text('trust', 'Small line under the button'),
    {
      name: 'quote',
      label: 'Client quote (used only when no testimonial is published)',
      type: 'group',
      admin: { description: 'Word for word, never corrected. A published testimonial in the Testimonials collection replaces these boxes.' },
      fields: [area('text', 'Quote'), text('name', 'Name'), text('role', 'Role and company')],
    },
    {
      name: 'phone',
      label: 'Messages on the phone',
      type: 'group',
      fields: [
        {
          name: 'notes',
          label: 'Lock screen notifications',
          type: 'array',
          maxRows: 3,
          admin: { description: 'Three short results shown on the locked phone. Leave empty to use the approved ones.' },
          fields: [text('text', 'Notification')],
        },
        area('first', 'First chat message'),
        area('last', 'Last chat message'),
      ],
    },
    {
      name: 'facts',
      label: 'Numbers on the receipts',
      type: 'group',
      admin: { description: 'The measured numbers in the chat, with their sources and dates. Change a number only after measuring it again.' },
      fields: [
        text('scoreSite', 'Score: site name'),
        text('scoreKind', 'Score: what it is'),
        text('scoreSource', 'Score: source'),
        text('scoreFrom', 'Score before', 'A whole number. Leave empty to use the measured one.'),
        text('scoreFromDate', 'Date of the score before'),
        text('scoreTo', 'Score after', 'A whole number. Leave empty to use the measured one.'),
        text('scoreToDate', 'Date of the score after'),
        text('picLabel', 'Main picture: label'),
        text('picFrom', 'Main picture: before'),
        text('picTo', 'Main picture: after'),
        text('picGain', 'Main picture: how much faster'),
        text('picSource', 'Main picture: source'),
        text('replyLabel', 'First reply: label'),
        text('replySecs', 'First reply: seconds', 'A whole number. Leave empty to use the timed one.'),
        text('replyText', 'First reply: what was timed'),
        text('replySource', 'First reply: source'),
        text('leadsTitle', 'Leads: file name'),
        text('leads', 'Leads: how many', 'A whole number. Leave empty to use the delivered one.'),
        text('leadsText', 'Leads: what they were'),
        text('leadsSource', 'Leads: source'),
        text('seoSite', 'Search: site name'),
        text('seoKind', 'Search: what it is'),
        text('seo', 'Search: SEO score', 'A whole number out of 100.'),
        text('bestPractices', 'Search: best practices score', 'A whole number out of 100.'),
        text('seoSource', 'Search: source'),
      ],
    },
    {
      name: 'receipt',
      label: 'Printed receipt at the end',
      type: 'group',
      fields: [
        text('title', 'Title'),
        text('sub', 'Line under the title'),
        {
          name: 'rows',
          label: 'Rows',
          type: 'array',
          maxRows: 8,
          admin: { description: 'Each row is a result and its number. Leave empty to use the approved rows.' },
          fields: [text('label', 'Result'), text('value', 'Number')],
        },
        text('totalLabel', 'Last line, left'),
        text('total', 'Last line, right'),
      ],
    },
  ],
}
