import type { Field } from 'payload'

/*
  The words of the home page solutions section (row D final, 24 October 2026):
  the pinned phone story whose home screen holds the six services as apps in
  two folders, One-off projects and Monthly plans, opening one app per step.

  Every box may be left empty: the site then shows the approved words in
  src/lib/homeD/solutions.defaults.json, whose shape this group matches field
  for field. The design draws exactly six apps, so the six rows stay in this
  order and a row only changes the words of the service at the same position.
  The phone screens' own small words are part of the drawing and are not
  edited here.
*/

const EMPHASIS = 'Wrap words in [square brackets] to make them blue, or **double stars** to make them stand out.'
const EMPTY = 'Leave empty to use the approved words.'
const TITLE = `The words before the [square brackets] go on the first line, the bracketed words (blue) on the second. ${EMPHASIS} ${EMPTY}`
const LINK = 'A path on this site with a slash at each end, for example /services/seo/. Leave empty to use the approved link.'

const text = (name: string, label: string, description = EMPTY): Field => ({ name, label, type: 'text', admin: { description } })
const area = (name: string, label: string, description = EMPTY): Field => ({ name, label, type: 'textarea', admin: { description } })

export const dSolutions: Field = {
  name: 'dSolutions',
  label: 'Solutions section',
  type: 'group',
  admin: {
    description:
      'The words of the "six services" story on the home page. Facts only: every number needs its source. Never name a currency or a price here.',
  },
  fields: [
    text('pageTitle', 'Page title', 'Shown at the top of the section the whole time it scrolls'),
    text('pageLabel', 'Line under the page title', 'A few words, shown with the step counter under the page title. Leave empty to use the approved words.'),
    text('label', 'Name of the section for screen readers'),
    text('eyebrow', 'Small label above the headline'),
    text('title', 'Headline', TITLE),
    area('lead', 'Lead under the headline', `${EMPHASIS} ${EMPTY}`),
    text('startWord', 'Large outlined word behind the phone, first step'),
    text('oneOffLabel', 'Folder name: one-off projects'),
    text('oneOffNote', 'Small line beside it'),
    text('monthlyLabel', 'Folder name: monthly plans'),
    text('monthlyNote', 'Small line beside it'),
    {
      name: 'services',
      label: 'The six services',
      type: 'array',
      maxRows: 6,
      admin: { description: 'Six rows, in the order the phone opens them: web design, AI automation, AI video, SEO, performance marketing, Fieldwork. The first two sit in One-off projects, the other four in Monthly plans. Each row changes only the words of the service at the same position.' },
      fields: [
        text('name', 'Service name'),
        text('tab', 'Short name under the app icon'),
        text('word', 'Large outlined word behind the phone'),
        text('title', 'Headline', TITLE),
        area('text', 'Text'),
        {
          name: 'tags',
          label: 'Tags',
          type: 'array',
          maxRows: 3,
          admin: { description: 'Three short tags. Leave empty to use the approved tags.' },
          fields: [text('tag', 'Tag')],
        },
        text('linkLabel', 'Link words'),
        text('linkHref', 'Link', LINK),
        text('cardKicker', 'Proof card beside the phone: small label', 'Only where the approved design has a card. Leave empty to use the approved words.'),
        text('cardFigure', 'Proof card: large number'),
        area('cardText', 'Proof card: text or source'),
        text('chip', 'Label beside the phone', 'Only where the approved design has one. Leave empty to use the approved words.'),
      ],
    },
    text('closeEyebrow', 'Last step: small label'),
    text('closeTitle', 'Last step: headline', TITLE),
    area('closeText', 'Last step: text'),
    text('customText', 'Custom projects line'),
    text('customLink', 'Custom projects link words'),
    text('customHref', 'Custom projects link', 'A path on this site with a slash at each end. Leave empty to use the contact page.'),
    text('customChip', 'Custom projects label beside the phone'),
    text('closeWord', 'Large outlined word behind the phone, last step'),
    text('ctaLabel', 'Main button words', 'The button goes where the Primary CTA link points (the free check-up). Leave empty to use the approved words.'),
    text('trust', 'Small line beside the button'),
  ],
}
