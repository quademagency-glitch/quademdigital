import type { Endpoint } from 'payload'

// A reservation survives timeouts and restarts. An uncertain send stays locked
// for provider reconciliation instead of inviting a duplicate campaign.
export const DELIVERY_PREFIX = 'Delivery reserved; reconcile before retry. '
export const campaignDeliveryEndpoints: Endpoint[] = [{
  path: '/:id/delivery', method: 'post',
  handler: async (req: any) => {
    const secret = process.env.CMS_WEBHOOK_SECRET
    if (!secret || req.headers.get('x-quadem-secret') !== secret) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const id = Number(req.routeParams?.id)
    if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: 'Invalid campaign.' }, { status: 400 })
    const body = await req.json().catch(() => null)
    if (!body || typeof body.reservation !== 'string' || !body.reservation.startsWith(DELIVERY_PREFIX)) return Response.json({ error: 'Invalid delivery reservation.' }, { status: 400 })
    const pool = req.payload.db.pool
    if (body.action === 'claim') {
      const result = await pool.query(
        `UPDATE email_campaigns SET send_log = $2, updated_at = NOW()
         WHERE id = $1 AND sent_at IS NULL AND send_log IS NOT DISTINCT FROM $3
         AND COALESCE(send_log, '') NOT LIKE $4 RETURNING id`,
        [id, body.reservation, body.previousLog ?? null, DELIVERY_PREFIX + '%'],
      )
      return Response.json({ ok: result.rowCount === 1 }, { status: result.rowCount === 1 ? 200 : 409 })
    }
    if (body.action === 'finish' && typeof body.log === 'string' && Number.isSafeInteger(body.sent) && body.sent >= 0) {
      const complete = body.complete === true
      const isTest = body.test === true
      const log = complete ? body.log : body.reservation + '\n' + body.log
      const result = await pool.query(
        `UPDATE email_campaigns SET send_log = $3,
         sent_at = CASE WHEN $4 THEN NOW() ELSE sent_at END,
         status = CASE WHEN $4 THEN 'sent'::enum_email_campaigns_status ELSE status END,
         recipient_count = CASE WHEN $5 THEN recipient_count ELSE $6 END,
         updated_at = NOW() WHERE id = $1 AND send_log = $2 RETURNING id`,
        [id, body.reservation, log, complete && !isTest, isTest, body.sent],
      )
      return Response.json({ ok: result.rowCount === 1 }, { status: result.rowCount === 1 ? 200 : 409 })
    }
    return Response.json({ error: 'Invalid delivery action.' }, { status: 400 })
  },
}]
