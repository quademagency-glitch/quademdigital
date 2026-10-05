import type { CollectionSlug, Payload, TypedUser, Where } from 'payload'
import { invoiceCurrencyFor } from './markets.js'

export type Money = Record<string, number>
export type InvoiceSummary = {
  id: number | string
  invoiceId?: string | null
  currency?: string | null
  amountMinor?: number | null
  amountPaidMinor?: number | null
  status?: string | null
  dueDate?: string | null
}
export type DueInvoice = {
  id: number | string
  ref: string
  currency: string
  owed: number
  daysLate: number
}
export type DueContact = {
  id: string
  href: string
  who: string
  kind: 'Lead' | 'Client'
  days: number
}
export const formatMoney = (currency: string, minor: number) => {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
    }).format(minor / 100)
  } catch {
    return `${currency} ${(minor / 100).toLocaleString('en-GB')}`
  }
}
const add = (money: Money, currency: string, amount: number) => {
  if (amount) money[currency] = (money[currency] || 0) + amount
}
export function dayBounds(now: Date) {
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setUTCHours(23, 59, 59, 999)
  return { start, end }
}
export function invoiceSummary(invoices: InvoiceSummary[], now: Date) {
  const collected: Money = {},
    awaiting: Money = {},
    overdue: Money = {}
  const collectedIds: (string | number)[] = [],
    awaitingIds: (string | number)[] = []
  const due: DueInvoice[] = []
  const { start } = dayBounds(now)
  for (const inv of invoices) {
    const currency = (inv.currency || 'USD').toUpperCase()
    const paid = Number(inv.amountPaidMinor) || 0
    const owed = Math.max(0, (Number(inv.amountMinor) || 0) - paid)
    add(collected, currency, paid)
    if (paid) collectedIds.push(inv.id)
    if (inv.status === 'paid' || !owed) continue
    add(awaiting, currency, owed)
    awaitingIds.push(inv.id)
    const dueDate = inv.dueDate ? new Date(inv.dueDate) : null
    if (dueDate && dueDate < start) {
      add(overdue, currency, owed)
      const dueDay = dayBounds(dueDate).start
      due.push({
        id: inv.id,
        ref: inv.invoiceId || `Invoice ${inv.id}`,
        currency,
        owed,
        daysLate: Math.round((start.getTime() - dueDay.getTime()) / 86400000),
      })
    }
  }
  due.sort((a, b) => b.daysLate - a.daysLate)
  return { collected, awaiting, overdue, collectedIds, awaitingIds, due }
}
export const activeRetainerWhere = (now: Date): Where => ({
  and: [
    { recurring: { equals: true } },
    { acceptedAt: { exists: true } },
    { dealStatus: { in: ['accepted', 'active'] } },
    { or: [{ endedAt: { exists: false } }, { endedAt: { greater_than: now.toISOString() } }] },
  ],
})
export function retainerSummary(
  rows: { currency?: string | null; country?: string | null; total?: number | null }[],
) {
  const totals: Money = {}
  for (const row of rows)
    add(
      totals,
      row.currency || invoiceCurrencyFor(row.country),
      Math.round((Number(row.total) || 0) * 100),
    )
  return totals
}
export function listURL(collection: string, where?: Where) {
  if (!where) return `/admin/collections/${collection}`
  const params = new URLSearchParams()
  const visit = (value: unknown, key: string) => {
    if (Array.isArray(value)) value.forEach((v, i) => visit(v, `${key}[${i}]`))
    else if (value && typeof value === 'object')
      Object.entries(value).forEach(([k, v]) => visit(v, `${key}[${k}]`))
    else params.set(key, String(value))
  }
  visit(where, 'where')
  return `/admin/collections/${collection}?${params}`
}
// These invoice sets include a computed outstanding balance, which a normal
// field filter cannot compare. Link to the exact records used in the total.
export const invoiceSetURL = (ids: (string | number)[]) =>
  listURL('invoices', ids.length ? { id: { in: ids } } : { id: { equals: -1 } })

/** Read every page with the viewer's permissions; a partial result is an error. */
export async function findAll<T>(
  payload: Payload,
  user: TypedUser,
  collection: CollectionSlug,
  where?: Where,
): Promise<T[]> {
  const docs: T[] = []
  for (let page = 1; ; page++) {
    const res = await payload.find({
      collection,
      where,
      limit: 200,
      page,
      depth: 0,
      overrideAccess: false,
      user,
    })
    docs.push(...(res.docs as T[]))
    if (!res.hasNextPage) return docs
  }
}
