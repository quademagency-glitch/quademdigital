import type { Field } from 'payload'

/**
 * The money terms a team member works on: commission, salary, the data
 * allowance, targets. Used twice, by `terms-templates` (a named set to start
 * from) and by `member-terms` (one person's terms from a given date), so the
 * two can never drift apart.
 *
 * **No values live in this file, not even as defaults.** This repository is
 * public and the numbers are what Quadem pays people. They are typed into the
 * CMS as data, and the private team portal pre-fills its own form.
 *
 * Money is in minor units with its currency beside it (pesewas, kobo, cents),
 * as invoices already store it. Thresholds measured against client payments
 * are in GH₵, because commission is earned in GH₵. Salary and the data
 * allowance are paid in the person's own currency.
 *
 * Rates are written the way the agreement writes them, "1/3" or "10%", and
 * parsed into an exact fraction by `parseRate`. A stored 33.33 would be a
 * pesewa out on some payments, and money calculations here are checked to the
 * pesewa.
 */

export const CURRENCIES = ['GHS', 'NGN', 'USD', 'KES', 'ZAR', 'GBP', 'EUR'] as const
export type Currency = (typeof CURRENCIES)[number]

export const currencyOptions = CURRENCIES.map((c) => ({ label: c, value: c }))

/** A person's currency from their country, for the cases that are obvious. */
export const currencyForCountry = (country: unknown): Currency | undefined => {
  const map: Record<string, Currency> = { GH: 'GHS', NG: 'NGN', KE: 'KES', ZA: 'ZAR', GB: 'GBP', US: 'USD' }
  return map[String(country ?? '').trim().toUpperCase()]
}

const RATE = /^\s*(?:(\d+)\s*\/\s*(\d+)|(\d+(?:\.\d+)?)\s*%)\s*$/

/** "1/3" → { num: 1, den: 3 }; "10%" → { num: 10, den: 100 }; "2.5%" → { num: 25, den: 1000 }. */
export const parseRate = (value: unknown): { num: number; den: number } | null => {
  const m = RATE.exec(String(value ?? ''))
  if (!m) return null
  if (m[1] && m[2]) {
    const num = Number(m[1])
    const den = Number(m[2])
    return den > 0 && num <= den ? { num, den } : null
  }
  const [whole, frac = ''] = m[3].split('.')
  const den = 100 * 10 ** frac.length
  const num = Number(whole + frac)
  return num <= den ? { num, den } : null
}

const rate = (name: string, label: string, description: string): Field => ({
  name,
  label,
  type: 'text',
  admin: { description: `${description} Write it as a fraction or a percentage, such as 1/3 or 10%.` },
  validate: (value: unknown) =>
    value === null || value === undefined || value === '' || parseRate(value)
      ? true
      : 'Write a fraction such as 1/3 or a percentage such as 10%, no more than the whole.',
})

const minor = (name: string, label: string, description: string): Field => ({
  name,
  label,
  type: 'number',
  min: 0,
  admin: {
    description: `${description} In the smallest unit: pesewas, kobo or cents, so 1,000 is written 100000.`,
  },
})

const count = (name: string, label: string, description: string): Field => ({
  name,
  label,
  type: 'number',
  min: 0,
  admin: { description },
})

export const termsFields = (): Field[] => [
  {
    name: 'currency',
    label: 'Paid in',
    type: 'select',
    options: currencyOptions,
    admin: { description: 'The currency their salary and data allowance are paid in, and their commission is shown in.' },
  },
  {
    name: 'commission',
    type: 'group',
    admin: { description: 'Earned in GH₵ on what a client pays, after the allowed costs.' },
    fields: [
      rate('share', 'On a new deal', 'Their share of the net profit on a deal they sourced or were handed.'),
      count('retainerFromMonth', 'Retainer rate starts in month', 'From this month of a retainer, the retainer rate applies instead.'),
      rate('retainerRate', 'Retainer rate', 'From the month above onwards.'),
      rate('afterSalaryRate', 'After the salary starts', 'On deals accepted after their salary start date.'),
    ],
  },
  {
    name: 'salaryTrigger',
    label: 'Salary trigger',
    type: 'group',
    admin: { description: 'The salary starts once their sourced retainer clients bring in this much, month after month.' },
    fields: [
      minor('monthlyGHSMinor', 'Each month, in GH₵', 'Paid by their sourced retainer clients.'),
      count('months', 'Months in a row', 'How many consecutive months it must be met.'),
    ],
  },
  {
    name: 'salary',
    type: 'group',
    fields: [
      minor('amountMinor', 'Monthly salary', 'In their own currency, from the salary start date.'),
      count('yearlyRaisePercent', 'Yearly rise, %', 'After each satisfactory yearly appraisal.'),
    ],
  },
  {
    name: 'foundingPartner',
    label: 'Founding Partner',
    type: 'group',
    admin: { description: 'Paid by clients they sourced, within the window, counted from their start date.' },
    fields: [
      minor('totalGHSMinor', 'Total, in GH₵', 'All payments by their sourced clients.'),
      minor('retainerGHSMinor', 'Of which from retainers, in GH₵', 'The part that must come from retainers.'),
      count('withinMonths', 'Within months', 'Counted from their start date.'),
    ],
  },
  {
    name: 'dataAllowance',
    label: 'Data allowance',
    type: 'group',
    fields: [
      minor('amountMinor', 'Each month', 'In their own currency.'),
      count('reportsNeeded', 'Reports needed', 'Daily reports in the month to earn it, from the second payment. Approved days off lower it.'),
    ],
  },
  {
    name: 'leave',
    label: 'Time off',
    type: 'group',
    fields: [count('daysPerYear', 'Days off a year', 'Each calendar year. Exam days and sick days are recorded separately and not taken from these.')],
  },
  {
    name: 'targets',
    type: 'group',
    fields: [count('countedDealsPerMonth', 'Counted deals a month', 'Handed-over deals count.')],
  },
  {
    name: 'missedMonths',
    label: 'Missed months',
    type: 'group',
    admin: { description: 'A month with no counted deal adds one; a month with a deal resets it to nought.' },
    fields: [
      count('graceMonths', 'Not counted for the first', 'Months from the start date.'),
      count('meetingAt', 'Review meeting at', 'Agree changes in writing.'),
      count('endAt', 'Agreement ends at', 'At the end of that month. Ernest is alerted.'),
    ],
  },
]
