import type { Field } from 'payload'
import { EMPHASIS, EMPTY, area, text } from './hero'

/*
  The words around the home page FAQ (row D final, 24 October 2026).

  The questions and answers are not here: they stay in the FAQs collection
  (Website > FAQs), which also feeds the FAQ structured data search engines
  read. This group only holds the small label, the headline, the line under it
  and the link to the contact form.

  Every box may be left empty: the site then shows the approved words in
  src/lib/homeD/faq.defaults.json, whose shape this group matches field for
  field.
*/

export const dFaq: Field = {
  name: 'dFaq',
  label: 'FAQ section',
  type: 'group',
  admin: {
    description:
      'The words around the questions near the end of the home page. The questions and answers themselves are edited in Website > FAQs. Leave any box empty to use the approved words.',
  },
  fields: [
    text('eyebrow', 'Small label above the headline', `A word or two, shown in small capitals. ${EMPTY}`),
    text('headline', 'Headline', `${EMPHASIS} ${EMPTY}`),
    area('sub', 'Line under the headline', `${EMPHASIS} ${EMPTY}`),
    text('link', 'Link to the contact form', `The words of the link that jumps to the contact form below. Start with a verb. ${EMPTY}`),
  ],
}
