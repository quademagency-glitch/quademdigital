import type { CollectionBeforeChangeHook, Field } from 'payload'
import { APIError } from 'payload'
import { audit } from './audit'
import { refId, userById } from './moneyContext'

/**
 * A proposal is the deal (spec 4.4). These fields say where it came from, who
 * is credited, when it was accepted and whether it started after their salary,
 * which decides the commission rate on every payment.
 */
export const dealFields = (): Field[] => [
  {
    type: 'collapsible',
    label: 'Deal',
    fields: [
      {
        type: 'row',
        fields: [
          { name: 'lead', type: 'relationship', relationTo: 'leads', index: true, admin: { width: '34%', description: 'Where the deal came from. Sets who is credited.' } },
          {
            name: 'dealStatus',
            label: 'Deal',
            type: 'select',
            defaultValue: 'draft',
            index: true,
            options: [
              { label: 'Draft', value: 'draft' },
              { label: 'Sent', value: 'sent' },
              { label: 'Accepted', value: 'accepted' },
              { label: 'Declined', value: 'declined' },
              { label: 'Active', value: 'active' },
              { label: 'Completed', value: 'completed' },
              { label: 'Ended', value: 'ended' },
            ],
            admin: { width: '33%' },
          },
          {
            name: 'acceptedAt',
            label: 'Accepted on',
            type: 'date',
            index: true,
            admin: { width: '33%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' }, description: 'Needed before any payment is recorded.' },
          },
        ],
      },
      {
        type: 'row',
        fields: [
          { name: 'creditTo', label: 'Credited to', type: 'relationship', relationTo: 'users', index: true, admin: { width: '34%', description: 'From the lead. Empty for your own and inbound deals.' } },
          {
            name: 'creditType',
            label: 'Credit',
            type: 'select',
            options: [
              { label: 'Sourced', value: 'sourced' },
              { label: 'Handed over', value: 'handed' },
            ],
            admin: { width: '33%', readOnly: true },
          },
          { name: 'creditChangeReason', label: 'Why the credit changed', type: 'text', admin: { width: '33%' } },
        ],
      },
      {
        type: 'row',
        fields: [
          {
            name: 'pricing',
            type: 'select',
            options: [
              { label: 'Package price', value: 'package' },
              { label: 'Custom price', value: 'custom' },
            ],
            admin: { width: '34%' },
          },
          { name: 'plans', label: 'Price list items', type: 'relationship', relationTo: 'pricingPlans', hasMany: true, admin: { width: '66%' } },
        ],
      },
      {
        type: 'row',
        fields: [
          { name: 'startedAfterSalary', label: 'Started after their salary', type: 'checkbox', admin: { width: '50%', readOnly: true, description: 'Set on acceptance. Such deals earn the after-salary rate.' } },
          { name: 'endedAt', label: 'Retainer ended on', type: 'date', admin: { width: '50%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
        ],
      },
    ],
  },
]

const role = (v: unknown) => (v && typeof v === 'object' ? (v as { role?: string }).role : null)

export const dealBeforeChange: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const merged: Record<string, any> = { ...(originalDoc ?? {}), ...data }
  const leadId = refId(merged.lead)
  const leadChanged = leadId !== refId(originalDoc?.lead)
  const before = refId(originalDoc?.creditTo)
  let creditTo = 'creditTo' in data ? refId(data.creditTo) : before
  const lead = leadId ? await req.payload.findByID({ collection: 'leads', id: leadId, depth: 1, overrideAccess: true, req }).catch(() => null) : null

  if (lead && (leadChanged || creditTo === null)) {
    // Credit follows the lead: whoever on the team works it. Ernest's own and
    // inbound leads credit nobody.
    creditTo = lead.assignedTo && role(lead.assignedTo) === 'team' ? refId(lead.assignedTo) : null
  } else if (originalDoc && creditTo !== before && !String(merged.creditChangeReason ?? '').trim()) {
    throw new APIError('Changing who is credited with a deal needs a reason.', 400)
  }
  data.creditTo = creditTo
  data.creditType = !creditTo ? null : lead ? (refId(lead.owner) === creditTo ? 'sourced' : 'handed') : (merged.creditType ?? 'sourced')

  if (merged.acceptedAt) {
    if (['draft', 'sent', undefined, null].includes(merged.dealStatus)) data.dealStatus = 'accepted'
    const credited = await userById(req, creditTo)
    data.startedAfterSalary = Boolean(credited?.salaryStartDate && String(merged.acceptedAt) >= String(credited.salaryStartDate))
  }
  if (originalDoc && creditTo !== before) {
    await audit(req, {
      action: 'deal.credit-changed',
      summary: `Credit on ${merged.clientName || 'a deal'} changed`,
      person: creditTo ?? before,
      subjectType: 'proposals',
      subjectId: originalDoc.id,
      reason: merged.creditChangeReason || (leadChanged ? 'The lead changed' : null),
    })
  }
  return data
}
