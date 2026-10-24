import type { Field } from 'payload'
import { EMPTY, storyStep, text } from './hero'

/*
  The words of the home page Process section (row D final, 24 October 2026):
  the pinned phone story that follows a client through the four steps.

  Every box may be left empty: the site then shows the approved words in
  src/lib/homeD/process.defaults.json, whose shape this group matches field
  for field. The story always has six steps in this order: the four steps at a
  glance, step 1 (free first look), step 2 (plan and fixed price), step 3
  (build and set up), step 4 (keep it working), then where to start. Row 1
  here changes the opening, row 2 step 1, and so on. The words must fit every
  service (websites, automation, video, search, ads and lead lists), not only
  websites. The drawings on the phone and the places of the cards are part of
  the design and are not edited here.

  This group holds every word of the section. The Process Steps collection fed
  the old home page section only, and nothing on the new home page reads it.
*/

export const dProcess: Field = {
  name: 'dProcess',
  label: 'Process section (four steps story)',
  type: 'group',
  admin: {
    description:
      'How we work, in four steps, the same for every service. Leave any box empty to use the approved words.',
  },
  fields: [
    {
      name: 'steps',
      label: 'Story steps',
      type: 'array',
      maxRows: 6,
      admin: {
        description:
          'Six steps in a fixed order: the four steps at a glance, step 1, step 2, step 3, step 4, then "Where to start". Row 1 is the opening (its headline is the section headline). The timeline labels are used on steps 1 to 4 only.',
      },
      fields: [
        ...storyStep('process'),
        text('note', 'Small note under the lead', `The short mono line with a tick, for example "Before any work starts". ${EMPTY}`),
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
    text('aria', 'Section name for screen readers', `Read aloud when someone reaches the section. ${EMPTY}`),
    text('timeline', 'Timeline name for screen readers', `What the row of step buttons is called when read aloud. ${EMPTY}`),
    {
      name: 'fixed',
      label: 'Step 1: found on Omek\'s old site',
      type: 'array',
      maxRows: 3,
      admin: { description: 'The list in the card beside step 1 (its heading is that step\'s first card). Leave empty to use the approved list.' },
      fields: [text('text', 'Problem')],
    },
  ],
}
