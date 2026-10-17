// ─────────────────────────────────────────────────────────────
//  QUADEM DIGITAL: the service agreement, before it goes
//
//  Ernest sees a new client's agreement exactly as they will get it before
//  he makes them a client (17 October 2026), so it is written here by the
//  same generateContract that onboarding uses (client-won.ts), from the
//  details he is about to save. Nothing is stored or sent. Only the CMS
//  calls it, with the shared secret, after checking it is Ernest
//  (cms/src/lib/agreementPreview.ts).
// ─────────────────────────────────────────────────────────────

import type { APIRoute } from 'astro'
import { generateContract, type ClientData } from '../../lib/onboardingDocs'

const WEBHOOK_SECRET = (import.meta.env.CMS_WEBHOOK_SECRET || process.env.CMS_WEBHOOK_SECRET)

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export const POST: APIRoute = async ({ request }) => {
  if (!WEBHOOK_SECRET || request.headers.get('x-quadem-secret') !== WEBHOOK_SECRET) return json({ ok: false, error: 'Unauthorized' }, 401)
  let body: { client?: ClientData }
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }
  const client = body.client
  if (!client?.businessName || !client.service) return json({ ok: false, error: 'The business name and the service are needed to write the agreement.' }, 400)
  try {
    const pdf = await generateContract(client)
    return new Response(new Uint8Array(pdf), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="Service-Agreement-preview.pdf"', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('agreement-preview: the agreement could not be written', err)
    return json({ ok: false, error: 'The agreement could not be written.' }, 500)
  }
}
