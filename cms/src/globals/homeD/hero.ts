import type { Field } from 'payload'

/*
  The words of the home page hero (row D final, 24 October 2026): the pinned
  phone story with its intro, five chapters and the end, the button, the proof
  line under it and the strip below the story.

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

/** One step of a pinned phone story. Shared by the hero and the proof section. */
export const storyStep = (what: string): Field[] => [
  text('label', 'Small label above the headline', `The mono label, for example "01 · Get found on Google". ${EMPTY}`),
  text('title', 'Headline', `${EMPHASIS} The words in [brackets] go on the second line, in blue. ${EMPTY}`),
  area('text', 'Lead under the headline', `${EMPHASIS} ${EMPTY}`),
  text('word', 'Big outlined word behind the phone', `One short word, shown very large and faint. ${EMPTY}`),
  text('tick', 'Timeline label', `The short word under this step's dot in the ${what} timeline. ${EMPTY}`),
  text('tickName', 'Timeline name for screen readers', `What the timeline button is called when read aloud. ${EMPTY}`),
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
      fields: storyStep('hero'),
    },
    {
      name: 'cta',
      label: 'Main button',
      type: 'group',
      fields: [text('label', 'Button words'), text('href', 'Button link', `Leave empty to use the Primary CTA link (the free check-up). ${LINK_HELP}`)],
    },
    text('trust', 'Proof line beside the button', `Short facts separated by " · ", each with its number. ${EMPTY}`),
    {
      name: 'after',
      label: 'Strip below the story',
      type: 'group',
      fields: [text('title', 'Headline'), area('text', 'Text')],
    },
  ],
}
