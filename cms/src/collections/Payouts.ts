import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { adminOrMine, isAdmin } from '../access/roles'
import { currencyOptions } from '../fields/terms'
import { audit } from '../lib/audit'
import { allowanceEligible, ghsToLocalMinor, toGHSMinor } from '../lib/money'
import { rateFor, refId, termsOn, userById } from '../lib/moneyContext'
import { notify } from '../lib/notify'

/**
 * Money sent to a team member (spec 5.3 and 14.7). It is paid in the Grey app
 * and recorded here; the portal never moves money itself (section 13).
 *
 * Kinds:
 * - commission: the commission on chosen client payments, summed in GH₵
 *   (refunds included) and converted at that day's rate, which is stored, so a
 *   later rate change never alters a paid amount.
 * - data allowance: from their terms, for a month's window, only when enough
 *   daily reports were sent since the previous allowance (the first is always
 *   due). It carries on after a salary starts.
 * - salary, bonus, advance, expense: an amount in their currency. An advance
 *   is owed back until later payouts deduct it (`advanceRepaidMinor`).
 *
 * Every kind keeps its GH₵ value and the rate used, so team cost adds up in
 * one currency.
 *
 * Every version is kept. The person sees their own payouts.
 */

const TYPES = [
  { label: 'Commission', value: 'commission' },
  { label: 'Data allowance', value: 'allowance' },
  { label: 'Salary', value: 'salary' },
  { label: 'Bonus', value: 'bonus' },
  { label: 'Advance', value: 'advance' },
  { label: 'Expenses', value: 'expense' },
]
const TYPE_TEXT = Object.fromEntries(TYPES.map((t) => [t.value, t.label]))

export const Payouts: CollectionConfig = {
  slug: 'payouts',
  labels: { singular: 'Payout', plural: 'Payouts' },
  admin: { group: 'Team', useAsTitle: 'title', defaultColumns: ['title', 'user', 'type', 'amountLocalMinor', 'paidAt'] },
  defaultSort: '-paidAt',
  versions: { maxPerDoc: 0 },
  access: {
    read: adminOrMine('user'),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
    readVersions: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const merged: Record<string, any> = { ...(originalDoc ?? {}), ...data }
        const userId = refId(merged.user)
        const person = await userById(req, userId)
        if (!person || person.role !== 'team') throw new APIError('Choose the team member being paid.', 400)
        if (!merged.paidAt) throw new APIError('Enter the day it was paid.', 400)
        const currency = String(merged.currency || person.currency || 'GHS').toUpperCase()
        data.currency = currency
        const day = String(merged.paidAt)
        const terms = await termsOn(req, userId!, day)

        if (merged.type === 'commission') {
          const ids = (Array.isArray(merged.clientPayments) ? merged.clientPayments : []).map(refId).filter(Boolean) as number[]
          if (!ids.length) throw new APIError('Choose the client payments this commission is for.', 400)
          const pays = await req.payload.find({ collection: 'client-payments', where: { id: { in: ids } }, limit: ids.length, depth: 0, overrideAccess: true, req })
          for (const p of pays.docs) {
            if (refId(p.creditTo) !== userId) throw new APIError(`${p.title} is not credited to ${person.name || person.email}.`, 400)
            if (refId(p.payout) && refId(p.payout) !== Number(originalDoc?.id)) throw new APIError(`${p.title} has already been paid out.`, 400)
          }
          const ghs = pays.docs.reduce((n, p) => n + Number(p.commissionGHSMinor || 0), 0)
          if (ghs <= 0) throw new APIError('The chosen payments add up to no commission.', 400)
          // The rate given, or today's from Team money settings. It is stored, so
          // a later change of rate never alters what was paid.
          let fx = currency === 'GHS' ? 1 : Number(merged.fxRate)
          if (!(fx > 0)) {
            const r = await rateFor(req, currency)
            if (!r) throw new APIError(`There is no rate for ${currency} in Team money settings.`, 400)
            fx = r
          }
          data.amountGHSMinor = ghs
          data.fxRate = fx
          data.amountLocalMinor = ghsToLocalMinor(ghs, fx, currency)
        } else if (merged.type === 'allowance') {
          const month = String(merged.periodMonth || day.slice(0, 7))
          if (!/^\d{4}-\d{2}$/.test(month)) throw new APIError('The allowance month is written like 2026-10.', 400)
          data.periodMonth = month
          const previous = await req.payload.find({
            collection: 'payouts',
            where: {
              and: [
                { user: { equals: userId } },
                { type: { equals: 'allowance' } },
                ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
                { paidAt: { less_than: day } },
              ],
            },
            sort: '-paidAt',
            limit: 1,
            depth: 0,
            overrideAccess: true,
            req,
          })
          const since = previous.docs[0]?.paidAt
          const reports = since
            ? await req.payload.count({
                collection: 'daily-reports',
                where: { and: [{ user: { equals: userId } }, { submittedAt: { greater_than: since } }, { submittedAt: { less_than_equal: new Date(day).toISOString() } }] },
                overrideAccess: true,
                req,
              })
            : { totalDocs: 0 }
          const needed = Number(terms?.dataAllowance?.reportsNeeded ?? 18)
          data.reportsSinceLastPayment = reports.totalDocs
          data.reportsNeeded = needed
          data.eligible = allowanceEligible({ isFirst: !since, reportsSince: reports.totalDocs, reportsNeeded: needed })
          if (!data.eligible && !merged.overrideReason) {
            throw new APIError(`Not due: ${reports.totalDocs} of ${needed} daily reports since the last allowance. To pay it anyway, give a reason.`, 400)
          }
          const amount = Number(merged.amountLocalMinor) || Number(terms?.dataAllowance?.amountMinor) || 0
          if (!amount) throw new APIError('Their terms set no data allowance. Enter the amount.', 400)
          data.amountLocalMinor = amount
        } else if (merged.type === 'salary') {
          if (!person.salaryStartDate) throw new APIError(`${person.name || person.email}’s salary has not started. Set the start date on their page first.`, 400)
          data.periodMonth = String(merged.periodMonth || day.slice(0, 7))
          const amount = Number(merged.amountLocalMinor) || Number(terms?.salary?.amountMinor) || 0
          if (!amount) throw new APIError('Their terms set no salary. Enter the amount.', 400)
          data.amountLocalMinor = amount
        } else if (merged.type === 'expense') {
          const ids = (Array.isArray(merged.expenseClaims) ? merged.expenseClaims : []).map(refId).filter(Boolean) as number[]
          if (!ids.length) throw new APIError('Choose the approved expense claims this pays.', 400)
          const claims = await req.payload.find({ collection: 'expense-claims', where: { id: { in: ids } }, limit: ids.length, depth: 0, overrideAccess: true, req })
          for (const c of claims.docs) {
            if (refId(c.user) !== userId) throw new APIError(`"${c.title}" is not ${person.name || person.email}’s claim.`, 400)
            if (c.status !== 'approved' && refId(c.payout) !== Number(originalDoc?.id)) throw new APIError(`"${c.title}" is not approved, or is already paid.`, 400)
          }
          data.amountLocalMinor = claims.docs.reduce((n, c) => n + Number(c.amountMinor || 0), 0)
        } else if (!(Number(merged.amountLocalMinor) > 0)) {
          throw new APIError('Enter the amount paid.', 400)
        }
        if (merged.type !== 'commission') {
          // Every payout also keeps its GH₵ value at that day's rate, so the
          // team's cost adds up in one currency (spec 14.7).
          let fx = currency === 'GHS' ? 1 : Number(merged.fxRate)
          if (!(fx > 0)) {
            const r = await rateFor(req, currency)
            if (!r) throw new APIError(`There is no rate for ${currency} in Team money settings.`, 400)
            fx = r
          }
          data.fxRate = fx
          data.amountGHSMinor = toGHSMinor(Number(data.amountLocalMinor ?? merged.amountLocalMinor), fx)
        }
        data.termsUsed = terms?.id ?? null
        data.title = `${TYPE_TEXT[merged.type] ?? 'Payout'} · ${person.name || person.email} · ${day.slice(0, 10)}`
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return doc
        // Mark what this payout settles.
        for (const id of (doc.clientPayments ?? []).map(refId).filter(Boolean)) {
          await req.payload.db.updateOne({ collection: 'client-payments', id, data: { payout: doc.id }, returning: false, req })
        }
        for (const id of (doc.expenseClaims ?? []).map(refId).filter(Boolean)) {
          await req.payload.db.updateOne({ collection: 'expense-claims', id, data: { payout: doc.id, status: 'paid' }, returning: false, req })
        }
        const person = await userById(req, refId(doc.user))
        const amount = `${doc.currency} ${(doc.amountLocalMinor / 100).toLocaleString('en-GB')}`
        await audit(req, {
          action: `payout.${doc.type}`,
          summary: `Paid ${person?.name || person?.email}: ${TYPE_TEXT[doc.type]?.toLowerCase()} ${amount}`,
          person: refId(doc.user),
          subjectType: 'payouts',
          subjectId: doc.id,
          reason: doc.overrideReason || doc.note,
          changes: [
            { field: 'Amount', from: '-', to: amount },
            ...(doc.amountGHSMinor ? [{ field: 'In GH₵', from: '-', to: `GH₵${(doc.amountGHSMinor / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })} at ${doc.fxRate}` }] : []),
          ],
        })
        await notify(req, {
          to: [refId(doc.user)],
          kind: 'payout',
          title: `Paid: ${TYPE_TEXT[doc.type]?.toLowerCase()} ${amount}`,
          body: doc.method === 'grey' && person?.greytag ? `Sent to ${person.greytag} on Grey.` : undefined,
          link: '/money',
          action: 'Open Money',
        })
        return doc
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', admin: { hidden: true } },
    {
      type: 'row',
      fields: [
        { name: 'user', label: 'Paid to', type: 'relationship', relationTo: 'users', required: true, index: true, filterOptions: { role: { equals: 'team' } }, admin: { width: '50%' } },
        { name: 'type', type: 'select', required: true, index: true, options: TYPES, admin: { width: '50%' } },
      ],
    },
    { name: 'clientPayments', label: 'Commission on', type: 'relationship', relationTo: 'client-payments', hasMany: true, admin: { condition: (d) => d?.type === 'commission' } },
    { name: 'expenseClaims', label: 'Expense claims', type: 'relationship', relationTo: 'expense-claims', hasMany: true, admin: { condition: (d) => d?.type === 'expense' } },
    {
      type: 'row',
      admin: { condition: (d) => d?.type === 'allowance' || d?.type === 'salary' },
      fields: [
        { name: 'periodMonth', label: 'For month', type: 'text', admin: { width: '34%', description: 'Like 2026-10.' } },
        { name: 'reportsSinceLastPayment', label: 'Reports since last allowance', type: 'number', admin: { width: '22%', readOnly: true } },
        { name: 'reportsNeeded', label: 'Needed', type: 'number', admin: { width: '22%', readOnly: true } },
        { name: 'eligible', type: 'checkbox', admin: { width: '22%', readOnly: true } },
      ],
    },
    { name: 'overrideReason', label: 'Paid although not due, because', type: 'text', admin: { condition: (d) => d?.type === 'allowance' } },
    {
      type: 'row',
      fields: [
        { name: 'currency', type: 'select', options: currencyOptions, admin: { width: '25%' } },
        { name: 'amountLocalMinor', label: 'Amount (minor units)', type: 'number', admin: { width: '25%' } },
        { name: 'amountGHSMinor', label: 'In GH₵ (pesewas)', type: 'number', admin: { width: '25%', readOnly: true } },
        { name: 'fxRate', label: 'Rate used: units for GH₵1', type: 'number', admin: { width: '25%', step: 0.0001 } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'paidAt', label: 'Paid on', type: 'date', required: true, index: true, admin: { width: '25%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
        {
          name: 'method',
          type: 'select',
          defaultValue: 'grey',
          options: [
            { label: 'Grey', value: 'grey' },
            { label: 'Bank', value: 'bank' },
            { label: 'Mobile money', value: 'mobile-money' },
            { label: 'Cash', value: 'cash' },
          ],
          admin: { width: '25%' },
        },
        { name: 'reference', type: 'text', admin: { width: '25%' } },
        { name: 'greyFeeGHSMinor', label: 'Grey fee (pesewas)', type: 'number', admin: { width: '25%' } },
      ],
    },
    { name: 'advanceRepaidMinor', label: 'Advance deducted from this payout (minor units)', type: 'number', admin: { description: 'Part of an earlier advance taken back from this payment.' } },
    { name: 'note', type: 'textarea' },
    { name: 'costSheets', label: 'Cost sheets', type: 'relationship', relationTo: 'documents', hasMany: true, admin: { condition: (d) => d?.type === 'commission' } },
    { name: 'termsUsed', label: 'Terms used', type: 'relationship', relationTo: 'member-terms', admin: { readOnly: true } },
  ],
}
