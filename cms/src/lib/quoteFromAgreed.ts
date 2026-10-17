import type { Agreed } from './agreedReader'

/*
  A draft quotation filled from Ernest's own proposal (lib/agreedReader.ts,
  17 October 2026). Its prices are the proposal's, line for line, so the
  quotation is custom priced, never the price list's. What the proposal does
  not say keeps what the draft already had, and who it is for is only filled
  where the draft has nothing: a client or lead chosen in the portal is never
  overwritten by a name read from a PDF. Pure, so it is tested.
*/

type Draft = {
  currency?: string | null
  service?: string | null
  clientName?: string | null
  contactName?: string | null
  clientEmail?: string | null
  phone?: string | null
  country?: string | null
  lineItems?: { description?: string | null; quantity?: number | null; rate?: number | null }[] | null
  discussionNotes?: string | null
}

export function quotePatchFromAgreed(a: Agreed, q: Draft, words = ''): { patch: Record<string, unknown>; note: string } {
  const lines = a.lineItems.length
    ? a.lineItems
    : a.total
      ? [{ description: a.packageName || 'The agreed work', quantity: 1, rate: a.total }]
      : (q.lineItems ?? []).map((l) => ({ description: String(l.description ?? ''), quantity: Number(l.quantity) || 1, rate: Number(l.rate) || 0 }))
  const total = Math.round(lines.reduce((n, l) => n + l.quantity * l.rate, 0) * 100) / 100
  const currency = a.currency || q.currency || 'GHS'
  const blank = (v: unknown) => !String(v ?? '').trim()
  const patch: Record<string, unknown> = {
    currency,
    lineItems: lines.map((l) => ({ description: l.description.slice(0, 200), quantity: l.quantity, rate: l.rate })),
    total,
    pricing: 'custom',
    plans: [],
    ...(a.service ? { service: a.service } : {}),
    ...(a.packageName ? { packageName: a.packageName } : {}),
    ...(a.recurring !== null ? { recurring: a.recurring } : {}),
    ...(a.durationMonths !== null ? { durationMonths: a.durationMonths } : {}),
    ...(a.depositPercent !== null ? { depositPercent: a.depositPercent } : {}),
    ...(a.startDate ? { startDate: a.startDate } : {}),
    ...(a.summary ? { summary: a.summary } : {}),
    ...(a.deliverables.length ? { deliverables: a.deliverables.map((item) => ({ item })) } : {}),
    ...(a.paymentTerms ? { paymentTerms: a.paymentTerms } : {}),
    ...(a.specialTerms ? { specialTerms: a.specialTerms } : {}),
    ...(blank(q.clientName) && a.clientName ? { clientName: a.clientName } : {}),
    ...(blank(q.contactName) && a.contactName ? { contactName: a.contactName } : {}),
    ...(blank(q.clientEmail) && a.email ? { clientEmail: a.email } : {}),
    ...(blank(q.phone) && a.phone ? { phone: a.phone } : {}),
    ...(blank(q.country) && a.country ? { country: a.country } : {}),
    ...(words.trim() ? { discussionNotes: [q.discussionNotes, words.trim()].filter(Boolean).join('\n\n').slice(0, 20000) } : {}),
  }
  const note = [
    'Filled from your proposal. Check every line, price and date before you send it.',
    q.currency && a.currency && a.currency !== q.currency ? `The prices are in ${a.currency}, as in the proposal, not ${q.currency}.` : '',
    !a.lineItems.length && !a.total ? 'No prices were found in it: add the lines yourself.' : '',
    a.toConfirm.length ? `To confirm with the client: ${a.toConfirm.join(' ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  return { patch: { ...patch, suggestionNote: note }, note }
}
