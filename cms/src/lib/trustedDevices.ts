import { createHmac, randomBytes } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import type { CollectionAfterChangeHook, CollectionAfterLogoutHook, CollectionBeforeChangeHook, PayloadRequest } from 'payload'
import { securityDB, securityTransaction, sessionID } from './securityDatabase'

export const TRUST_COOKIE = 'qd_trusted_device'
export const TRUST_SECONDS = 30 * 24 * 60 * 60
export const trustedTokenHash = (secret: string, token: string) => createHmac('sha256', secret).update(`quadem-trusted-device:${token}`).digest('hex')

const dbFor = async (req: PayloadRequest) => req.transactionID ? securityTransaction(req) : securityDB(req)

export const readTrustedToken = (req: PayloadRequest) => {
  const value = (req.headers.get('cookie') || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${TRUST_COOKIE}=`))?.slice(TRUST_COOKIE.length + 1)
  return value && /^[a-f0-9]{64}$/.test(value) ? value : ''
}

export function setTrustCookie(req: PayloadRequest, token: string, seconds = TRUST_SECONDS) {
  req.responseHeaders ||= new Headers()
  req.responseHeaders.append('Set-Cookie', `${TRUST_COOKIE}=${token}; Path=/; Max-Age=${seconds}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
}

// Bind trust to the current credentials and security role, not to a mutable
// browser label. Password/email/role changes invalidate even a retained cookie.
async function credentialHash(req: PayloadRequest, userId: number | string) {
  const user = await req.payload.db.findOne<{ id: number } & Record<string, unknown>>({ collection: 'users', where: { id: { equals: userId } }, req })
  if (!user?.hash || !user.salt) throw new Error('Local credentials are required to trust a device.')
  return createHmac('sha256', req.payload.secret).update(JSON.stringify([
    'quadem-trust-credentials', user.id, user.hash, user.salt, user.email, user.role, Boolean(user.isManager), Boolean(user.twoStep), user.status,
  ])).digest('hex')
}

/** Called only after Payload has verified the password. */
export async function acceptTrustedDevice(req: PayloadRequest, userId: number | string) {
  const token = readTrustedToken(req)
  if (!token) return false
  const hash = trustedTokenHash(req.payload.secret, token)
  const credentials = await credentialHash(req, userId)
  const db = await dbFor(req)
  const result = await db.execute(sql`UPDATE trusted_devices SET last_used_at = now(), updated_at = now() WHERE token_hash = ${hash} AND user_id = ${userId} AND credential_hash = ${credentials} AND expires_at > now() RETURNING id`)
  if (!result.rows[0]) return false
  req.context.trustedDeviceId = Number(result.rows[0].id)
  return true
}

/** Only a freshly verified email code may create or renew device trust. */
export async function rememberVerifiedDevice(req: PayloadRequest, userId: number | string, label: string) {
  if (req.context.emailCodeVerified !== true || req.data?.trustDevice !== true) return
  const token = randomBytes(32).toString('hex')
  const hash = trustedTokenHash(req.payload.secret, token)
  const credentials = await credentialHash(req, userId)
  const db = await dbFor(req)
  const oldToken = readTrustedToken(req)
  // Keep the record ID when renewing this browser, so revocation still reaches
  // all its signed-in sessions, including those made before renewal.
  const renewed = oldToken ? await db.execute(sql`UPDATE trusted_devices SET token_hash = ${hash}, credential_hash = ${credentials}, label = ${label}, expires_at = now() + ${TRUST_SECONDS} * interval '1 second', last_used_at = now(), updated_at = now() WHERE user_id = ${userId} AND token_hash = ${trustedTokenHash(req.payload.secret, oldToken)} RETURNING id`) : null
  const result = renewed?.rows[0] ? renewed : await db.execute(sql`INSERT INTO trusted_devices (token_hash, user_id, credential_hash, label, expires_at, last_used_at, created_at, updated_at) VALUES (${hash}, ${userId}, ${credentials}, ${label}, now() + ${TRUST_SECONDS} * interval '1 second', now(), now(), now()) RETURNING id`)
  req.context.trustedDeviceId = Number(result.rows[0].id)
  setTrustCookie(req, token)
}

/** Forget trust and end its associated sessions atomically, scoped to its owner. */
export async function revokeTrustedDevices(req: PayloadRequest, userId: number | string, id?: number) {
  const db = await dbFor(req)
  const target = id === undefined ? sql`` : sql`AND id = ${id}`
  const result = await db.execute(sql`WITH forgotten AS (
    DELETE FROM trusted_devices WHERE user_id = ${userId} ${target} RETURNING id
  ), ended AS (
    DELETE FROM users_sessions WHERE _parent_id = ${userId} AND id IN (
      SELECT sid FROM device_sessions WHERE user_id = ${userId} AND trusted_device_id IN (SELECT id FROM forgotten)
    ) RETURNING id
  ), cleared AS (
    DELETE FROM push_subscriptions WHERE user_id = ${userId} AND sid IN (SELECT id FROM ended)
  ) SELECT EXISTS(SELECT 1 FROM ended WHERE id = ${sessionID(req) || ''}) AS current`)
  return Boolean(result.rows[0]?.current)
}

export const trustBeforeChange: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  if (operation === 'update' && originalDoc && (Boolean(data.password) ||
    ['email', 'role', 'isManager', 'twoStep', 'status'].some((field) => field in data && data[field] !== originalDoc[field]))) {
    req.context.revokeDeviceTrustUserId = String(originalDoc.id)
  }
  return data
}

export const trustAfterChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (req.context.revokeDeviceTrustUserId === String(doc.id)) {
    const db = await dbFor(req)
    // Changes to credentials invalidate trust. Existing session policy remains
    // with Payload; a password reset already ends every authenticated session.
    await db.execute(sql`DELETE FROM trusted_devices WHERE user_id = ${doc.id}`)
    delete req.context.revokeDeviceTrustUserId
    if (req.user?.id === doc.id) setTrustCookie(req, '', 0)
  }
  return doc
}

export const trustAfterLogout: CollectionAfterLogoutHook = async ({ req }) => {
  if (req.user && req.searchParams?.get('allSessions') === 'true') {
    await revokeTrustedDevices(req, req.user.id)
    setTrustCookie(req, '', 0)
  }
}
