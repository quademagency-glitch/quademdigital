import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/roles'
import { currencyOptions } from '../fields/terms'

/**
 * Company-wide settings for the team's money (spec 5.7 and 14.3). What a
 * person earns lives on their own terms; this holds only what is the same for
 * everyone: exchange rates and the payment windows.
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
    read: isAdmin,
    update: isAdmin,
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
      type: 'row',
      fields: [
        { name: 'commissionDueDays', label: 'Commission due within (days)', type: 'number', defaultValue: 7, min: 0, admin: { width: '33%' } },
        { name: 'allowanceWindowStart', label: 'Allowance window opens (day of month)', type: 'number', defaultValue: 15, min: 1, max: 28, admin: { width: '33%' } },
        { name: 'allowanceWindowEnd', label: 'Allowance window closes (day of month)', type: 'number', defaultValue: 20, min: 1, max: 28, admin: { width: '34%' } },
      ],
    },
  ],
}
