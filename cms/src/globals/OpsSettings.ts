import type { GlobalConfig } from 'payload'
import { adminOrTeam, isAdmin } from '../access/roles'
import { currencyOptions } from '../fields/terms'

const HOLIDAY_COUNTRIES = [
  { label: 'Ghana', value: 'GH' },
  { label: 'Nigeria', value: 'NG' },
  { label: 'Kenya', value: 'KE' },
  { label: 'South Africa', value: 'ZA' },
  { label: 'United Kingdom', value: 'GB' },
  { label: 'United States', value: 'US' },
]

/**
 * Company-wide settings for the team (spec 5.7, 14.3 and 14.6). What a person
 * earns lives on their own terms; this holds only what is the same for
 * everyone: exchange rates, the payment windows and public holidays.
 *
 * Every change is kept in version history, so a rate on any past day can be
 * looked up. Money already worked out keeps the rate it was worked out with;
 * changing a rate here never alters a paid amount.
 */
export const OpsSettings: GlobalConfig = {
  slug: 'ops-settings',
  label: 'Team money settings',
  admin: { group: 'Team' },
  access: {
    // Team members read the rates, so their Money screen can show what unpaid
    // commission is worth in their own currency today. Only an admin changes them.
    read: adminOrTeam,
    update: isAdmin,
    readVersions: isAdmin,
  },
  versions: { max: 200 },
  fields: [
    {
      name: 'exchangeRates',
      label: 'Exchange rates',
      type: 'array',
      admin: {
        description: 'How much of each currency one Ghana cedi buys, such as 114.96 for naira. Update before recording payments and paying people.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'currency', type: 'select', required: true, options: currencyOptions.filter((c) => c.value !== 'GHS'), admin: { width: '33%' } },
            { name: 'perGHS', label: 'For GH₵1', type: 'number', required: true, min: 0, admin: { width: '33%', step: 0.0001 } },
            { name: 'note', type: 'text', admin: { width: '34%', description: 'Where the rate came from, such as Grey on 2 Oct.' } },
          ],
        },
      ],
    },
    {
      name: 'publicHolidays',
      label: 'Public holidays',
      type: 'array',
      admin: {
        description: "Per country. No daily report is expected on a person's own country's holidays, and they do not count against the data allowance (spec 14.6).",
        initCollapsed: true,
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'country', type: 'select', required: true, options: HOLIDAY_COUNTRIES, admin: { width: '25%' } },
            { name: 'date', type: 'date', required: true, admin: { width: '30%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
            { name: 'name', type: 'text', required: true, admin: { width: '45%' } },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'commissionDueDays', label: 'Commission due within (days)', type: 'number', defaultValue: 7, min: 0, admin: { width: '33%' } },
        { name: 'allowanceWindowStart', label: 'Allowance window opens (day of month)', type: 'number', defaultValue: 15, min: 1, max: 28, admin: { width: '33%' } },
        { name: 'allowanceWindowEnd', label: 'Allowance window closes (day of month)', type: 'number', defaultValue: 20, min: 1, max: 28, admin: { width: '34%' } },
      ],
    },
  ],
}
