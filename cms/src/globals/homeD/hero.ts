import type { Field } from 'payload'

/*
  The words of the home page hero (row D final, 24 October 2026): the pinned
  phone story with its intro, five chapters and the end, the button, the proof
  line under it and the results strip along the bottom.

  Every box may be left empty: the site then shows the approved words in
  src/lib/homeD/hero.defaults.json, whose shape this group matches field for
  field. The story always has seven steps in this order (intro, chapters 01 to
  05, the end); row 1 here changes the intro, row 2 chapter 01, and so on.
  The phone screens, the flying cards' places and the background work wall are
  part of the design and are not edited here.
*/

export const EMPHASIS = 'Wrap words in [square brackets] to make them blue, or **double stars** to make them stand out.'
export const EMPTY = 'Leave empty to use the approved words.'

export const text = (name: string, label: string, description = EMPTY): Field => ({ name, label, type: 'text', admin: { description } })
export const area = (name: string, label: string, description = EMPTY): Field => ({ name, label, type: 'textarea', admin: { description } })

const LINK_HELP = 'A path on this site, for example /services/seo/, or an anchor such as #work.'

/**
 * One step of a pinned phone story, shared by the story sections. Pass
 * { timeline: false } for a section whose step timeline was removed (the hero
 * and the proof, 24 Oct 2026): its two timeline fields then stay, hidden, so
 * the database keeps matching the migration that created them; nothing reads
 * them, and the next migration may drop them.
 */
export const storyStep = (what: string, { timeline = true }: { timeline?: boolean } = {}): Field[] => [
  text('label', 'Small label above the headline', `The mono label, for example "01 · Get found on Google". ${EMPTY}`),
  text('title', 'Headline', `${EMPHASIS} The words in [brackets] go on the second line, in blue. ${EMPTY}`),
  area('text', 'Lead under the headline', `${EMPHASIS} ${EMPTY}`),
  text('word', 'Big outlined word behind the phone', `One short word, shown very large and faint. ${EMPTY}`),
  timeline
    ? text('tick', 'Timeline label', `The short word under this step's dot in the ${what} timeline. ${EMPTY}`)
    : { name: 'tick', label: 'Timeline label (no longer shown)', type: 'text', admin: { hidden: true } },
  timeline
    ? text('tickName', 'Timeline name for screen readers', `What the timeline button is called when read aloud. ${EMPTY}`)
    : { name: 'tickName', label: 'Timeline name (no longer shown)', type: 'text', admin: { hidden: true } },
  {
    name: 'links',
    label: 'Links under the lead',
    type: 'array',
    maxRows: 2,
    admin: { description: `Up to two. Leave empty to use the approved links (some steps have none). ${LINK_HELP}` },
    fields: [text('label', 'Link words', 'Start with a verb, for example "See SEO".'), text('href', 'Link', LINK_HELP)],
  },
  {
    name: 'cards',
    label: 'Cards around the phone',
    type: 'array',
    maxRows: 3,
    admin: {
      description:
        'The small cards that fly in beside the phone, in the order the design places them. A pill shows only the label; a card shows the label, the big value and the note. Leave empty to use the approved cards. Every number needs its source in the note.',
    },
    fields: [
      text('label', 'Label', 'Pill words, or the small label on a card.'),
      text('value', 'Big value', 'The large number on a card, for example "19.3s to 2.9s". Leave empty on a pill.'),
      text('note', 'Note', 'The line under the value: where the number comes from. Leave empty on a pill.'),
    ],
  },
]

export const dHero: Field = {
  name: 'dHero',
  label: 'Hero (phone story)',
  type: 'group',
  admin: {
    description:
      'The first section of the home page. Leave any box empty to use the approved words. The button goes to the Primary CTA link unless a link is set here.',
  },
  fields: [
    {
      name: 'steps',
      label: 'Story steps',
      type: 'array',
      maxRows: 7,
      admin: { description: 'Seven steps in a fixed order: the intro, chapters 01 to 05, then the end. Row 1 is the intro (its headline is the page headline, its link is "See our work").' },
      fields: storyStep('hero', { timeline: false }),
    },
    {
      name: 'cta',
      label: 'Main button',
      type: 'group',
      fields: [text('label', 'Button words'), text('href', 'Button link', `Leave empty to use the Primary CTA link (the free check-up). ${LINK_HELP}`)],
    },
    text('trust', 'Proof line beside the button', `Short facts separated by " · ", each with its number. ${EMPTY}`),
    {
      // Results along the bottom of the hero (owner, 26 Oct 2026: social
      // proof back, as a strip rather than a section of its own).
      name: 'proof',
      label: 'Results strip',
      type: 'array',
      maxRows: 4,
      admin: {
        description:
          'The row of measured results along the bottom of the hero, up to four. Each opens its project in Our work. Leave empty to use the approved results. Every number must be a real, measured result.',
      },
      fields: [
        text('value', 'Number', 'The big figure, for example "2.9s".'),
        text('label', 'What it is', 'A few words, for example "Omek’s main picture, down from 19.3s".'),
        {
          name: 'step',
          label: 'Project it opens',
          type: 'number',
          min: 1,
          max: 7,
          admin: { description: 'Which step of Our work it opens: 1 Omek Storefront, 2 SAN Collection, 3 QuadERP, 4 AI automation, 5 AI video, 6 Fieldwork.' },
        },
      ],
    },
    {
      // The old strip under the story left the page on 25 Oct 2026. Kept,
      // hidden, so the database keeps matching its migration.
      name: 'after',
      label: 'Strip below the story (no longer shown)',
      type: 'group',
      admin: { hidden: true },
      fields: [text('title', 'Headline'), area('text', 'Text')],
    },
  ],
}
