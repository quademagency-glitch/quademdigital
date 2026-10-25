import type { Field } from 'payload'
import { EMPTY, area, text } from './hero'

/*
  The words of the home page testimonials section, "What clients say"
  (25 October 2026): the giant outlined title and its label, the chip and the
  link under the quote.

  The quotes themselves come from the Testimonials collection (Website >
  Testimonials): every published testimonial is shown, Emmanuel Korsah's
  first. The quote boxes here are used only when none is published.

  Every box may be left empty: the site then shows the approved words in
  src/lib/homeD/testimonials.defaults.json, whose shape this group matches
  field for field.
*/

const LINK_HELP = 'A path on this site, for example /projects/omek-storefront/.'

export const dTestimonials: Field = {
  name: 'dTestimonials',
  label: 'What clients say',
  type: 'group',
  admin: {
    description:
      'The client quote section after Our work. The quotes are edited in Website > Testimonials (only published ones show). Leave any box empty to use the approved words.',
  },
  fields: [
    text('pageTitle', 'Page title', `The giant outlined words at the top of the section. ${EMPTY}`),
    text('label', 'Label under the page title', `The small line under the giant words. ${EMPTY}`),
    text('chip', 'Small chip under the name', `Says who the client is and what we built, for example "Client · Omek Storefront". ${EMPTY}`),
    text('linkLabel', 'Link words', `Start with a verb, for example "Read the Omek story". ${EMPTY}`),
    text('href', 'Link', `${LINK_HELP} ${EMPTY}`),
    {
      name: 'quote',
      label: 'Quote (used only when no testimonial is published)',
      type: 'group',
      admin: { description: 'Word for word, never corrected. A published testimonial in the Testimonials collection replaces these boxes.' },
      fields: [area('text', 'Quote'), text('name', 'Name'), text('role', 'Role and company')],
    },
  ],
}
