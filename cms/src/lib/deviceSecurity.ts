import { securityDB, sessionID } from './securityDatabase'
import { acceptTrustedDevice, rememberVerifiedDevice, revokeTrustedDevices, setTrustCookie } from './trustedDevices'
import { createHmac, randomBytes, randomInt } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import { APIError, jwtSign, type CollectionBeforeLoginHook, type CollectionAfterLoginHook, type CollectionBeforeOperationHook, type CollectionAfterOperationHook, type Endpoint, type PayloadRequest } from 'payload'

export const needsTwoStep = (u: { role?: string | null; isManager?: boolean | null; twoStep?: boolean | null }) =>
  u.role === 'admin' || (u.role === 'team' && (u.isManager || u.twoStep))

export const codeHash = (secret: string, challenge: string, user: number | string, code: string) =>
  createHmac('sha256', secret).update(`quadem-sign-in:${challenge}:${user}:${code}`).digest('hex')

export const deviceLabel = (ua: string) => {
  const os = /iPhone|iPad/.test(ua) ? 'iPhone or iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Macintosh|Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Device'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  return `${browser} on ${os}`
}

// These statements deliberately use the adapter's root connection, outside a
// failed login transaction: rejected attempts and issued codes must survive it.
const execute = (req: PayloadRequest, query: ReturnType<typeof sql>) => securityDB(req).execute(query)

async function issue(req: PayloadRequest, user: { id: number; email: string }) {
  const minute = Math.floor(Date.now() / 60_000)
  const bucket = `${user.id}:${minute}`
  const old = await execute(req, sql`SELECT challenge FROM security_challenges WHERE bucket = ${bucket} AND used_at IS NULL AND attempts < 5`)
  if (old.rows.length) return String(old.rows[0].challenge)
  const recent = await execute(req, sql`SELECT count(*)::int AS n FROM security_challenges WHERE user_id = ${user.id} AND created_at > now() - interval '1 hour'`)
  if (Number(recent.rows[0]?.n) >= 5) throw new APIError('Too many codes requested. Wait an hour before asking for another.', 429)
  const challenge = randomBytes(32).toString('hex')
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const inserted = await execute(req, sql`INSERT INTO security_challenges (challenge, bucket, user_id, code_hash, expires_at, attempts, created_at, updated_at) VALUES (${challenge}, ${bucket}, ${user.id}, ${codeHash(req.payload.secret, challenge, user.id, code)}, now() + interval '5 minutes', 0, now(), now()) ON CONFLICT (bucket) DO NOTHING RETURNING challenge`)
  if (!inserted.rows.length) {
    const retry = await execute(req, sql`SELECT challenge FROM security_challenges WHERE bucket = ${bucket} AND used_at IS NULL AND attempts < 5`)
    if (retry.rows.length) return String(retry.rows[0].challenge)
    throw new APIError('Wait a minute before requesting another code.', 429)
  }
  try {
    await req.payload.sendEmail({
      to: user.email, subject: 'Your Quadem sign-in code',
      text: `Your Quadem sign-in code is ${code}. It expires in 5 minutes and works once. If you did not try to sign in, change your password. Never share this code.`,
      html: `<p>Your Quadem sign-in code is:</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px">${code}</p><p>It expires in 5 minutes and works once. If you did not try to sign in, change your password. Never share this code.</p>`,
    })
  } catch {
    await execute(req, sql`DELETE FROM security_challenges WHERE challenge = ${challenge}`)
    throw new APIError('Your sign-in code could not be emailed. Try again in a minute.', 503)
  }
  return challenge
}

export const securityBeforeOperation: CollectionBeforeOperationHook = ({ operation, req, args }) => {
  // Resetting a password may succeed, but must not create a usable session.
  if (operation === 'resetPassword') req.context.securityPasswordReset = true
  return args
}

export const securityBeforeLogin: CollectionBeforeLoginHook = async ({ user, req }) => {
  if (req.context.securityPasswordReset || !needsTwoStep(user)) return user
  const challenge = String(req.data?.securityChallenge ?? '')
  const code = String(req.data?.securityCode ?? '').replace(/\s/g, '')
  if (!challenge && !code && !req.context.requireEmailCode && await acceptTrustedDevice(req, user.id)) return user
  if (challenge && code) {
    const hash = codeHash(req.payload.secret, challenge, user.id, code)
    // Atomic compare-and-consume: concurrent requests cannot reuse a correct
    // code or race past the five-attempt limit. Password is rechecked first.
    const checked = await execute(req, sql`UPDATE security_challenges SET attempts = attempts + 1, used_at = CASE WHEN code_hash = ${hash} THEN now() ELSE NULL END, updated_at = now() WHERE challenge = ${challenge} AND user_id = ${user.id} AND expires_at > now() AND used_at IS NULL AND attempts < 5 RETURNING used_at`)
    if (!checked.rows[0]?.used_at) throw new APIError('That code is incorrect, expired or already used. Try again, or request a new code.', 428, { securityChallenge: challenge })
    req.context.emailCodeVerified = true
    return user
  }
  throw new APIError('Enter the six-digit code sent to your email. Keep this page open.', 428, { securityChallenge: await issue(req, user) })
}

export const securityAfterLogin: CollectionAfterLoginHook = async ({ req, user, token }) => {
  if (req.context.securityPasswordReset) return user
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as { sid?: string; exp?: number }
  const label = deviceLabel(req.headers.get('x-quadem-device') || req.headers.get('user-agent') || '')
  await rememberVerifiedDevice(req, user.id, label)
  if (claims.sid) {
    await execute(req, sql`INSERT INTO device_sessions (sid, user_id, label, expires_at, trusted_device_id, created_at, updated_at) VALUES (${claims.sid}, ${user.id}, ${label}, ${new Date((claims.exp ?? 0) * 1000).toISOString()}, ${req.context.trustedDeviceId ?? null}, now(), now()) ON CONFLICT (sid) DO NOTHING`)
  }
  return user
}

export const securityAfterOperation: CollectionAfterOperationHook = async ({ operation, result, req }) => {
  if (operation === 'login' || operation === 'refresh') {
    const login = result as { token?: string; refreshedToken?: string; exp?: number; user?: { id: number; role?: string } }
    const token = login.token || login.refreshedToken
    if (token && login.user?.role === 'admin') {
      const { exp: _exp, iat: _iat, ...claims } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
      const user = await req.payload.db.findOne<{ id: number; sessions?: { id: string; createdAt: string; expiresAt: string }[] }>({ collection: 'users', where: { id: { equals: login.user.id } }, req })
      const session = user?.sessions?.find((s) => s.id === claims.sid)
      const remaining = session ? Math.floor((new Date(session.createdAt).getTime() + 12 * 60 * 60 * 1000 - Date.now()) / 1000) : 0
      if (remaining <= 0) throw new APIError('Sign in again to continue.', 401)
      const signed = await jwtSign({ fieldsToSign: claims, secret: req.payload.secret, tokenExpiration: remaining })
      if (operation === 'login') login.token = signed.token
      else login.refreshedToken = signed.token
      login.exp = signed.exp
      const sessions = (user?.sessions ?? []).map((s: { id: string; expiresAt: string }) => s.id === claims.sid ? { ...s, expiresAt: new Date(signed.exp * 1000).toISOString() } : s)
      await req.payload.db.updateOne({ collection: 'users', id: login.user.id, data: { sessions }, req, returning: false })
    }
    return result
  }
  if (operation !== 'resetPassword') return result
  const reset = result as { token?: string; user?: { id: number } }
  if (reset.user) {
    // The password reset already ended the old sessions. Remove its newly
    // minted one as well, before any token or cookie can leave the CMS.
    await execute(req, sql`DELETE FROM users_sessions WHERE _parent_id = ${reset.user.id}`)
    await execute(req, sql`DELETE FROM trusted_devices WHERE user_id = ${reset.user.id}`)
    setTrustCookie(req, '', 0)
    reset.token = undefined
  }
  return result
}

export const deviceEndpoints: Endpoint[] = [
  { path: '/security', method: 'post', handler: async (req) => {
    if (!req.user || !['team', 'admin'].includes(req.user.role || '')) return Response.json({ error: 'Sign in first.' }, { status: 401 })
    const data = (req.data ?? await req.json?.()) as { password?: string; securityChallenge?: string; securityCode?: string; enabled?: boolean }
    if (req.user.role === 'admin' || req.user.isManager) return Response.json({ error: 'Two-step sign-in is required for the founder and managers.' }, { status: 403 })
    const owner = req.user
    const fresh = await req.payload.login({ collection: 'users', data: { email: owner.email, password: data.password || '' }, req: { ...req, user: null, data, context: { requireEmailCode: true } } })
    const sid = JSON.parse(Buffer.from(fresh.token!.split('.')[1], 'base64url').toString()).sid
    await execute(req, sql`DELETE FROM users_sessions WHERE _parent_id = ${owner.id} AND id = ${sid}`)
    // Only this password-confirmed endpoint can change the preference.
    await execute(req, sql`UPDATE users SET two_step = ${data.enabled === true}, updated_at = now() WHERE id = ${owner.id}`)
    await execute(req, sql`DELETE FROM trusted_devices WHERE user_id = ${owner.id}`)
    setTrustCookie(req, '', 0)
    return Response.json({ ok: true })
  } },
  { path: '/devices', method: 'get', handler: async (req) => {
    if (!req.user || !['admin', 'team'].includes(req.user.role || '')) return Response.json({ error: 'Sign in first.' }, { status: 401 })
    const rows = await execute(req, sql`SELECT s.id, s.created_at, s.expires_at, COALESCE(d.label, 'Earlier sign-in') AS label FROM users_sessions s LEFT JOIN device_sessions d ON d.sid = s.id WHERE s._parent_id = ${req.user.id} AND s.expires_at > now() ORDER BY s.created_at DESC`)
    const trusted = await execute(req, sql`SELECT t.id, t.label, t.created_at, t.expires_at, t.last_used_at, EXISTS(SELECT 1 FROM device_sessions d WHERE d.sid = ${sessionID(req) || ''} AND d.user_id = ${req.user.id} AND d.trusted_device_id = t.id) AS current FROM trusted_devices t WHERE t.user_id = ${req.user.id} AND t.expires_at > now() ORDER BY t.last_used_at DESC`)
    return Response.json({ devices: rows.rows.map((s) => ({ id: s.id, label: s.label, createdAt: s.created_at, expiresAt: s.expires_at, current: s.id === sessionID(req) })), trustedDevices: trusted.rows.map((d) => ({ id: d.id, label: d.label, createdAt: d.created_at, expiresAt: d.expires_at, lastUsedAt: d.last_used_at, current: d.current })), required: req.user.role === 'admin' || Boolean(req.user.isManager), enabled: Boolean(needsTwoStep(req.user)) }, { headers: { 'Cache-Control': 'no-store' } })
  } },
  { path: '/trusted-devices/revoke', method: 'post', handler: async (req) => {
    if (!req.user || !['team', 'admin'].includes(req.user.role || '')) return Response.json({ error: 'Sign in first.' }, { status: 401 })
    const data = (req.data ?? await req.json?.()) as { id?: unknown }
    const id = Number(data?.id)
    if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: 'Choose a trusted device.' }, { status: 400 })
    const current = await revokeTrustedDevices(req, req.user.id, id)
    if (current) setTrustCookie(req, '', 0)
    return Response.json({ ok: true, current })
  } },
  { path: '/devices/revoke', method: 'post', handler: async (req) => {
    if (!req.user) return Response.json({ error: 'Sign in first.' }, { status: 401 })
    const data = (req.data ?? await req.json?.()) as { id?: string } | undefined
    const sid = String(data?.id ?? '')
    const device = await execute(req, sql`SELECT trusted_device_id FROM device_sessions WHERE user_id = ${req.user.id} AND sid = ${sid}`)
    const trustId = Number(device.rows[0]?.trusted_device_id)
    const revokedHere = trustId ? await revokeTrustedDevices(req, req.user.id, trustId) : false
    await execute(req, sql`DELETE FROM users_sessions WHERE _parent_id = ${req.user.id} AND id = ${sid}`)
    await execute(req, sql`DELETE FROM push_subscriptions WHERE user_id = ${req.user.id} AND sid = ${sid}`)
    const current = revokedHere || sid === sessionID(req)
    if (current) setTrustCookie(req, '', 0)
    return Response.json({ ok: true, current })
  } },
]
