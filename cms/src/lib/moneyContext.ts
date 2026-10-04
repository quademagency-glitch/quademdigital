import type { PayloadRequest } from 'payload'

/** Lookups the money collections share. All read with full access: they decide money, not visibility. */

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)
export const refId = (v: unknown): number | null => {
  const id = idOf(v)
  return id === null || id === undefined || id === '' ? null : Number(id)
}

/** Units of `currency` for one cedi, from Team money settings. GH₵ is 1. */
export async function rateFor(req: PayloadRequest, currency: string | null | undefined): Promise<number | null> {
  const cur = String(currency ?? 'GHS').toUpperCase()
  if (cur === 'GHS') return 1
  const settings = (await req.payload.findGlobal({ slug: 'ops-settings', depth: 0, overrideAccess: true, req }).catch(() => null)) as {
    exchangeRates?: { currency?: string; perGHS?: number }[]
  } | null
  const row = settings?.exchangeRates?.find((r) => r.currency === cur)
  return row?.perGHS && row.perGHS > 0 ? row.perGHS : null
}

export async function moneySettings(req: PayloadRequest) {
  const s = (await req.payload.findGlobal({ slug: 'ops-settings', depth: 0, overrideAccess: true, req }).catch(() => null)) as Record<string, any> | null
  return {
    commissionDueDays: Number(s?.commissionDueDays ?? 7),
    allowanceWindowStart: Number(s?.allowanceWindowStart ?? 15),
    allowanceWindowEnd: Number(s?.allowanceWindowEnd ?? 20),
  }
}

/** The person's terms in force on a day: the newest that started on or before it (spec 14.3). */
export async function termsOn(req: PayloadRequest, userId: number, day: string) {
  const res = await req.payload.find({
    collection: 'member-terms',
    where: { and: [{ user: { equals: userId } }, { effectiveFrom: { less_than_equal: day } }] },
    sort: '-effectiveFrom',
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return (res.docs[0] as Record<string, any> | undefined) ?? null
}

export async function userById(req: PayloadRequest, id: number | null) {
  if (!id) return null
  return (await req.payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true, req }).catch(() => null)) as Record<string, any> | null
}
