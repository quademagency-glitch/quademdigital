import type { CollectionConfig, Where } from 'payload'
import { APIError } from 'payload'
import { hasRole, isAdmin } from '../access/roles'
import { adminMineOrManaged, managedIds, manages, reviewersOf } from '../access/managers'
import { currencyOptions } from '../fields/terms'
import { audit } from '../lib/audit'
import { refId, userById } from '../lib/moneyContext'
import { adminIds, notify } from '../lib/notify'

/**
 * A cost a team member paid for Quadem and wants back (spec 14.7), with its
 * receipt. Ernest approves or declines it; an approved claim is paid with an
 * "Expenses" payout, which marks it paid.
 */
export const ExpenseClaims: CollectionConfig = {
  slug: 'expense-claims',
  labels: { singular: 'Expense claim', plural: 'Expense claims' },
  admin: { group: 'Team', useAsTitle: 'title', defaultColumns: ['title', 'user', 'amountMinor', 'status', 'createdAt'] },
  defaultSort: '-createdAt',
  access: {
    read: adminMineOrManaged('user'),
    create: ({ req: { user } }) => hasRole(user, 'admin', 'team'),
    // While it waits: the person can correct it, their manager can decide it (spec 14.7).
    update: async ({ req }) => {
      const user = req.user
      if (hasRole(user, 'admin')) return true
      if (!hasRole(user, 'team') || !user) return false
      const people = await managedIds(req)
      return { and: [{ status: { equals: 'submitted' } }, { or: [{ user: { equals: user.id } }, ...(people.length ? [{ user: { in: people } }] : [])] }] } as Where
    },
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const user = req.user as { id: number; role?: string } | null
        const team = hasRole(user, 'team')
        if (operation === 'create') {
          if (team) {
            data.user = user!.id
            data.status = 'submitted'
          }
          const person = await userById(req, refId(data.user))
          data.currency = data.currency || person?.currency || 'GHS'
        }
        if (team && operation === 'update') {
          if (String(refId(originalDoc?.user)) === String(user!.id)) {
            // While it waits, the person can correct it; the decision is Ernest's or their manager's.
            for (const k of ['user', 'status', 'decidedBy', 'decidedAt', 'decisionNote', 'payout']) data[k] = originalDoc?.[k]
          } else {
            // Their manager approves or declines, and changes nothing else.
            if (!(await manages(req, originalDoc?.user))) throw new APIError('Only Ernest or their manager can decide this.', 403)
            for (const k of Object.keys(data)) if (k !== 'status' && k !== 'decisionNote') data[k] = originalDoc?.[k]
            if (data.status !== undefined && !['approved', 'declined'].includes(data.status)) data.status = originalDoc?.status
          }
        }
        const merged = { ...(originalDoc ?? {}), ...data }
        if (!(Number(merged.amountMinor) > 0)) throw new APIError('Enter what it cost.', 400)
        if (!refId(merged.receipt)) throw new APIError('Add the receipt.', 400)
        if (data.status && data.status !== originalDoc?.status && ['approved', 'declined'].includes(data.status)) {
          data.decidedBy = user?.id ?? null
          data.decidedAt = new Date().toISOString()
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const person = await userById(req, refId(doc.user))
        const amount = `${doc.currency} ${(doc.amountMinor / 100).toLocaleString('en-GB')}`
        if (operation === 'create' && hasRole(req.user, 'team')) {
          await notify(req, { to: await reviewersOf(req, refId(doc.user), await adminIds(req)), kind: 'expense', title: `${person?.name || 'A team member'} claims ${amount}: ${doc.title}`, link: '/payments', action: 'Decide' })
        }
        if (operation === 'update' && doc.status !== previousDoc?.status && ['approved', 'declined'].includes(doc.status)) {
          await audit(req, {
            action: `expense.${doc.status}`,
            summary: `Expense ${doc.status}: ${doc.title}, ${amount}`,
            person: refId(doc.user),
            subjectType: 'expense-claims',
            subjectId: doc.id,
            reason: doc.decisionNote,
          })
          await notify(req, {
            to: [refId(doc.user)],
            kind: 'expense',
            title: `Your expense claim was ${doc.status}: ${doc.title}`,
            body: doc.decisionNote || (doc.status === 'approved' ? 'It will be paid with your next payout.' : undefined),
            link: '/money',
          })
        }
        return doc
      },
    ],
  },
  fields: [
    { name: 'title', label: 'What it was', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'user', label: 'Claimed by', type: 'relationship', relationTo: 'users', index: true, admin: { width: '34%' } },
        { name: 'spentAt', label: 'Spent on', type: 'date', admin: { width: '33%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
        { name: 'receipt', type: 'relationship', relationTo: 'documents', admin: { width: '33%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'currency', type: 'select', options: currencyOptions, admin: { width: '50%' } },
        { name: 'amountMinor', label: 'Amount (minor units)', type: 'number', required: true, min: 1, admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          defaultValue: 'submitted',
          index: true,
          options: [
            { label: 'Waiting', value: 'submitted' },
            { label: 'Approved', value: 'approved' },
            { label: 'Declined', value: 'declined' },
            { label: 'Paid', value: 'paid' },
          ],
          admin: { width: '34%' },
        },
        { name: 'decidedBy', label: 'Decided by', type: 'relationship', relationTo: 'users', admin: { width: '33%', readOnly: true } },
        { name: 'decidedAt', label: 'Decided on', type: 'date', admin: { width: '33%', readOnly: true } },
      ],
    },
    { name: 'decisionNote', label: 'Note on the decision', type: 'text' },
    { name: 'payout', label: 'Paid in', type: 'relationship', relationTo: 'payouts', admin: { readOnly: true } },
  ],
}
