import { APIError, type CollectionConfig } from 'payload'
import { invoiceCurrencyFor } from '../lib/markets.js'
import { adminOrSite, isAdmin } from '../access/roles'
import { updatedByField } from '../fields/updatedBy'
import { queueInvoicePayment } from '../lib/invoicePayments'
import { invoiceAccess, invoiceDeskEndpoints } from '../lib/invoiceDesk'
import { totalMinor } from '../lib/invoiceCorrection'

export const Invoices: CollectionConfig = {
  slug: 'invoices',
  labels: { singular: 'Invoice', plural: 'Invoices' },
  admin: {
    group: 'CRM & Sales',
    useAsTitle: 'invoiceId',
    components: {
      edit: {
        SaveButton: './components/RedirectAfterSave#SaveAndRedirectButton',
      },
    },
  },
  access: {
    // A draft is Ernest's alone: the website reads and settles issued invoices
    // only, so a draft never reaches the client's portal, its link or the
    // overdue reminders (lib/invoiceDesk.ts).
    read: invoiceAccess,
    create: adminOrSite,
    update: invoiceAccess,
    delete: invoiceAccess,
    // Version history holds every past copy of every record. Admin only.
    readVersions: isAdmin,
  },
  /**
   * History, not drafts. Saving still takes effect immediately, exactly as
   * before, and there is no Save Draft button: `drafts` is deliberately not
   * set. What this adds is a Versions tab recording who changed what and when,
   * and the ability to restore a previous state.
   *
   * This collection is the reason the other two got it. An invoice total could
   * be edited with no trace, and the settlement path compares Paystack against
   * `amountMinor`, so changing a line item silently changes what counts as paid.
   *
   * `maxPerDoc` is bounded because the overdue reminder cron writes to invoices
   * on a schedule, and each write is a version. Fifty is roughly a year of
   * reminders plus normal editing before the oldest entries roll off.
   */
  versions: { maxPerDoc: 50 },
  // The founder portal: a draft filled in from what was agreed, and sending it.
  endpoints: invoiceDeskEndpoints,
  hooks: {
    /*
      Bill people in the money the site quoted them in.

      The site prices every visitor by country: Africa reads the cedi list,
      everyone else the dollar list, and both are converted into whatever that
      country actually spends (src/lib/markets.js). The invoice that followed
      the sale ignored every bit of that and defaulted to USD, so a client in
      Accra could read GH₵ 2,500, agree to it, and receive a dollar invoice for
      a number that had never been discussed.

      This fills the currency in FROM THE CLIENT'S COUNTRY, once, when the
      invoice is created and nobody has chosen one. It never overwrites a
      currency somebody set, and it never touches an existing invoice, because
      changing the currency of an invoice that has already been sent or paid
      would silently change what "paid in full" means: settlement compares
      Paystack against amountMinor, and amountMinor carries no currency of its
      own.

      invoiceCurrencyFor is the same function the website calls to write "All
      prices in naira, at today's rate. Invoiced in cedis." under every price
      grid. They must agree, so they are one function; a client in Kampala is
      quoted in shillings and invoiced in cedis because Paystack cannot settle
      Ugandan shillings, and both halves of the site say so.
    */
    // Paystack payments become client payments, through the job queue (lib/invoicePayments.ts).
    afterChange: [queueInvoicePayment],
    beforeChange: [
      async ({ data, operation, req, originalDoc }) => {
        if (operation !== 'create') return data
        if (data?.currency) return data

        const clientId = typeof data?.client === 'object' ? data?.client?.id : data?.client
        if (!clientId) return data

        try {
          const client = await req.payload.findByID({
            collection: 'clients',
            id: clientId,
            depth: 0,
            req,
          })
          const country = (client as { country?: string })?.country
          const agreed = (client as { currency?: string })?.currency
          if (agreed) data.currency = agreed
          else if (country) data.currency = invoiceCurrencyFor(country)
        } catch (err) {
          /* A lookup failure must not stop an invoice being written. The field's
             own default of USD stands, which is the behaviour that existed
             before this hook, so the worst case is what used to always happen. */
          req.payload.logger.warn(
            `[invoices] could not read client ${clientId} for currency; leaving the default. ${String(err)}`,
          )
        }
        return data
      },
      /*
        Once money has come in, what the invoice asks for is fixed, except by a
        correction from the portal (POST /api/invoices/:id/correct), which keeps
        a reason, never asks for less than was paid and works the status out
        again. Saving a part-paid invoice here used to recalculate its total but
        not its status, so it could read Paid while asking for more. Payments
        change no line, so Paystack and the Payments desk still save.
      */
      ({ data, operation, originalDoc, req }) => {
        if (operation !== 'update' || req.context?.invoiceCorrection) return data
        if (!((Number(originalDoc?.amountPaidMinor) || 0) > 0)) return data
        const was = totalMinor(originalDoc?.items ?? [], originalDoc?.taxRate)
        const now = totalMinor(data?.items ?? originalDoc?.items ?? [], data?.taxRate ?? originalDoc?.taxRate)
        const deposit = (v: unknown) => Number(v) || 0
        const otherMoney = data?.currency && originalDoc?.currency && String(data.currency).trim().toUpperCase() !== String(originalDoc.currency).trim().toUpperCase()
        if (now !== was || deposit(data?.depositPercent ?? originalDoc?.depositPercent) !== deposit(originalDoc?.depositPercent) || otherMoney) {
          throw new APIError('Money has come in against this invoice, so its amounts, deposit and currency are fixed here. Correct it in the team portal (Invoices, Correct this invoice), which keeps the reason.', 400, null, true)
        }
        return data
      },
    ],
  },
  fields: [
    updatedByField(),
    {
      name: 'invoiceId',
      label: 'Invoice ID',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description:
          'Left blank on a new invoice, it numbers itself as QD-<year>-0001. Type your own to override it.',
      },
      hooks: {
        /*
          Number it, because something other than a person now creates invoices.

          This was a required free text field, which was workable while every
          invoice was typed by hand and impossible the moment provisioning a
          proposal had to raise one: there is nothing sensible for code to
          invent, and a duplicate is refused by the unique index.

          Reads the highest existing number for this year and adds one. Padded
          to four digits so the sort stays honest, and scoped to the year so the
          count restarts each January rather than running for ever.

          Two invoices created in the same second could read the same highest
          number and collide, and the second would fail on the unique index
          rather than quietly reusing it. With one person and one provisioning
          button that is not a real sequence of events, and a loud failure is
          the right one anyway.
        */
        beforeValidate: [
          async ({ value, req, operation }) => {
            if (value) return value
            if (operation !== 'create') return value

            const prefix = `QD-${new Date().getFullYear()}-`
            try {
              const latest = await req.payload.find({
                collection: 'invoices',
                where: { invoiceId: { like: prefix } },
                sort: '-invoiceId',
                limit: 1,
                depth: 0,
                req,
              })
              const last = String(latest.docs[0]?.invoiceId || '')
              const n = Number(last.slice(prefix.length)) || 0
              return `${prefix}${String(n + 1).padStart(4, '0')}`
            } catch (err) {
              req.payload.logger.error({ err }, '[invoices] could not work out the next number')
              return value
            }
          },
        ],
      },
    },
    { name: 'client', label: 'Client', type: 'relationship', relationTo: 'clients', required: true },
    { name: 'deal', label: 'Deal', type: 'relationship', relationTo: 'proposals', index: true, admin: { position: 'sidebar', description: 'The deal this bills. A retainer’s monthly invoices all point at the same deal.' } },
    { name: 'dateIssued', label: 'Date Issued', type: 'date', defaultValue: () => new Date().toISOString() },
    {
      name: 'issuedAt',
      label: 'Sent to the client',
      type: 'date',
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description:
          'Set when the invoice is sent from the team portal. Until then it is a draft: the client, their invoice link and the overdue reminders do not see it.',
      },
    },
    { name: 'lastSentAt', label: 'Last emailed', type: 'date', admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } } },
    {
      name: 'draftNote',
      label: 'Where the draft came from',
      type: 'text',
      admin: { readOnly: true, position: 'sidebar', description: 'Written when the draft is filled in; cleared when it is sent.' },
    },
    { name: 'dueDate', label: 'Due Date', type: 'date' },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Overdue', value: 'overdue' }
      ]
    },
    {
      name: 'currency',
      label: 'Currency',
      type: 'text',
      defaultValue: 'USD',
      // Kept as text (not a select) so no Postgres enum type is involved.
      // Validated because Paystack matches the currency case-sensitively and
      // settlement refuses to mark an invoice paid on a mismatch.
      //
      // Filled in from the client's country by the beforeChange hook above when
      // a new invoice does not name one. The list below is what Paystack can
      // settle, and it is the same list invoiceCurrencyFor() checks against, so
      // a country whose money is not on it is billed in its market's base
      // currency rather than in something that cannot be collected.
      validate: (value: unknown) => {
        if (!value) return true
        const supported = ['GHS', 'USD', 'NGN', 'ZAR', 'KES', 'EUR', 'GBP']
        return supported.includes(String(value).toUpperCase())
          ? true
          : `Currency must be one of: ${supported.join(', ')}`
      },
      hooks: {
        beforeChange: [({ value }) => (value ? String(value).trim().toUpperCase() : 'USD')],
      },
    },
    { name: 'taxRate', label: 'Tax Rate (%)', type: 'number', defaultValue: 0 },
    {
      name: 'items',
      label: 'Line Items',
      type: 'array',
      fields: [
        { name: 'description', label: 'Description', type: 'text', required: true },
        { name: 'quantity', label: 'Quantity', type: 'number', required: true, defaultValue: 1 },
        { name: 'rate', label: 'Rate (Amount)', type: 'number', required: true }
      ]
    },

    /* ── Payment + access, all machine-managed ──────────────────────────────
       These are written by the settlement path and the invoice link builder,
       never by hand. See migration 20260811_000000_add_invoice_payment_fields. */
    {
      name: 'accessToken',
      label: 'Access Token',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Auto-generated. Forms part of the invoice link; without it the page 404s.',
        // Hidden behind an eye here and in Versions, and kept out of the
        // list's columns. See lib/passwordReveal.ts.
        className: 'qd-secret',
        disableListColumn: true,
        components: { Diff: './components/SecretDiff#SecretDiff' },
      },
      hooks: {
        beforeChange: [({ value }) => value || `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')],
      },
    },
    {
      name: 'tokenIssuedAt',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar', hidden: true },
    },
    {
      name: 'amountMinor',
      label: 'Amount (minor units)',
      type: 'number',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description:
          'Authoritative total in minor units (e.g. pesewas). Recomputed on save; settlement compares Paystack against this, never against a figure from the browser.',
      },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            const items = (siblingData?.items ?? []) as { rate?: number; quantity?: number }[]
            const subtotal = items.reduce(
              (acc, i) => acc + Number(i?.rate ?? 0) * Number(i?.quantity ?? 0),
              0,
            )
            const total = subtotal * (1 + Number(siblingData?.taxRate ?? 0) / 100)
            return Math.round(total * 100)
          },
        ],
      },
    },
    {
      name: 'depositPercent',
      label: 'Deposit Required (%)',
      type: 'number',
      defaultValue: 0,
      min: 0,
      max: 100,
      admin: {
        description:
          'Set to e.g. 50 to let the client pay half now and the balance later. Leave at 0 to require the full amount up front.',
      },
    },
    {
      name: 'depositMinor',
      label: 'Deposit (minor units)',
      type: 'number',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'What a deposit payment must cover. Stored, not recomputed at payment time, so the figure the client was shown is the figure we check.',
      },
      hooks: {
        beforeChange: [
          ({ siblingData, originalDoc, context }) => {
            const items = (siblingData?.items ?? []) as { rate?: number; quantity?: number }[]
            const subtotal = items.reduce(
              (acc, i) => acc + Number(i?.rate ?? 0) * Number(i?.quantity ?? 0),
              0,
            )
            const total = subtotal * (1 + Number(siblingData?.taxRate ?? 0) / 100)
            // A correction after money came in keeps the deposit the client was shown (lib/invoiceCorrection.ts).
            if (context?.invoiceCorrection && Number(originalDoc?.amountPaidMinor) > 0) return Math.min(Number(originalDoc?.depositMinor) || 0, Math.round(total * 100))
            const pct = Number(siblingData?.depositPercent ?? 0)
            if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) return 0
            return Math.round(total * 100 * (pct / 100))
          },
        ],
      },
    },
    {
      name: 'amountPaidMinor',
      label: 'Collected so far (minor units)',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Running total actually received. The invoice flips to Paid only once this covers the full amount.',
      },
    },
    { name: 'paidAt', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
    {
      name: 'paystackReference',
      label: 'Paystack Reference',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Idempotency key. A reference can settle exactly one invoice, once.',
      },
    },
    {
      name: 'paystackAmountMinor',
      type: 'number',
      admin: { readOnly: true, position: 'sidebar', description: 'What Paystack actually collected.' },
    },
    { name: 'paystackStatus', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
    {
      name: 'balanceReference',
      label: 'Balance Paystack Reference',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Second payment, when a deposit was taken first. Unique, so a reference settles once.',
      },
    },
    { name: 'balanceAmountMinor', type: 'number', admin: { readOnly: true, position: 'sidebar' } },
    {
      name: 'lastReminderAt',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar', description: 'Last overdue reminder sent.' },
    },
    {
      name: 'reminderCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true, position: 'sidebar', description: 'Reminders sent (day 3, 7, 14).' },
    },
  ]
}
