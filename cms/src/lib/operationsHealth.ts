import { securityDB } from './securityDatabase'
import { timingSafeEqual } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import type { AfterErrorHook, Endpoint, PayloadRequest, TaskConfig } from 'payload'

export const recordServerError: AfterErrorHook = async ({ error, req }) => {
  const status = (error as { status?: number }).status || 500
  if (status < 500) return
  const key = `errors:${new Date().toISOString().slice(0, 13)}`
  await securityDB(req).execute(sql`INSERT INTO operations_health (key, value, created_at, updated_at) VALUES (${key}, '{"count":1}'::jsonb, now(), now()) ON CONFLICT (key) DO UPDATE SET value = jsonb_build_object('count', COALESCE((operations_health.value->>'count')::int,0)+1), updated_at = now()`).catch(() => {})
}

async function check(req: PayloadRequest) {
  const jobs = await securityDB(req).execute(sql`SELECT count(*) FILTER (WHERE has_error = true AND updated_at > now() - interval '24 hours')::int AS failed, count(*) FILTER (WHERE completed_at IS NULL AND has_error IS DISTINCT FROM true AND ((processing = true AND updated_at < now() - interval '30 minutes') OR (processing IS DISTINCT FROM true AND COALESCE(wait_until, created_at) < now() - interval '30 minutes')))::int AS stalled FROM payload_jobs`)
  const errors = await securityDB(req).execute(sql`SELECT COALESCE(sum((value->>'count')::int),0)::int AS n FROM operations_health WHERE key LIKE 'errors:%' AND updated_at > now() - interval '1 hour'`)
  const result = { checkedAt: new Date().toISOString(), failedJobs: Number(jobs.rows[0]?.failed || 0), stalledJobs: Number(jobs.rows[0]?.stalled || 0), serverErrors: Number(errors.rows[0]?.n || 0) }
  return { ...result, ok: !result.failedJobs && !result.stalledJobs && !result.serverErrors }
}

export const operationsHealthTask: TaskConfig<'operationsHealth'> = {
  slug: 'operationsHealth', retries: 0, schedule: [{ cron: '*/5 * * * *', queue: 'default' }],
  outputSchema: [{ name: 'ok', type: 'checkbox' }],
  handler: async ({ req }) => {
    const health = await check(req)
    await securityDB(req).execute(sql`INSERT INTO operations_health (key, value, created_at, updated_at) VALUES ('heartbeat', ${JSON.stringify(health)}::jsonb, now(), now()) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now()`)
    // Short-lived security material and stale device subscriptions are removed
    // without touching records, active sessions or offline-save receipts.
    await securityDB(req).execute(sql`DELETE FROM security_challenges WHERE expires_at < now() - interval '1 day'`)
    await securityDB(req).execute(sql`DELETE FROM device_sessions WHERE expires_at < now()`)
    await securityDB(req).execute(sql`DELETE FROM push_subscriptions p WHERE NOT EXISTS (SELECT 1 FROM users_sessions s WHERE s.id = p.sid AND s._parent_id = p.user_id AND s.expires_at > now())`)
    await securityDB(req).execute(sql`DELETE FROM operations_health WHERE key LIKE 'errors:%' AND updated_at < now() - interval '30 days'`)
    return { output: { ok: health.ok } }
  },
}

const monitorAllowed = (req: PayloadRequest) => {
  const expected = process.env.OPS_MONITOR_SECRET || ''
  const supplied = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
  return expected.length >= 32 && Buffer.byteLength(supplied) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
}

export const operationsErrorEndpoint: Endpoint = { path: '/ops-error', method: 'post', handler: async (req) => {
  if (!monitorAllowed(req)) return Response.json({ error: 'Not authorised.' }, { status: 401 })
  await recordServerError({ req, error: new Error('Portal server error'), context: {} })
  return Response.json({ ok: true })
} }

export const operationsHealthEndpoint: Endpoint = {
  path: '/ops-health', method: 'get', handler: async (req) => {
    if (!monitorAllowed(req)) return Response.json({ error: 'Not authorised.' }, { status: 401 })
    const health = await check(req)
    const beat = await securityDB(req).execute(sql`SELECT updated_at FROM operations_health WHERE key = 'heartbeat'`)
    const heartbeat = beat.rows[0]?.updated_at ? new Date(String(beat.rows[0].updated_at)).getTime() : 0
    const workerRunning = heartbeat > Date.now() - 20 * 60000
    return Response.json({ ...health, workerRunning, ok: health.ok && workerRunning }, { status: health.ok && workerRunning ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
  },
}
