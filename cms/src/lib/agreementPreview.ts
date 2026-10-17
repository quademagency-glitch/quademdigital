import type { Endpoint } from 'payload'
import { hasRole } from '../access/roles'
import { onboardingClient } from './onboarding'

/*
  The service agreement, before it goes (Ernest, 17 October 2026: show it
  first). The portal's Won step sends the details Ernest is about to save;
  this checks it is him, shapes them exactly as onboarding will
  (onboardingClient), and has the website write the agreement with the same
  code that writes the real one (src/pages/api/agreement-preview.ts on the
  site). Nothing is saved or sent.
*/

const AGREEMENT_SETTINGS = ['duration', 'revisions', 'depositPercent', 'numberOfPages', 'postsPerMonth', 'platforms', 'paymentTerms', 'extraDeliverables', 'specialTerms'] as const

/** The client as onboarding would see it, from the Won step's details. */
export function previewClient(b: Record<string, unknown>) {
  const raw = (b.customizations && typeof b.customizations === 'object' ? b.customizations : {}) as Record<string, unknown>
  const customizations = Object.fromEntries(AGREEMENT_SETTINGS.filter((k) => raw[k] !== undefined && raw[k] !== null && raw[k] !== '').map((k) => [k, raw[k]]))
  const price = Number(b.price)
  return onboardingClient({
    id: 'preview',
    clientName: String(b.clientName ?? '').trim(),
    contactName: String(b.contactName ?? '').trim() || null,
    clientEmail: String(b.clientEmail ?? '').trim(),
    phone: String(b.phone ?? '').trim(),
    accessCode: '',
    service: String(b.service ?? ''),
    package: String(b.package ?? '').trim(),
    price: Number.isFinite(price) && price > 0 ? price : undefined,
    currency: String(b.currency ?? '').trim() || null,
    country: String(b.country ?? '').trim() || null,
    startDate: String(b.startDate ?? '').trim() || undefined,
    customizations,
  })
}

export const agreementPreviewEndpoints: Endpoint[] = [
  {
    path: '/agreement-preview',
    method: 'post',
    handler: async (req) => {
      if (!hasRole(req.user, 'admin')) return Response.json({ error: 'Only Ernest sees an agreement before it goes.' }, { status: req.user ? 403 : 401 })
      const b = ((await req.json?.().catch(() => null)) ?? {}) as Record<string, unknown>
      const client = previewClient(b)
      if (!client.businessName || !client.service) return Response.json({ error: 'Add the business name and the service to see the agreement.' }, { status: 400 })
      const site = process.env.ASTRO_SITE_URL?.replace(/\/$/, '')
      const secret = process.env.CMS_WEBHOOK_SECRET
      if (!site || !secret) return Response.json({ error: 'The website is not set up to write agreements from here.' }, { status: 503 })
      try {
        const res = await fetch(`${site}/api/agreement-preview/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-quadem-secret': secret },
          body: JSON.stringify({ client }),
          signal: AbortSignal.timeout(60_000),
        })
        if (!res.ok || !String(res.headers.get('content-type')).includes('pdf')) throw new Error(`The website answered ${res.status}`)
        return new Response(await res.arrayBuffer(), { headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' } })
      } catch (err) {
        req.payload.logger.error({ err }, 'The agreement preview could not be written')
        return Response.json({ error: 'The agreement could not be written just now. Try again in a minute.' }, { status: 502 })
      }
    },
  },
]
