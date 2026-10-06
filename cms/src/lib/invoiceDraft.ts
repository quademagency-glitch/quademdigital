/**
 * A new invoice, filled in from what was already agreed, for the founder to
 * check and correct before sending (founder portal, Invoices).
 *
 * The order of preference, and why:
 *
 * 1. The client's deal. It is what the client said yes to: its lines, total,
 *    currency and deposit. A retainer bills one month at a time, so the draft
 *    is the next month not yet invoiced. A one-off deal that has already been
 *    invoiced in full starts an empty line instead of billing it twice.
 * 2. With no deal, the client's own record: the package and agreed fee, with
 *    the deposit from their contract settings. That is for a first invoice.
 * 3. A client already invoiced with no deal is most often billed the same
 *    again, so the last invoice's lines are copied.
 *
 * Nothing here is sent anywhere: the result is a draft, and `from` says in
 * plain words where the figures came from so they can be checked.
 */

export type DraftItem = { description: string; quantity: number; rate: number }

export type DraftClient = {
  id: number | string
  clientName?: string | null
  service?: string | null
  package?: string | null
  price?: number | null
  currency?: string | null
  startDate?: string | null
  customizations?: { depositPercent?: number | null } | null
}

export type DraftDeal = {
  id: number | string
  packageName?: string | null
  summary?: string | null
  service?: string | null
  total?: number | null
  currency?: string | null
  recurring?: boolean | null
  durationMonths?: number | null
  depositPercent?: number | null
  startDate?: string | null
  acceptedAt?: string | null
  dealStatus?: string | null
  lineItems?: { description?: string | null; quantity?: number | null; rate?: number | null }[] | null
}

export type DraftInvoice = {
  id: number | string
  invoiceId?: string | null
  deal?: number | string | { id: number | string } | null
  items?: { description?: string | null; quantity?: number | null; rate?: number | null }[] | null
  taxRate?: number | null
  createdAt?: string | null
}

export type Draft = {
  data: {
    items: DraftItem[]
    deal?: number | string
    currency?: string
    depositPercent: number
    taxRate: number
    dueDate: string
    dateIssued: string
  }
  from: string
}

export const SERVICE_NAME: Record<string, string> = {
  'web-design': 'Web design',
  'digital-marketing': 'Digital marketing',
  branding: 'Branding',
  'video-production': 'AI video and reels',
  'seo-paid-ads': 'SEO and paid ads',
  'social-media': 'Social media management',
  multiple: 'Agreed services',
}

/** Days a client has to pay a new invoice: the same as provisioning gives. */
export const PAY_WITHIN_DAYS = 14

const DAY = 86_400_000
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number | string }).id : v)
const SYMBOL: Record<string, string> = { GHS: 'GH₵', NGN: '₦', USD: '$', KES: 'KSh ', ZAR: 'R', GBP: '£', EUR: '€' }
/** The same as the portal shows money: GH₵6,000, or GH₵6,000.50. */
export const fmt = (minor: number, currency: string) => {
  const value = minor / 100
  const n = new Intl.NumberFormat('en-GB', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 }).format(value)
  return `${SYMBOL[currency] ?? `${currency} `}${n}`
}
const money = (n: number, currency?: string | null) => fmt(Math.round(n * 100), String(currency || 'GHS').toUpperCase())
const monthName = (d: Date) => new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
const pct = (v: unknown) => (typeof v === 'number' && v > 0 && v < 100 ? v : 0)

/** The month `n` months after `start`, on the same day (or the month's last). */
export function addMonths(start: Date, n: number) {
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + n, 1))
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(start.getUTCDate(), last))
  return d
}

/** The deal a new invoice most likely bills: a live one, the newest first. */
export function currentDeal(deals: DraftDeal[]): DraftDeal | null {
  // Agreed and not over. A deal only sent, or one with no status, has nothing agreed to bill yet.
  const live = deals.filter((d) => ['accepted', 'active', 'completed'].includes(String(d.dealStatus ?? '')))
  const by = (d: DraftDeal) => String(d.acceptedAt || d.startDate || '')
  return [...live].sort((a, b) => by(b).localeCompare(by(a)))[0] ?? null
}

const dealLines = (deal: DraftDeal): DraftItem[] => {
  const lines = (deal.lineItems ?? [])
    .map((i) => ({ description: String(i?.description ?? '').trim(), quantity: i?.quantity == null ? 1 : Number(i.quantity), rate: Number(i?.rate) || 0 }))
    .filter((i) => i.description && i.quantity > 0)
  if (lines.length) return lines
  return [{ description: deal.packageName || deal.summary || SERVICE_NAME[deal.service ?? ''] || 'Agreed scope of work', quantity: 1, rate: Number(deal.total) || 0 }]
}

export function draftInvoice({ client, deal, previous, today = new Date() }: { client: DraftClient; deal: DraftDeal | null; previous: DraftInvoice[]; today?: Date }): Draft {
  const dateIssued = today.toISOString()
  const dueDate = new Date(today.getTime() + PAY_WITHIN_DAYS * DAY).toISOString()
  const latest = [...previous].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0] ?? null
  const taxRate = Number(latest?.taxRate) || 0
  const base = { dateIssued, dueDate, taxRate }

  if (deal) {
    const name = deal.packageName || SERVICE_NAME[deal.service ?? ''] || 'Agreed work'
    const billed = previous.filter((i) => String(idOf(i.deal)) === String(deal.id))
    const currency = deal.currency || client.currency || undefined
    if (deal.recurring) {
      const start = deal.startDate && Number.isFinite(Date.parse(deal.startDate)) ? new Date(deal.startDate) : today
      const n = billed.length
      const month = addMonths(start, n)
      const total = Number(deal.total) || 0
      const term = Number(deal.durationMonths) || 0
      const over = term > 0 && n >= term
      return {
        data: { ...base, deal: deal.id, currency, depositPercent: 0, items: [{ description: `${name}, ${monthName(month)}`, quantity: 1, rate: total }] },
        from: `Filled from the retainer deal “${name}”: month ${n + 1}${term ? ` of ${term}` : ''}, ${money(total, currency)} a month.${over ? ` The agreed ${term} months are already invoiced, so check this month was agreed.` : ''}`,
      }
    }
    if (billed.length) {
      const names = billed.map((i) => i.invoiceId || `invoice ${i.id}`).join(', ')
      return {
        data: { ...base, deal: deal.id, currency, depositPercent: 0, items: [{ description: 'Additional work', quantity: 1, rate: 0 }] },
        from: `The deal “${name}” is already invoiced (${names}), so this starts with an empty line: say what it is for and the price.`,
      }
    }
    const items = dealLines(deal)
    const total = items.reduce((n, i) => n + i.quantity * i.rate, 0)
    const deposit = pct(deal.depositPercent)
    return {
      data: { ...base, deal: deal.id, currency, depositPercent: deposit, items },
      from: `Filled from the deal “${name}”: ${money(total, currency)}${deposit ? `, ${deposit}% deposit to start` : ''}.`,
    }
  }

  if (latest && (latest.items ?? []).length) {
    const items = (latest.items ?? [])
      .map((i) => ({ description: String(i?.description ?? '').trim(), quantity: i?.quantity == null ? 1 : Number(i.quantity), rate: Number(i?.rate) || 0 }))
      .filter((i) => i.description)
    return {
      data: { ...base, currency: client.currency || undefined, depositPercent: 0, items: items.length ? items : [{ description: 'Agreed work', quantity: 1, rate: 0 }] },
      from: `Copied from ${latest.invoiceId || 'their last invoice'}, the last invoice to ${client.clientName || 'this client'}. Change anything that is different this time.`,
    }
  }

  const name = client.package || SERVICE_NAME[client.service ?? ''] || 'Agreed work'
  const fee = Number(client.price) || 0
  const deposit = pct(client.customizations?.depositPercent)
  return {
    data: { ...base, currency: client.currency || undefined, depositPercent: deposit, items: [{ description: name, quantity: 1, rate: fee }] },
    from: fee
      ? `Filled from ${client.clientName || 'the client'}’s agreed fee: ${money(fee, client.currency)} for ${name}${deposit ? `, ${deposit}% deposit to start` : ''}.`
      : `${client.clientName || 'This client'} has no agreed fee on record, so the price is empty: fill it in.`,
  }
}
