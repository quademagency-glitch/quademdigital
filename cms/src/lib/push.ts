import { securityDB, sessionID } from './securityDatabase'
import { createHash } from 'node:crypto'
import webpush from 'web-push'
import { sql } from '@payloadcms/db-postgres'
import type { Endpoint, PayloadRequest } from 'payload'

export function validSubscription(value: unknown): value is webpush.PushSubscription {
  if (!value || typeof value !== 'object') return false
  const sub = value as webpush.PushSubscription
  try {
    const url = new URL(sub.endpoint)
    const host = url.hostname
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || url.hash) return false
    if (!(host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' || host.endsWith('.push.services.mozilla.com') || host === 'web.push.apple.com' || host.endsWith('.push.apple.com') || host.endsWith('.notify.windows.com'))) return false
    if (sub.endpoint.length > 2048 || !/^\/[\w/%.=~+-]+$/.test(url.pathname)) return false
    if (![sub.keys?.auth, sub.keys?.p256dh].every((x) => typeof x === 'string' && /^[\w-]+={0,2}$/.test(x))) return false
    return Buffer.from(sub.keys.auth, 'base64url').length === 16 && Buffer.from(sub.keys.p256dh, 'base64url').length === 65
  } catch { return false }
}

const configured = () => Boolean(process.env.WEB_PUSH_PUBLIC_KEY && process.env.WEB_PUSH_PRIVATE_KEY)
const hash = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex')

export async function pushNotice(req: PayloadRequest, userId: number, noticeId: number | string) {
  if (!configured()) return
  // A subscription is tied to a real sign-in. Sign-out, password reset and an
  // ended agreement stop delivery, including to a lost device.
  const result = await securityDB(req).execute(sql`SELECT p.id, p.subscription FROM push_subscriptions p JOIN users_sessions s ON s.id = p.sid AND s._parent_id = p.user_id JOIN users u ON u.id = p.user_id WHERE p.user_id = ${userId} AND s.expires_at > now() AND (u.role = 'admin' OR (u.role = 'team' AND u.status IS DISTINCT FROM 'ended'))`)
  for (const row of result.rows) {
    const sub = row.subscription
    if (!validSubscription(sub)) continue
    try {
      await webpush.sendNotification(sub, JSON.stringify({ title: 'Quadem Team', body: 'You have a new update. Open Quadem to read it.', path: '/notifications', tag: `notice-${noticeId}` }), {
        TTL: 3600, timeout: 10000,
        vapidDetails: { subject: 'mailto:ernest@quademdigital.com', publicKey: process.env.WEB_PUSH_PUBLIC_KEY!, privateKey: process.env.WEB_PUSH_PRIVATE_KEY! },
      })
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await securityDB(req).execute(sql`DELETE FROM push_subscriptions WHERE id = ${row.id}`)
      else req.payload.logger.error({ status, noticeId }, 'Phone notification was not accepted')
    }
  }
}

export const pushEndpoints: Endpoint[] = [
  { path: '/push', method: 'get', handler: async (req) => {
    if (!req.user || !['admin', 'team'].includes(req.user.role || '')) return Response.json({ error: 'Sign in first.' }, { status: 401 })
    const rows = await securityDB(req).execute(sql`SELECT endpoint_hash FROM push_subscriptions WHERE user_id = ${req.user.id} AND sid = ${sessionID(req) || ''}`)
    return Response.json({ publicKey: process.env.WEB_PUSH_PUBLIC_KEY || null, configured: configured(), endpoints: rows.rows.map((r) => r.endpoint_hash) }, { headers: { 'Cache-Control': 'no-store' } })
  } },
  { path: '/push', method: 'post', handler: async (req) => {
    if (!req.user || !sessionID(req) || !['admin', 'team'].includes(req.user.role || '') || req.user.status === 'ended') return Response.json({ error: 'Sign in first.' }, { status: 401 })
    const data = (req.data ?? await req.json?.()) as { subscription?: unknown; remove?: boolean }
    if (!validSubscription(data.subscription)) return Response.json({ error: 'This phone subscription is not valid.' }, { status: 400 })
    const endpointHash = hash(data.subscription.endpoint)
    if (data.remove) {
      await securityDB(req).execute(sql`DELETE FROM push_subscriptions WHERE endpoint_hash = ${endpointHash} AND user_id = ${req.user.id}`)
    } else {
      if (!configured()) return Response.json({ error: 'Phone notifications are not configured yet.' }, { status: 503 })
      await securityDB(req).execute(sql`INSERT INTO push_subscriptions (endpoint_hash, user_id, sid, subscription, created_at, updated_at) VALUES (${endpointHash}, ${req.user.id}, ${sessionID(req)}, ${JSON.stringify(data.subscription)}::jsonb, now(), now()) ON CONFLICT (endpoint_hash) DO UPDATE SET user_id = excluded.user_id, sid = excluded.sid, subscription = excluded.subscription, updated_at = now()`)
    }
    return Response.json({ ok: true })
  } },
]
