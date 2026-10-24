import type { Field } from 'payload'
import { EMPTY, storyStep, text } from './hero'

/*
  The words of the home page Work section (row D final, 24 October 2026): the
  pinned phone story that opens one project per step.

  Every box may be left empty: the site then shows the approved words in
  src/lib/homeD/work.defaults.json, whose shape this group matches field for
  field. The story always has eight steps in this order: all our work, Omek
  Storefront, SAN Collection, QuadERP, AI automation, AI video, Fieldwork, your
  turn. Row 1 here changes the opening, row 2 Omek, and so on. The drawings on
  the phone and the places of the cards are part of the design and are not
  edited here. SAN Collection's screenshot comes from its Case Studies entry.
*/

const CHIP_HELP =
  'The small status pills under the lead, in order. Say the real status: Client, In progress, Our product, Delivered. Leave empty to use the approved pills.'

export const dWork: Field = {
  name: 'dWork',
  label: 'Work section (projects story)',
  type: 'group',
  admin: {
    description:
      'Our work, one project per step. Leave any box empty to use the approved words. Every number needs its source and date, and every project shows its real status.',
  },
  fields: [
    {
      name: 'steps',
      label: 'Story steps',
      type: 'array',
      maxRows: 8,
      admin: {
        description:
          'Eight steps in a fixed order: the opening, Omek Storefront, SAN Collection, QuadERP, AI automation, AI video, Fieldwork, then "Your turn". Row 1 is the opening (its headline is the section headline).',
      },
      fields: [
        ...storyStep('work'),
        {
          name: 'chips',
          label: 'Status pills',
          type: 'array',
          maxRows: 4,
          admin: { description: CHIP_HELP },
          fields: [
            text('text', 'Pill words', 'For example "In progress" or "151 products live".'),
            {
              name: 'kind',
              label: 'Pill colour',
              type: 'select',
              defaultValue: 'own',
              options: [
                { label: 'White: a client', value: 'client' },
                { label: 'Amber: in progress', value: 'progress' },
                { label: 'Blue: live or delivered', value: 'live' },
                { label: 'Outline: our own', value: 'own' },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'cta',
      label: 'Main button',
      type: 'group',
      fields: [
        text('label', 'Button words'),
        text('href', 'Button link', `Leave empty to use the Primary CTA link (the free check-up). ${EMPTY}`),
      ],
    },
    text('trust', 'Small line beside the button'),
    {
      name: 'reel',
      label: 'AI video reel button',
      type: 'group',
      admin: { description: 'The button beside "See AI video" that stops and restarts the moving reel on the phone.' },
      fields: [text('pause', 'Words while the reel plays'), text('play', 'Words while the reel is paused')],
    },
    text('aria', 'Section name for screen readers', `Read aloud when someone reaches the section. ${EMPTY}`),
    text('timeline', 'Timeline name for screen readers', `What the row of project buttons is called when read aloud. ${EMPTY}`),
    {
      name: 'fixed',
      label: 'Omek: also fixed',
      type: 'array',
      maxRows: 4,
      admin: { description: 'The problems found on Omek\'s old site, in the "Also fixed" card. Leave empty to use the approved list.' },
      fields: [text('text', 'Problem')],
    },
    {
      name: 'results',
      label: 'Omek: results',
      type: 'array',
      maxRows: 5,
      admin: {
        description:
          'The before and after rows in the Omek "Results" card. The source and dates are the note of that card (step 2, third card). Change a number only after measuring it again.',
      },
      fields: [
        text('label', 'What was measured'),
        text('before', 'Before', 'For example "50" or "19.3s".'),
        text('after', 'After', 'For example "95" or "2.9s".'),
      ],
    },
    {
      name: 'projects',
      label: 'Your turn: every project',
      type: 'array',
      maxRows: 8,
      admin: { description: 'The list in the "Every project, as it is" card on the last step. Leave empty to use the approved list.' },
      fields: [
        text('name', 'Project'),
        text('sub', 'Short fact', 'For example "Client · 6 products live".'),
        text('status', 'Status', 'For example "In progress", "Delivered" or "Our own".'),
        {
          name: 'kind',
          label: 'Status colour',
          type: 'select',
          defaultValue: 'done',
          options: [
            { label: 'Amber: in progress', value: 'progress' },
            { label: 'Blue: anything else', value: 'done' },
          ],
        },
      ],
    },
  ],
}
