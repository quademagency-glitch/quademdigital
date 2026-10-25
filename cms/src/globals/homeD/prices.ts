import type { Field } from 'payload'

/*
  The words of the home page prices section (row D final, 24 October 2026).

  Only the words around the cards, and the giant outlined title with its label
  at the top of the section. The plans, prices, features and extra
  prices come from the Pricing Plans collection, both lists, so the market rule
  in src/lib/markets.js keeps working. Every box may be left empty: the site
  then shows the approved words in src/lib/homeD/prices.defaults.json, whose
  shape this group matches field for field.

  Never name a currency in these words. The price engine writes the line that
  says what money the prices are in, per visitor.
*/

const EMPHASIS = 'Wrap words in [square brackets] to make them blue, or **double stars** to make them stand out.'
const EMPTY = 'Leave empty to use the approved words.'

const text = (name: string, label: string, description = EMPTY): Field => ({ name, label, type: 'text', admin: { description } })
const area = (name: string, label: string, description = EMPTY): Field => ({ name, label, type: 'textarea', admin: { description } })

export const dPrices: Field = {
  name: 'dPrices',
  label: 'Prices section',
  type: 'group',
  admin: {
    description:
      'The words around the price cards on the home page. Plans and prices are edited in Pricing Plans. Never name a currency here: each visitor sees prices in their own money.',
  },
  fields: [
    text('pageTitle', 'Page title', `The giant outlined word at the top of the section. One or two short words. ${EMPTY}`),
    text('pageLabel', 'Label under the page title', `The small line under the giant word. ${EMPTY}`),
    text('eyebrow', 'Small label above the headline'),
    text('headline', 'Headline', `${EMPHASIS} ${EMPTY}`),
    area('sub', 'Lead under the headline', `${EMPHASIS} ${EMPTY}`),
    {
      name: 'free',
      label: 'Free check-up strip',
      type: 'group',
      fields: [
        text('badge', 'Word in the dark square'),
        text('title', 'First line, in bold'),
        area('text', 'Text after it'),
        text('button', 'Button words'),
        text('link', 'Button link', 'A path on this site with a slash at each end, for example /offers/free-seo-audit/. Leave empty to use the free check-up page.'),
      ],
    },
    {
      name: 'oneOff',
      label: 'One-off projects row',
      type: 'group',
      admin: { description: 'The heading over the plans paid once, and the small line beside it.' },
      fields: [text('label', 'Heading'), text('note', 'Small line beside the heading')],
    },
    {
      name: 'monthly',
      label: 'Monthly plans row',
      type: 'group',
      admin: { description: 'The heading over the plans paid every month, and the small line beside it.' },
      fields: [text('label', 'Heading'), text('note', 'Small line beside the heading')],
    },
    {
      name: 'band',
      label: 'Every build includes band',
      type: 'group',
      admin: { description: 'The band under the one-off projects: what every build includes.' },
      fields: [
        text('label', 'Label'),
        {
          name: 'items',
          label: 'What every build includes',
          type: 'array',
          maxRows: 4,
          admin: { description: 'One short line each. Leave the list empty to use the approved three.' },
          fields: [{ name: 'text', label: 'Line', type: 'text', required: true }],
        },
      ],
    },
    {
      name: 'foot',
      label: 'Note under the cards',
      type: 'group',
      fields: [area('text', 'Note'), text('custom', 'Second line, about custom projects')],
    },
    {
      name: 'card',
      label: 'Words on every card',
      type: 'group',
      admin: { description: 'The small words each price card repeats. The plan names and prices come from Pricing Plans.' },
      fields: [
        text('from', 'Above each price'),
        text('month', 'After a monthly price'),
        text('popular', 'Badge on the most popular plans'),
        text('book', 'Button words'),
        text('covers', 'Link to the service page'),
        text('addFrom', 'Before each extra price'),
      ],
    },
  ],
}
