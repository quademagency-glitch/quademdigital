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

/** What shows on the lock screen, and the portal page a tap opens. */
export type PushMessage = { title: string; body?: string | null; path: string; tag: string }

const GENERIC = { title: 'Quadem Team', body: 'You have a new update. Open Quadem to read it.', path: '/notifications' }

/*
  Notices whose title can say something private (pay, commission, a warning,
  a review, an ended agreement, account security). Anyone glancing at a locked
  phone sees only the generic line; the words stay inside the portal.
*/
const PRIVATE_KINDS = new Set(['warning', 'appraisal', 'review', 'payout', 'commission-due', 'commission-earned', 'commission-overdue', 'expense', 'agreement-ended', 'security', 'password'])

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

/** Only a page inside the portal. A tap must never leave it. */
export const portalPath = (path: unknown) =>
  typeof path === 'string' && path.length <= 300 && /^\/(?![/\\])[\w\-/?=&%.~#]*$/.test(path) ? path : '/notifications'

export type NoticeForPush = { id: number | string; kind?: string | null; title?: string | null; body?: string | null; link?: string | null }

/** The lock-screen version of a bell notice. A message shows who sent it and its first line; other notices show their title only. */
export function noticePush(n: NoticeForPush): PushMessage {
  const tag = `notice-${n.id}`
  if (!n.title || (n.kind && PRIVATE_KINDS.has(n.kind))) return { ...GENERIC, tag }
  if (n.kind === 'message') return { title: n.title, body: n.body || 'Open Quadem to read it.', path: portalPath(n.link), tag }
  return { title: n.title, body: 'Open Quadem to read it.', path: '/notifications', tag }
}

/**
 * Phone notifications to each person's signed-in devices. A subscription is
 * tied to a real sign-in: sign-out, password reset and an ended agreement stop
 * delivery, including to a lost device. Never throws.
 */
export async function pushTo(req: PayloadRequest, userIds: (number | string)[], message: PushMessage) {
  const ids = [...new Set(userIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
  if (!configured() || !ids.length) return
  const payload = JSON.stringify({ title: clip(message.title, 80), body: message.body ? clip(message.body, 140) : '', path: portalPath(message.path), tag: message.tag })
  let rows: { id: unknown; subscription: unknown }[]
  try {
    const result = await securityDB(req).execute(sql`SELECT p.id, p.subscription FROM push_subscriptions p JOIN users_sessions s ON s.id = p.sid AND s._parent_id = p.user_id JOIN users u ON u.id = p.user_id WHERE p.user_id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}) AND s.expires_at > now() AND (u.role = 'admin' OR (u.role = 'team' AND u.status IS DISTINCT FROM 'ended'))`)
    rows = result.rows as typeof rows
  } catch (err) {
    req.payload.logger.error({ err, tag: message.tag }, 'Phone notifications could not be looked up')
    return
  }
  await Promise.all(rows.map(async (row) => {
    const sub = row.subscription
    if (!validSubscription(sub)) return
    try {
      await webpush.sendNotification(sub, payload, {
        TTL: 3600, timeout: 10000,
        vapidDetails: { subject: 'mailto:ernest@quademdigital.com', publicKey: process.env.WEB_PUSH_PUBLIC_KEY!, privateKey: process.env.WEB_PUSH_PRIVATE_KEY! },
      })
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await securityDB(req).execute(sql`DELETE FROM push_subscriptions WHERE id = ${row.id}`).catch(() => undefined)
      else req.payload.logger.error({ status, tag: message.tag }, 'Phone notification was not accepted')
    }
  }))
}

/** The phone notification for one bell notice. A bare id sends the generic line. */
export async function pushNotice(req: PayloadRequest, userId: number, notice: number | string | NoticeForPush) {
  await pushTo(req, [userId], noticePush(typeof notice === 'object' ? notice : { id: notice }))
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
