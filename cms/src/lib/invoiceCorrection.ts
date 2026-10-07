/*
  Correcting an invoice once money has come in against it (POST
  /api/invoices/:id/correct, lib/invoiceDesk.ts). Pure, so the rules are tested
  on their own.

  What was paid is fixed: the currency, the amount collected, the Paystack
  references and the deposit never change here, because settlement, the
  overdue reminders and commission all read them. What can change is what the
  invoice says it is for, its amounts and its due date, within two limits:
  it can never ask for less than has been paid (that is a refund, recorded on
  Payments), and a paid invoice cannot ask for more (that is a new invoice for
  the difference, so the paid one stays paid).
*/

export type Line = { description: string; quantity: number; rate: number }

const DAY = 86_400_000

/** The total in minor units, exactly as the invoice's own field hook works it out. */
export const totalMinor = (items: { quantity?: number | null; rate?: number | null }[], taxRate = 0) =>
  Math.round(items.reduce((n, i) => n + Number(i?.rate ?? 0) * Number(i?.quantity ?? 0), 0) * (1 + (Number(taxRate) || 0) / 100) * 100)

export type CorrectionInput = {
  invoice: { amountMinor?: number | null; amountPaidMinor?: number | null; status?: string | null; issuedAt?: string | null; paidAt?: string | null }
  items: unknown
  taxRate?: unknown
  dueDate?: unknown
  reason?: unknown
  fmt: (minor: number) => string
  now?: number
}

export type Correction =
  | { error: string }
  | { items: Line[]; taxRate: number; dueDate: string | null; totalMinor: number; status: 'paid' | 'pending' | 'overdue'; paidAt: string | null; reason: string }

export function correction({ invoice, items, taxRate, dueDate, reason, fmt, now = Date.now() }: CorrectionInput): Correction {
  if (!invoice.issuedAt) return { error: 'This invoice has not been sent. Change it as a draft.' }
  const why = String(reason ?? '').trim()
  if (!why) return { error: 'Say why it is being corrected. It is kept with the invoice.' }
  const lines = (Array.isArray(items) ? items : []).map((l) => ({
    description: String((l as Line)?.description ?? '').trim(),
    quantity: Number((l as Line)?.quantity),
    rate: Number((l as Line)?.rate),
  }))
  if (!lines.length) return { error: 'Add at least one line.' }
  if (lines.some((l) => !l.description)) return { error: 'Every line needs a description.' }
  if (lines.some((l) => !Number.isFinite(l.quantity) || l.quantity <= 0)) return { error: 'Quantities must be more than nothing.' }
  if (lines.some((l) => !Number.isFinite(l.rate) || l.rate < 0)) return { error: 'Give every line a price, such as 1500.' }
  const tax = taxRate === undefined || taxRate === null || taxRate === '' ? 0 : Number(taxRate)
  if (!Number.isFinite(tax) || tax < 0 || tax > 100) return { error: 'Tax is a percentage between 0 and 100.' }

  const paid = Math.max(0, Number(invoice.amountPaidMinor) || 0)
  const before = Number(invoice.amountMinor) || 0
  const total = totalMinor(lines, tax)
  if (total < paid) return { error: `It cannot ask for less than the ${fmt(paid)} already paid. To give money back, record a refund on Payments; the invoice stays as it is.` }
  const wasPaid = invoice.status === 'paid' || (before > 0 && paid >= before)
  if (wasPaid && total > before) return { error: `This invoice is paid in full. Make a new invoice for the extra ${fmt(total - before)}, so this one stays paid.` }

  const due = typeof dueDate === 'string' && dueDate ? dueDate : null
  if (due && Number.isNaN(Date.parse(due))) return { error: 'That due date is not a date.' }
  const status: 'paid' | 'pending' | 'overdue' = paid >= total ? 'paid' : due && Date.parse(due) < now - DAY ? 'overdue' : 'pending'
  return {
    items: lines,
    taxRate: tax,
    dueDate: due,
    totalMinor: total,
    status,
    paidAt: status === 'paid' ? (invoice.paidAt ?? new Date(now).toISOString()) : null,
    reason: why.slice(0, 500),
  }
}
