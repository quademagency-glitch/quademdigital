import type { Field } from 'payload'

/*
  The words of the home page problem section (row D final, 24 October 2026):
  the pinned phone story that shows six ways businesses lose customers online,
  each with its fix, then the free check-up.

  Every box may be left empty: the site then shows the approved words in
  src/lib/homeD/problem.defaults.json, whose shape this group matches field for
  field. The design draws exactly six problems, each with its own phone screen,
  so the six rows stay in this order and a row only changes the words of the
  problem at the same position. The phone screens' own small words are part of
  the drawing and are not edited here.
*/

const EMPHASIS = 'Wrap words in [square brackets] to make them blue, or **double stars** to make them stand out.'
const EMPTY = 'Leave empty to use the approved words.'
const TITLE = `The words before the [square brackets] go on the first line, the bracketed words (blue) on the second. ${EMPHASIS} ${EMPTY}`
const LINK = 'A path on this site with a slash at each end, for example /services/web-design/. Leave empty to use the approved link.'

const text = (name: string, label: string, description = EMPTY): Field => ({ name, label, type: 'text', admin: { description } })
const area = (name: string, label: string, description = EMPTY): Field => ({ name, label, type: 'textarea', admin: { description } })

export const dProblem: Field = {
  name: 'dProblem',
  label: 'Problem section',
  type: 'group',
  admin: {
    description:
      'The words of the "six ways businesses lose customers" story on the home page. Facts only: every number needs its source, and the free check-up covers only speed, phones and Google.',
  },
  fields: [
    text('pageTitle', 'Page title', 'Shown at the top of the section the whole time it scrolls'),
    text('label', 'Name of the section for screen readers'),
    text('eyebrow', 'Small label above the headline'),
    text('title', 'Headline', TITLE),
    area('lead', 'Lead under the headline', `${EMPHASIS} ${EMPTY}`),
    text('startWord', 'Large outlined word behind the phone, first step'),
    text('problemLabel', 'Label after each problem number', 'Shown as "01 · The problem". Leave empty to use the approved words.'),
    text('fixLabel', 'Label on each fix'),
    area('ghostText', 'Line shown before each fix arrives'),
    text('indexLabel', 'Heading of the list of six problems'),
    text('recapLabel', 'Heading of the list of fixes at the end'),
    {
      name: 'problems',
      label: 'The six problems',
      type: 'array',
      maxRows: 6,
      admin: { description: 'Six rows, in the order the phone shows them: slow website, late replies, hard to find, quiet social pages, ads with no enquiries, calling the wrong people. Each row changes only the words of the problem at the same position.' },
      fields: [
        text('word', 'One word for this problem', 'Used behind the phone and in the lists. Leave empty to use the approved words.'),
        text('title', 'Headline', TITLE),
        area('problem', 'The problem'),
        area('fix', 'The fix, in one or two sentences', 'Shown on phones under the problem. Leave empty to use the approved words.'),
        text('linkLabel', 'Link words'),
        text('linkHref', 'Link', LINK),
        text('summary', 'Short line in the list of six problems'),
        text('chipBad', 'Red label beside the phone'),
        text('chipGood', 'Blue label beside the phone, once fixed'),
        text('fixTitle', 'Fix card headline'),
        text('fixFigure', 'Fix card large number', 'Only where the approved card has one. Leave empty to use the approved words.'),
        area('fixText', 'Fix card text'),
        {
          name: 'fixPoints',
          label: 'Fix card ticked points',
          type: 'array',
          maxRows: 4,
          admin: { description: 'Only where the approved card has a ticked list. Leave empty to use the approved points.' },
          fields: [text('text', 'Point', `**Double stars** make a number stand out. ${EMPTY}`)],
        },
        area('fixNote', 'Fix card note or source'),
        text('recap', 'Line in the list of fixes at the end'),
      ],
    },
    {
      name: 'speedTable',
      label: 'Speed table on the first fix card',
      type: 'group',
      admin: { description: "Omek's Google PageSpeed phone test, before and after. Change only with a new measured test." },
      fields: [
        text('heading', 'Table heading'),
        text('before', 'Date of the first test'),
        text('after', 'Date of the second test'),
        {
          name: 'rows',
          label: 'Rows',
          type: 'array',
          maxRows: 6,
          fields: [text('label', 'Measure'), text('before', 'Before'), text('after', 'After')],
        },
      ],
    },
    text('closeEyebrow', 'Last step: small label'),
    text('closeTitle', 'Last step: headline', TITLE),
    area('closeText', 'Last step: text'),
    text('closeWord', 'Large outlined word behind the phone, last step'),
    text('ctaLabel', 'Main button words', 'The button goes where the Primary CTA link points (the free check-up). Leave empty to use the approved words.'),
    text('trust', 'Small line beside the button'),
  ],
}
