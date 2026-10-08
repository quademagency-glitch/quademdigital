/*
  When a deal counts toward a team member's target (Agreement §4): once the
  client has signed and Quadem has received the first payment. So a deal
  counts in the month its first payment cleared, and only once; a later
  payment or a refund does not move it. Used by the monthly review and the
  missed-month counter (lib/reviews.ts); the portal's Targets screen follows
  the same rule. Pure, so the rule is tested.
*/

type Payment = { deal?: unknown; clearedAt?: string | null; amountMinor?: number | null; creditType?: string | null }

export type PaidDeal = { deal: string; month: string; handed: boolean }

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)

/** Each deal with the month its first payment cleared. Refunds and payments with no deal are left out. */
export function paidDeals(payments: Payment[]): PaidDeal[] {
  const first = new Map<string, PaidDeal & { at: string }>()
  for (const p of payments) {
    const deal = idOf(p.deal)
    if (deal === undefined || deal === null || !p.clearedAt || !(Number(p.amountMinor) > 0)) continue
    const key = String(deal)
    const was = first.get(key)
    if (!was || p.clearedAt < was.at) first.set(key, { deal: key, at: p.clearedAt, month: p.clearedAt.slice(0, 7), handed: p.creditType === 'handed' })
  }
  return [...first.values()].map(({ deal, month, handed }) => ({ deal, month, handed }))
}
