import type { Field } from 'payload'
import { EMPHASIS, EMPTY, text } from './hero'

/*
  The new words of the home page contact section (row D final, 24 October
  2026): the giant outlined title and its label, the small label, the headline
  with its blue phrase, and three small lines beside the ways to reach us.

  Everything else in the section keeps coming from where it always has: the
  Contact fields further down this page (the line under the headline, the
  "Get in touch" title and text, the WhatsApp and submit button words, the
  thank-you message) and Site Settings (email, WhatsApp number, social links).

  Every box may be left empty: the site then shows the approved words in
  src/lib/homeD/contact.defaults.json, whose shape this group matches field for
  field. While the headline here is empty, the older "Contact Section Heading"
  field still sets the words.
*/

export const dContact: Field = {
  name: 'dContact',
  label: 'Contact section',
  type: 'group',
  admin: {
    description:
      'The last section of the home page, with the enquiry form. The other words of this section are in the Contact fields below, and the email, WhatsApp number and social links are in Site Settings. Leave any box empty to use the approved words.',
  },
  fields: [
    text('pageTitle', 'Page title', `The giant outlined word at the top of the section. One or two short words. ${EMPTY}`),
    text('pageLabel', 'Label under the page title', `The small line under the giant word. ${EMPTY}`),
    text('eyebrow', 'Small label above the headline', `A word or two, shown in small capitals. ${EMPTY}`),
    text(
      'headline',
      'Headline',
      `${EMPHASIS} While this is empty, the "Contact Section Heading" field below sets the words. ${EMPTY}`,
    ),
    text('whatsappNote', 'Line under the WhatsApp button', `Only a measured claim. ${EMPTY}`),
    text('emailLabel', 'Small label above the email address', EMPTY),
    text('socialLabel', 'Small label above the social links', EMPTY),
  ],
}
