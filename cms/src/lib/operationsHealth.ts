import { securityDB } from './securityDatabase'
import { timingSafeEqual } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import type { AfterErrorHook, Endpoint, PayloadRequest, TaskConfig } from 'payload'
import { geminiModel } from '../utils/geminiModel'
import { reportProblem } from './problems'
import { sweepIncoming } from './stagedUploads'

/*
  Settings the CMS cannot work properly without. Each one missing switches a
  feature off with no error of its own (emails go to the log and still say
  sent, files land on a disk that the next deploy wipes), so the health check
  names them (CMS review, 8 October 2026).
*/
export const REQUIRED_SETTINGS = [
  'DATABASE_URL', 'PAYLOAD_SECRET', 'RESEND_API_KEY', 'S3_BUCKET', 'S3_DOCUMENTS_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY',
  'WEB_PUSH_PUBLIC_KEY', 'WEB_PUSH_PRIVATE_KEY', 'GEMINI_API_KEY', 'CMS_WEBHOOK_SECRET', 'OPS_MONITOR_SECRET',
] as const
export const missingSettings = (env: Record<string, string | undefined> = process.env) => REQUIRED_SETTINGS.filter((k) => !String(env[k] ?? '').trim())

/** Once a day: does Google still answer to the model name? An expired one went unnoticed for weeks in September 2026. */
async function checkGemini(req: PayloadRequest) {
  const key = process.env.GEMINI_API_KEY
  if (!key) return
  const marker = `gemini-check:${new Date().toISOString().slice(0, 10)}`
  const done = await securityDB(req).execute(sql`INSERT INTO operations_health (key, value, created_at, updated_at) VALUES (${marker}, '{}'::jsonb, now(), now()) ON CONFLICT (key) DO NOTHING RETURNING id`)
  if (!done.rows.length) return
  const model = geminiModel()
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`, { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(15000) })
    if (res.status === 404 || res.status === 400) {
      await reportProblem(req, 'gemini-model', `The AI model "${model}" is no longer available, so AI drafts and proposal reading have stopped`, `Google answered ${res.status}: ${(await res.text()).slice(0, 300)} Set GEMINI_MODEL on Railway to the model Google names.`)
    }
  } catch {
    // Unreachable today is not proof the name expired; tomorrow's check tries again.
  }
  await securityDB(req).execute(sql`DELETE FROM operations_health WHERE key LIKE 'gemini-check:%' AND updated_at < now() - interval '7 days'`)
}

export const recordServerError: AfterErrorHook = async ({ error, req }) => {
  const status = (error as { status?: number }).status || 500
  if (status < 500) return
  const key = `errors:${new Date().toISOString().slice(0, 13)}`
  await securityDB(req).execute(sql`INSERT INTO operations_health (key, value, created_at, updated_at) VALUES (${key}, '{"count":1}'::jsonb, now(), now()) ON CONFLICT (key) DO UPDATE SET value = jsonb_build_object('count', COALESCE((operations_health.value->>'count')::int,0)+1), updated_at = now()`).catch(() => {})
}

async function check(req: PayloadRequest) {
  const jobs = await securityDB(req).execute(sql`SELECT count(*) FILTER (WHERE has_error = true AND updated_at > now() - interval '24 hours')::int AS failed, count(*) FILTER (WHERE completed_at IS NULL AND has_error IS DISTINCT FROM true AND ((processing = true AND updated_at < now() - interval '30 minutes') OR (processing IS DISTINCT FROM true AND COALESCE(wait_until, created_at) < now() - interval '30 minutes')))::int AS stalled FROM payload_jobs`)
  const errors = await securityDB(req).execute(sql`SELECT COALESCE(sum((value->>'count')::int),0)::int AS n FROM operations_health WHERE key LIKE 'errors:%' AND updated_at > now() - interval '1 hour'`)
  const result = { checkedAt: new Date().toISOString(), failedJobs: Number(jobs.rows[0]?.failed || 0), stalledJobs: Number(jobs.rows[0]?.stalled || 0), serverErrors: Number(errors.rows[0]?.n || 0), missingSettings: missingSettings() }
  return { ...result, ok: !result.failedJobs && !result.stalledJobs && !result.serverErrors && !result.missingSettings.length }
}

export const operationsHealthTask: TaskConfig<'operationsHealth'> = {
  slug: 'operationsHealth', retries: 0, schedule: [{ cron: '*/5 * * * *', queue: 'default' }],
  outputSchema: [{ name: 'ok', type: 'checkbox' }],
  handler: async ({ req }) => {
    /*
      A task the server was running when it restarted (every push restarts it)
      is never picked up again, and its schedule waits behind it for ever. One
      stuck for half an hour is let go so it runs again, and Ernest is told.
    */
    const released = await securityDB(req).execute(sql`UPDATE payload_jobs SET processing = false, updated_at = now() WHERE completed_at IS NULL AND has_error IS DISTINCT FROM true AND processing = true AND updated_at < now() - interval '30 minutes' RETURNING task_slug`)
    if (released.rows.length) await reportProblem(req, 'jobs-released', `${released.rows.length} background task(s) were stuck and have been restarted`, released.rows.map((r) => String(r.task_slug)).join(', '))
    const health = await check(req)
    // Ernest hears when something is wrong, once a day while it lasts; before, only the six-hourly outside check could notice.
    if (!health.ok) {
      const parts = [
        health.missingSettings.length ? `Settings missing on Railway: ${health.missingSettings.join(', ')}.` : '',
        health.failedJobs ? `${health.failedJobs} background task(s) failed in the last day.` : '',
        health.stalledJobs ? `${health.stalledJobs} background task(s) are waiting and not running.` : '',
        health.serverErrors ? `${health.serverErrors} server error(s) in the last hour.` : '',
      ].filter(Boolean)
      await reportProblem(req, 'health', 'The CMS health check found a problem', parts.join(' '))
    }
    await checkGemini(req).catch(() => {})
    // Once a day, uploads never finished are cleared from storage.
    const sweep = `incoming-sweep:${new Date().toISOString().slice(0, 10)}`
    const first = await securityDB(req).execute(sql`INSERT INTO operations_health (key, value, created_at, updated_at) VALUES (${sweep}, '{}'::jsonb, now(), now()) ON CONFLICT (key) DO NOTHING RETURNING id`)
    if (first.rows.length) await sweepIncoming().catch((err) => reportProblem(req, 'incoming-sweep', 'Clearing unfinished uploads from storage failed', err))
    await securityDB(req).execute(sql`DELETE FROM operations_health WHERE key LIKE 'incoming-sweep:%' AND updated_at < now() - interval '7 days'`)
    await securityDB(req).execute(sql`INSERT INTO operations_health (key, value, created_at, updated_at) VALUES ('heartbeat', ${JSON.stringify(health)}::jsonb, now(), now()) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now()`)
    // Short-lived security material and stale device subscriptions are removed
    // without touching records, active sessions or offline-save receipts.
    await securityDB(req).execute(sql`DELETE FROM security_challenges WHERE expires_at < now() - interval '1 day'`)
    await securityDB(req).execute(sql`DELETE FROM device_sessions WHERE expires_at < now()`)
    await securityDB(req).execute(sql`DELETE FROM trusted_devices t WHERE t.expires_at < now() OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.user_id)`)
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
