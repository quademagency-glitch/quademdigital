/**
 * Enquiries: leads that came to Quadem (a website form, WhatsApp, a
 * referral), as against businesses the team found. The founder works them in
 * the team portal (Enquiries); this holds the rules that need no database.
 */

export const INBOUND_SOURCES = ['contact-form', 'homepage', 'cms-page', 'calculator', 'lead-magnet', 'brand-studio', 'whatsapp', 'referral'] as const

export const isInbound = (source: unknown) => (INBOUND_SOURCES as readonly string[]).includes(String(source ?? ''))

export const SOURCE_TEXT: Record<string, string> = {
  'contact-form': 'Contact page',
  homepage: 'Homepage',
  'cms-page': 'Service page',
  calculator: 'Price calculator',
  'lead-magnet': 'Offer',
  'brand-studio': 'Brand studio',
  whatsapp: 'WhatsApp',
  referral: 'Referral',
}

type EnquiryLead = {
  name?: string | null
  businessName?: string | null
  email?: string | null
  source?: string | null
  message?: string | null
  budget?: string | null
  magnetRequested?: string | null
  servicesInterested?: unknown
  metadata?: unknown
}

const asList = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : [])

/** What they asked for: from servicesInterested, or the services the form kept in metadata. */
export const servicesOf = (l: EnquiryLead) => {
  const direct = asList(l.servicesInterested)
  if (direct.length) return direct
  const m = l.metadata && typeof l.metadata === 'object' ? (l.metadata as { services?: unknown }) : null
  return asList(m?.services)
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

/** The founder's notice for a new enquiry: who, from where, and what they want, in one glance. */
export function enquiryNotice(l: EnquiryLead) {
  const who = l.name || l.businessName || l.email || 'Someone'
  const firm = l.businessName && l.name ? ` (${l.businessName})` : ''
  const where = SOURCE_TEXT[String(l.source ?? '')] ?? 'the website'
  const lines = [
    `From the ${where.toLowerCase()}${l.magnetRequested ? `: ${l.magnetRequested}` : ''}.`,
    servicesOf(l).length ? `Wants: ${servicesOf(l).join(', ')}.` : null,
    l.budget ? `Budget: ${l.budget}.` : null,
    l.message ? `"${clip(String(l.message).replace(/\s+/g, ' ').trim(), 220)}"` : null,
  ].filter(Boolean)
  return { title: `New enquiry: ${who}${firm}`, body: lines.join('\n') }
}
