import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { adminOrMine, isAdmin } from '../access/roles'
import { currencyOptions } from '../fields/terms'
import { audit } from '../lib/audit'
import { commission, commissionState, dueDate, ghsToLocalMinor, toGHSMinor } from '../lib/money'
import { moneySettings, rateFor, refId, termsOn, userById } from '../lib/moneyContext'
import { adminIds, notify } from '../lib/notify'

/**
 * Money a client actually paid (spec 5.2), and the commission it earns.
 *
 * One record per payment, with the allowed costs and their receipts. On every
 * save the CMS works out, from the deal and the credited person's terms in
 * force on the day the money cleared (lib/money.ts):
 *   net profit = amount in GH₵ − costs
 *   commission = net profit × the rate those terms give, due seven days later.
 *
 * Paystack payments are recorded automatically from the invoice
 * (lib/invoicePayments.ts). Bank, Grey, mobile money and cash are entered by
 * Ernest, and add themselves to the invoice's amount paid.
 *
 * A refund is a payment with a negative amount, linked to the payment it
 * refunds; its commission is negative and comes off the next payout.
 *
 * Every version is kept (`maxPerDoc: 0`), and once a payment's commission has
 * been paid out its figures are locked.
 */

export const COST_CATEGORIES = [
  { label: 'Advertising budget spent for the client', value: 'advertising' },
  { label: 'Hosting and domain', value: 'hosting' },
  { label: 'Outsourced production or freelancers', value: 'outsourced' },
  { label: 'Software bought for the client', value: 'software' },
  { label: 'Payment and transfer fees', value: 'fees' },
]

const LOCKED = ['amountMinor', 'currency', 'fxToGHS', 'clearedAt', 'deal', 'invoice', 'costs', 'refundOf']

export const ClientPayments: CollectionConfig = {
  slug: 'client-payments',
  labels: { singular: 'Client payment', plural: 'Client payments' },
  admin: {
    group: 'Team',
    useAsTitle: 'title',
    defaultColumns: ['title', 'creditTo', 'commissionGHSMinor', 'commissionDueAt', 'clearedAt'],
    description: 'Money clients paid, with the allowed costs and the commission each one earns.',
  },
  defaultSort: '-clearedAt',
  versions: { maxPerDoc: 0 },
  access: {
    read: adminOrMine('creditTo'),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
    readVersions: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req, context }) => {
        if (operation === 'update' && originalDoc?.payout && !context?.fromPayout) {
          for (const k of LOCKED) {
            if (k in data && JSON.stringify(data[k] ?? null) !== JSON.stringify(originalDoc[k] ?? null)) {
              throw new APIError('This commission has been paid out, so the payment is locked. Record a refund or a correction instead.', 400)
            }
          }
        }
        const merged: Record<string, any> = { ...(originalDoc ?? {}), ...data }
        const amount = Number(merged.amountMinor)
        if (!Number.isFinite(amount) || amount === 0) throw new APIError('Enter the amount the client paid.', 400)
        if (!merged.clearedAt) throw new APIError('Enter the day the money cleared.', 400)
        if (amount < 0 && !refId(merged.refundOf)) throw new APIError('A refund must say which payment it refunds.', 400)

        // Where the money belongs: the invoice tells us the deal and client.
        const invoice = refId(merged.invoice)
          ? await req.payload.findByID({ collection: 'invoices', id: refId(merged.invoice)!, depth: 0, overrideAccess: true, req }).catch(() => null)
          : null
        if (invoice) {
          if (!refId(merged.deal) && invoice.deal) data.deal = merged.deal = refId(invoice.deal)
          data.client = merged.client = refId(invoice.client)
          if (!merged.currency) data.currency = merged.currency = invoice.currency
        }
        const deal = refId(merged.deal)
          ? await req.payload.findByID({ collection: 'proposals', id: refId(merged.deal)!, depth: 0, overrideAccess: true, req }).catch(() => null)
          : null
        if (refId(merged.deal) && !deal) throw new APIError('That deal is not there.', 400)
        if (deal) {
          if (!deal.acceptedAt) throw new APIError('Mark the deal accepted first, with the day the client agreed. A payment cannot be recorded before that.', 400)
          if (!merged.client && deal.client) data.client = merged.client = refId(deal.client)
          data.creditTo = refId(deal.creditTo)
          data.creditType = deal.creditType ?? null
        } else {
          data.creditTo = null
          data.creditType = null
        }
        if (!merged.client && !deal && !invoice) throw new APIError('Say which invoice, deal or client the money is for.', 400)

        // Into cedis, at the rate given or today's rate from Team money settings.
        data.currency = merged.currency = String(merged.currency ?? 'GHS').toUpperCase()
        let fx = Number(merged.fxToGHS)
        if (merged.currency === 'GHS') fx = 1
        else if (!(fx > 0)) {
          const r = await rateFor(req, merged.currency)
          if (!r) throw new APIError(`There is no rate for ${merged.currency} in Team money settings. Add one, or enter the rate used.`, 400)
          fx = r
        }
        data.fxToGHS = fx
        data.amountGHSMinor = toGHSMinor(amount, fx)

        // Which month of a retainer this pays for.
        let retainerMonth = 1
        const refundOf = refId(merged.refundOf)
          ? await req.payload.findByID({ collection: 'client-payments', id: refId(merged.refundOf)!, depth: 0, overrideAccess: true, req }).catch(() => null)
          : null
        if (refundOf) retainerMonth = Number(refundOf.retainerMonth) || 1
        else if (deal?.recurring) {
          const earlier = await req.payload.find({
            collection: 'client-payments',
            where: {
              and: [
                { deal: { equals: deal.id } },
                { amountMinor: { greater_than: 0 } },
                { clearedAt: { less_than_equal: merged.clearedAt } },
                ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
              ],
            },
            limit: 500,
            depth: 0,
            overrideAccess: true,
            req,
          })
          retainerMonth = earlier.totalDocs + 1
        }
        data.retainerMonth = retainerMonth

        // The commission, by the credited person's terms on the day the money cleared.
        const costs = Array.isArray(merged.costs) ? merged.costs : []
        for (const c of costs) {
          if (!(Number(c?.amountGHSMinor) > 0)) throw new APIError('Each cost needs an amount.', 400)
          if (!refId(c?.receipt)) throw new APIError('Each cost needs its receipt (Agreement §6).', 400)
        }
        const costsGHSMinor = costs.reduce((n: number, c: any) => n + Number(c.amountGHSMinor || 0), 0)
        const creditTo = refId(data.creditTo)
        const person = await userById(req, creditTo)
        const day = String(merged.clearedAt)
        const terms = creditTo ? await termsOn(req, creditTo, day) : null
        let exit = null
        if (person?.endedAt && deal) {
          const lead = refId(deal.lead)
            ? await req.payload.findByID({ collection: 'leads', id: refId(deal.lead)!, depth: 0, overrideAccess: true, req }).catch(() => null)
            : null
          const first = await req.payload.find({
            collection: 'client-payments',
            where: { and: [{ deal: { equals: deal.id } }, { amountMinor: { greater_than: 0 } }] },
            sort: 'clearedAt',
            limit: 1,
            depth: 0,
            overrideAccess: true,
            req,
          })
          const leadDate = lead?.assignedAt || lead?.loggedAt
          exit = {
            endedAt: person.endedAt,
            clearedAt: day,
            leadBeforeEnd: Boolean(leadDate && leadDate <= person.endedAt),
            acceptedAt: deal.acceptedAt,
            firstPaymentAt: first.docs[0]?.clearedAt ?? day,
          }
        }
        const result = commission({
          amountGHSMinor: data.amountGHSMinor,
          costsGHSMinor,
          credited: Boolean(creditTo),
          recurring: Boolean(deal?.recurring),
          retainerMonth,
          startedAfterSalary: Boolean(deal?.startedAfterSalary),
          terms: terms?.commission,
          exit,
        })
        data.costsGHSMinor = costsGHSMinor
        data.netGHSMinor = result.netGHSMinor
        data.commissionRate = result.rateText
        data.commissionReason = result.reason
        data.commissionGHSMinor = result.commissionGHSMinor
        data.termsUsed = terms?.id ?? null
        const settings = await moneySettings(req)
        data.commissionDueAt = result.commissionGHSMinor ? dueDate(day, settings.commissionDueDays) : null
        data.title = `${deal?.clientName || invoice?.invoiceId || 'Payment'} · ${merged.currency} ${(amount / 100).toLocaleString('en-GB')} · ${day.slice(0, 10)}`
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req, context }) => {
        if (operation !== 'create' || context?.fromInvoice) return doc
        // A payment Ernest records by hand also counts on its invoice.
        const invoiceId = refId(doc.invoice)
        if (invoiceId && doc.method !== 'paystack' && doc.amountMinor > 0) {
          const invoice = await req.payload.findByID({ collection: 'invoices', id: invoiceId, depth: 0, overrideAccess: true, req }).catch(() => null)
          if (invoice && String(invoice.currency).toUpperCase() === doc.currency) {
            const paid = (Number(invoice.amountPaidMinor) || 0) + doc.amountMinor
            const settled = paid >= Number(invoice.amountMinor || 0)
            await req.payload.update({
              collection: 'invoices',
              id: invoiceId,
              data: { amountPaidMinor: paid, ...(settled ? { status: 'paid', paidAt: doc.clearedAt } : {}) } as never,
              context: { fromClientPayment: true },
              overrideAccess: true,
              req,
            })
          }
        }
        const creditTo = refId(doc.creditTo)
        const person = await userById(req, creditTo)
        const ghs = `GH₵${(doc.commissionGHSMinor / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
        await audit(req, {
          action: doc.amountMinor < 0 ? 'payment.refund' : 'payment.recorded',
          summary: `${doc.amountMinor < 0 ? 'Refund' : 'Payment'} recorded: ${doc.title}`,
          person: creditTo,
          subjectType: 'client-payments',
          subjectId: doc.id,
          changes: [
            { field: 'Net profit', from: '-', to: `GH₵${(doc.netGHSMinor / 100).toLocaleString('en-GB')}` },
            { field: 'Commission', from: '-', to: `${ghs} at ${doc.commissionRate}` },
          ],
        })
        if (doc.commissionGHSMinor > 0 && person) {
          const due = new Date(doc.commissionDueAt).toDateString()
          await notify(req, {
            to: await adminIds(req),
            kind: 'commission-due',
            title: `Commission due by ${due}: ${ghs} to ${person.name || person.email}`,
            body: doc.commissionReason,
            link: '/payments',
            email: false,
          })
          const cur = person.currency || 'GHS'
          const rate = (await rateFor(req, cur)) ?? null
          const local = rate ? ghsToLocalMinor(doc.commissionGHSMinor, rate, cur) : null
          await notify(req, {
            to: [person.id],
            kind: 'commission-earned',
            title: `A client paid. Your commission: ${local !== null && cur !== 'GHS' ? `${cur} ${(local / 100).toLocaleString('en-GB')} (${ghs})` : ghs}`,
            body: `Due by ${due}. ${doc.commissionReason}.`,
            link: '/money',
            action: 'Open Money',
          })
        }
        return doc
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', admin: { hidden: true } },
    {
      type: 'row',
      fields: [
        { name: 'invoice', type: 'relationship', relationTo: 'invoices', index: true, admin: { width: '34%' } },
        { name: 'deal', type: 'relationship', relationTo: 'proposals', index: true, admin: { width: '33%', description: 'Filled in from the invoice.' } },
        { name: 'client', type: 'relationship', relationTo: 'clients', index: true, admin: { width: '33%', readOnly: true } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'clearedAt', label: 'Cleared on', type: 'date', required: true, index: true, admin: { width: '34%', date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
        {
          name: 'method',
          type: 'select',
          required: true,
          defaultValue: 'bank',
          options: [
            { label: 'Paystack', value: 'paystack' },
            { label: 'Bank', value: 'bank' },
            { label: 'Grey', value: 'grey' },
            { label: 'Mobile money', value: 'mobile-money' },
            { label: 'Cash', value: 'cash' },
          ],
          admin: { width: '33%' },
        },
        { name: 'reference', type: 'text', index: true, admin: { width: '33%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'currency', type: 'select', required: true, defaultValue: 'GHS', options: currencyOptions, admin: { width: '25%' } },
        { name: 'amountMinor', label: 'Amount (minor units)', type: 'number', required: true, admin: { width: '25%', description: 'As paid. Negative for a refund.' } },
        { name: 'fxToGHS', label: 'Rate: units for GH₵1', type: 'number', admin: { width: '25%', step: 0.0001, description: 'Empty: today’s rate.' } },
        { name: 'amountGHSMinor', label: 'In GH₵ (pesewas)', type: 'number', admin: { width: '25%', readOnly: true } },
      ],
    },
    { name: 'refundOf', label: 'Refunds', type: 'relationship', relationTo: 'client-payments', admin: { condition: (d) => Number(d?.amountMinor) < 0 } },
    {
      name: 'costs',
      label: 'Allowed costs',
      type: 'array',
      admin: { description: 'Only these five kinds of cost exist (Agreement §6). Ernest’s own time is never a cost. Each needs its receipt.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'category', type: 'select', required: true, options: COST_CATEGORIES, admin: { width: '40%' } },
            { name: 'amountGHSMinor', label: 'GH₵ (pesewas)', type: 'number', required: true, min: 1, admin: { width: '20%' } },
            { name: 'receipt', type: 'relationship', relationTo: 'documents', admin: { width: '40%' } },
          ],
        },
        { name: 'note', type: 'text' },
      ],
    },
    { name: 'notes', type: 'textarea' },
    // Worked out by the CMS on every save.
    {
      type: 'row',
      fields: [
        { name: 'retainerMonth', label: 'Retainer month', type: 'number', admin: { readOnly: true, width: '25%' } },
        { name: 'costsGHSMinor', label: 'Costs (pesewas)', type: 'number', admin: { readOnly: true, width: '25%' } },
        { name: 'netGHSMinor', label: 'Net profit (pesewas)', type: 'number', admin: { readOnly: true, width: '25%' } },
        { name: 'commissionRate', label: 'Rate', type: 'text', admin: { readOnly: true, width: '25%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'commissionGHSMinor', label: 'Commission (pesewas)', type: 'number', index: true, admin: { readOnly: true, width: '34%' } },
        { name: 'commissionDueAt', label: 'Due by', type: 'date', index: true, admin: { readOnly: true, width: '33%' } },
        {
          name: 'commissionStatus',
          label: 'Commission',
          type: 'text',
          virtual: true,
          admin: { readOnly: true, width: '33%' },
          hooks: { afterRead: [({ siblingData }) => commissionState(siblingData ?? {})] },
        },
      ],
    },
    { name: 'commissionReason', label: 'Why that rate', type: 'text', admin: { readOnly: true } },
    {
      type: 'row',
      fields: [
        { name: 'creditTo', label: 'Credited to', type: 'relationship', relationTo: 'users', index: true, admin: { readOnly: true, width: '34%' } },
        {
          name: 'creditType',
          label: 'Credit',
          type: 'select',
          options: [
            { label: 'Sourced', value: 'sourced' },
            { label: 'Handed over', value: 'handed' },
          ],
          admin: { readOnly: true, width: '33%' },
        },
        { name: 'payout', label: 'Paid in', type: 'relationship', relationTo: 'payouts', index: true, admin: { readOnly: true, width: '33%' } },
      ],
    },
    { name: 'termsUsed', label: 'Terms used', type: 'relationship', relationTo: 'member-terms', admin: { readOnly: true } },
  ],
}
