import { createCipheriv, createDecipheriv, createHash, createHmac, pbkdf2Sync, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import { APIError, type Endpoint, type PayloadRequest } from 'payload'
import { audit } from './audit'
import { notify } from './notify'
import { securityDB } from './securityDatabase'

/**
 * Two-step sign-in with an authenticator app (spec 14.11: "a code by email or
 * an authenticator app"). Email codes stay the default (lib/deviceSecurity);
 * a person may choose an app instead: Google Authenticator, Microsoft
 * Authenticator, 1Password and the like all read the same QR code (TOTP,
 * RFC 6238: SHA-1, six digits, thirty seconds).
 *
 * Like the email codes, every check that must hold under concurrent sign-ins
 * is one atomic statement on the security_challenges table, run on the root
 * connection, outside the sign-in's transaction (which has locked the
 * account's row): a code's time step can be claimed once, a recovery code used
 * once, and five wrong codes in fifteen minutes stop further tries. Those rows
 * use buckets with a word in front ("app-step:", "app-fails:", "recovery:"),
 * so the email-code limits never count them.
 *
 * The app's secret is sealed (AES-256-GCM, key from PAYLOAD_SECRET) and never
 * readable through the API, by anyone.
 */

export const STEP_SECONDS = 30
export const MAX_WRONG = 5

/* Base32, TOTP and recovery codes: no database, tested on their own -------- */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export const base32 = (buf: Buffer) => {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}
export const fromBase32 = (s: string) => {
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of s.toUpperCase().replace(/[^A-Z2-7]/g, '')) {
    value = (value << 5) | B32.indexOf(ch)
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

export const newSecret = () => base32(randomBytes(20))

export const hotp = (key: Buffer, counter: number) => {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const mac = createHmac('sha1', key).update(msg).digest()
  const at = mac[mac.length - 1] & 15
  const n = ((mac[at] & 127) << 24) | (mac[at + 1] << 16) | (mac[at + 2] << 8) | mac[at + 3]
  return String(n % 1_000_000).padStart(6, '0')
}

export const stepAt = (ms: number) => Math.floor(ms / 1000 / STEP_SECONDS)

/** The time step a six-digit code belongs to, allowing a phone clock half a minute out either way; or null. */
export function totpStep(secret: string, code: string, now = Date.now()): number | null {
  const c = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(c)) return null
  const key = fromBase32(secret)
  const at = stepAt(now)
  for (const step of [at - 1, at, at + 1]) if (timingSafeEqual(Buffer.from(hotp(key, step)), Buffer.from(c))) return step
  return null
}

export const otpauthUri = (secret: string, email: string) =>
  `otpauth://totp/${encodeURIComponent(`Quadem:${email}`)}?secret=${secret}&issuer=Quadem&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
/** Eight one-time codes such as "k7mq-2xpa", for a lost phone. */
export const recoveryCodes = (n = 8) =>
  Array.from({ length: n }, () => {
    const four = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(0, ALPHABET.length)]).join('')
    return `${four()}-${four()}`
  })
export const isRecoveryShape = (code: string) => /^[a-z0-9]{4}-[a-z0-9]{4}$/i.test(code.trim())
export const recoveryHash = (secret: string, userId: number | string, code: string) =>
  createHmac('sha256', secret).update(`quadem-recovery:${userId}:${code.trim().toLowerCase()}`).digest('hex')

const sealKey = (secret: string) => createHash('sha256').update(`quadem-authenticator:${secret}`).digest()
export const seal = (plain: string, secret: string) => {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', sealKey(secret), iv)
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return `v1.${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${body.toString('base64url')}`
}
export const unseal = (sealed: unknown, secret: string): string | null => {
  const [v, iv, tag, body] = String(sealed ?? '').split('.')
  if (v !== 'v1' || !iv || !tag || !body) return null
  try {
    const d = createDecipheriv('aes-256-gcm', sealKey(secret), Buffer.from(iv, 'base64url'))
    d.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8')
  } catch {
    return null
  }
}

/** The opaque token the sign-in forms carry while asking for an app code; the same 64-hex shape as an email challenge. */
export const appChallenge = (secret: string, userId: number | string) => createHmac('sha256', secret).update(`quadem-app-challenge:${userId}`).digest('hex')

/* Atomic records on security_challenges, outside the sign-in transaction ---- */

const run = (req: PayloadRequest, query: ReturnType<typeof sql>) => securityDB(req).execute(query)
const quarter = () => Math.floor(Date.now() / (15 * 60_000))

async function wrongCodes(req: PayloadRequest, userId: number) {
  const r = await run(req, sql`SELECT attempts FROM security_challenges WHERE bucket = ${`app-fails:${userId}:${quarter()}`}`)
  return Number(r.rows[0]?.attempts ?? 0)
}
async function countWrong(req: PayloadRequest, userId: number) {
  await run(
    req,
    sql`INSERT INTO security_challenges (challenge, bucket, user_id, code_hash, expires_at, attempts, created_at, updated_at)
        VALUES (${randomBytes(32).toString('hex')}, ${`app-fails:${userId}:${quarter()}`}, ${userId}, '', now() + interval '15 minutes', 1, now(), now())
        ON CONFLICT (bucket) DO UPDATE SET attempts = security_challenges.attempts + 1, updated_at = now()`,
  )
}
/** True the first time a step is used for this person; a replayed code gets false. */
async function claimStep(req: PayloadRequest, userId: number, step: number) {
  const r = await run(
    req,
    sql`INSERT INTO security_challenges (challenge, bucket, user_id, code_hash, expires_at, attempts, created_at, updated_at)
        VALUES (${randomBytes(32).toString('hex')}, ${`app-step:${userId}:${step}`}, ${userId}, '', now() + interval '5 minutes', 0, now(), now())
        ON CONFLICT (bucket) DO NOTHING RETURNING bucket`,
  )
  return r.rows.length > 0
}
async function useRecovery(req: PayloadRequest, userId: number, code: string) {
  const r = await run(
    req,
    sql`UPDATE security_challenges SET used_at = now(), updated_at = now()
        WHERE user_id = ${userId} AND bucket LIKE ${`recovery:${userId}:%`} AND code_hash = ${recoveryHash(req.payload.secret, userId, code)} AND used_at IS NULL
        RETURNING bucket`,
  )
  return r.rows.length > 0
}
async function storeRecovery(req: PayloadRequest, userId: number, codes: string[]) {
  await run(req, sql`DELETE FROM security_challenges WHERE user_id = ${userId} AND bucket LIKE ${`recovery:${userId}:%`}`)
  const batch = randomBytes(4).toString('hex')
  for (const [i, code] of codes.entries()) {
    await run(
      req,
      sql`INSERT INTO security_challenges (challenge, bucket, user_id, code_hash, expires_at, attempts, created_at, updated_at)
          VALUES (${randomBytes(32).toString('hex')}, ${`recovery:${userId}:${batch}:${i}`}, ${userId}, ${recoveryHash(req.payload.secret, userId, code)}, now() + interval '10 years', 0, now(), now())`,
    )
  }
}
async function recoveryLeft(req: PayloadRequest, userId: number) {
  const r = await run(req, sql`SELECT count(*)::int AS n FROM security_challenges WHERE user_id = ${userId} AND bucket LIKE ${`recovery:${userId}:%`} AND used_at IS NULL`)
  return Number(r.rows[0]?.n ?? 0)
}
const clearRecovery = (req: PayloadRequest, userId: number) => run(req, sql`DELETE FROM security_challenges WHERE user_id = ${userId} AND bucket LIKE ${`recovery:${userId}:%`}`)

/* At sign-in --------------------------------------------------------------- */

type Account = { id: number; email?: string; twoStepMethod?: string | null; totpSecret?: string | null; hash?: string; salt?: string }

export const usesApp = (u: { twoStepMethod?: string | null }) => u.twoStepMethod === 'app'

/**
 * The second step for someone who chose an app. Called from
 * lib/deviceSecurity's beforeLogin, after the password and after a trusted
 * device has had its chance. A 428 with the app challenge asks the form for
 * the code; the forms then show "Code from your authenticator app".
 */
export async function appSecondStep(req: PayloadRequest, user: Account) {
  const challenge = appChallenge(req.payload.secret, user.id)
  const code = String((req.data as { securityCode?: unknown } | undefined)?.securityCode ?? '').replace(/\s/g, '')
  if (!code) throw new APIError('Enter the six-digit code from your authenticator app.', 428, { securityChallenge: challenge, method: 'app' }, true)
  if ((await wrongCodes(req, user.id)) >= MAX_WRONG) throw new APIError('Too many wrong codes. Wait 15 minutes, then try again.', 429, null, true)
  const secret = unseal(user.totpSecret, req.payload.secret)
  const step = secret ? totpStep(secret, code) : null
  if (step !== null && (await claimStep(req, user.id, step))) {
    req.context.emailCodeVerified = true
    return
  }
  if (isRecoveryShape(code) && (await useRecovery(req, user.id, code))) {
    req.context.emailCodeVerified = true
    await notify(req, {
      to: [user.id],
      kind: 'security',
      title: 'A recovery code was used to sign in to Quadem',
      body: `${await recoveryLeft(req, user.id)} recovery codes are left; you can make new ones on your profile. If this was not you, change your password and tell Ernest.`,
      link: '/profile',
      important: true,
      action: 'Open your profile',
    })
    return
  }
  await countWrong(req, user.id)
  throw new APIError('That code is not right, or it was already used. Enter the newest code from your app.', 428, { securityChallenge: challenge, method: 'app' }, true)
}

/* Setting it up, from the team portal's Profile ------------------------------ */

type Pending = { secret: string; expires: number }
type Row = Account & { totpPending?: Pending | null; twoStepAppSince?: string | null; role?: string; isManager?: boolean | null; twoStep?: boolean | null; name?: string | null }

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const bodyOf = async (req: PayloadRequest) => ((req.data ?? (await req.json?.().catch(() => null))) ?? {}) as Record<string, unknown>
const account = (req: PayloadRequest, id: number | string) => req.payload.db.findOne<Row>({ collection: 'users', where: { id: { equals: id } } }) as Promise<Row | null>
const write = (req: PayloadRequest, id: number, data: Record<string, unknown>) =>
  req.payload.db.updateOne({ collection: 'users', id, data: { ...data, updatedAt: null }, returning: false })

/** Payload's own password check (pbkdf2, as in its local strategy), limited to five tries in fifteen minutes. */
async function passwordOk(req: PayloadRequest, u: Row, password: unknown) {
  const bucket = `password-check:${u.id}:${quarter()}`
  const tries = await run(
    req,
    sql`INSERT INTO security_challenges (challenge, bucket, user_id, code_hash, expires_at, attempts, created_at, updated_at)
        VALUES (${randomBytes(32).toString('hex')}, ${bucket}, ${u.id}, '', now() + interval '15 minutes', 1, now(), now())
        ON CONFLICT (bucket) DO UPDATE SET attempts = security_challenges.attempts + 1, updated_at = now() RETURNING attempts`,
  )
  if (Number(tries.rows[0]?.attempts ?? 0) > MAX_WRONG) throw new APIError('Too many tries. Wait 15 minutes, then try again.', 429, null, true)
  if (typeof password !== 'string' || !password || !u.hash || !u.salt) return false
  const given = pbkdf2Sync(password, u.salt, 25000, 512, 'sha256')
  const stored = Buffer.from(u.hash, 'hex')
  return given.length === stored.length && timingSafeEqual(given, stored)
}

const signedIn = (req: PayloadRequest) => (req.user && ['admin', 'team'].includes(String(req.user.role)) ? Number(req.user.id) : null)

export const authenticatorEndpoints: Endpoint[] = [
  {
    /* Whether the person uses an app, since when, and how many recovery codes are left. */
    path: '/security/app',
    method: 'get',
    handler: async (req) => {
      const id = signedIn(req)
      const u = id ? await account(req, id) : null
      if (!u) return json({ error: 'Sign in first.' }, 401)
      return json({ method: usesApp(u) ? 'app' : 'email', since: usesApp(u) ? (u.twoStepAppSince ?? null) : null, recoveryLeft: usesApp(u) ? await recoveryLeft(req, u.id) : 0 })
    },
  },
  {
    /* With the password: a new secret for the app, shown once as a QR code and as text. Nothing changes until it is confirmed. */
    path: '/security/app/start',
    method: 'post',
    handler: async (req) => {
      const id = signedIn(req)
      const u = id ? await account(req, id) : null
      if (!u) return json({ error: 'Sign in first.' }, 401)
      if (!(await passwordOk(req, u, (await bodyOf(req)).password))) return json({ error: 'That password is not right.' }, 400)
      const secret = newSecret()
      await write(req, u.id, { totpPending: { secret: seal(secret, req.payload.secret), expires: Date.now() + 15 * 60_000 } })
      return json({ secret, uri: otpauthUri(secret, String(u.email)) })
    },
  },
  {
    /* A code from the app proves it is set up; codes come from it from now on. Eight recovery codes, shown this once. */
    path: '/security/app/confirm',
    method: 'post',
    handler: async (req) => {
      const id = signedIn(req)
      const u = id ? await account(req, id) : null
      if (!u) return json({ error: 'Sign in first.' }, 401)
      if ((await wrongCodes(req, u.id)) >= MAX_WRONG) return json({ error: 'Too many wrong codes. Wait 15 minutes, then try again.' }, 429)
      const pending = u.totpPending
      const sealed = pending && pending.expires > Date.now() ? pending.secret : null
      const secret = sealed ? unseal(sealed, req.payload.secret) : null
      if (!secret) return json({ error: 'That set-up has expired. Start again.' }, 400)
      const step = totpStep(secret, String((await bodyOf(req)).code ?? ''))
      if (step === null || !(await claimStep(req, u.id, step))) {
        await countWrong(req, u.id)
        return json({ error: 'That code is not right. Enter the code the app shows now.' }, 400)
      }
      const codes = recoveryCodes()
      await write(req, u.id, { twoStepMethod: 'app', totpSecret: sealed, totpPending: null, twoStepAppSince: new Date().toISOString(), twoStep: true })
      await storeRecovery(req, u.id, codes)
      await audit(req, { action: 'two-step.app', summary: 'Two-step sign-in: codes from an authenticator app', person: u.id, subjectType: 'users', subjectId: u.id })
      return json({ ok: true, recoveryCodes: codes })
    },
  },
  {
    /* With the password: back to codes by email. */
    path: '/security/app/off',
    method: 'post',
    handler: async (req) => {
      const id = signedIn(req)
      const u = id ? await account(req, id) : null
      if (!u) return json({ error: 'Sign in first.' }, 401)
      if (!(await passwordOk(req, u, (await bodyOf(req)).password))) return json({ error: 'That password is not right.' }, 400)
      await write(req, u.id, { twoStepMethod: 'email', totpSecret: null, totpPending: null, twoStepAppSince: null })
      await clearRecovery(req, u.id)
      await audit(req, { action: 'two-step.email', summary: 'Two-step sign-in: back to codes by email', person: u.id, subjectType: 'users', subjectId: u.id })
      return json({ ok: true })
    },
  },
  {
    /* With the password: eight new recovery codes; the old ones stop working. */
    path: '/security/app/recovery',
    method: 'post',
    handler: async (req) => {
      const id = signedIn(req)
      const u = id ? await account(req, id) : null
      if (!u) return json({ error: 'Sign in first.' }, 401)
      if (!usesApp(u)) return json({ error: 'Recovery codes are for an authenticator app.' }, 400)
      if (!(await passwordOk(req, u, (await bodyOf(req)).password))) return json({ error: 'That password is not right.' }, 400)
      const codes = recoveryCodes()
      await storeRecovery(req, u.id, codes)
      return json({ recoveryCodes: codes })
    },
  },
  {
    /*
      Ernest clears someone's app, for a lost phone: they get codes by email
      again, and every device they trusted has to prove itself again (a lost
      phone may be one of them).
    */
    path: '/:id/security/app/reset',
    method: 'post',
    handler: async (req) => {
      if (req.user?.role !== 'admin') return json({ error: 'Only Ernest can reset this.' }, 403)
      const u = await account(req, Number(req.routeParams?.id))
      if (!u) return json({ error: 'Not found.' }, 404)
      await write(req, u.id, { twoStepMethod: 'email', totpSecret: null, totpPending: null, twoStepAppSince: null })
      await clearRecovery(req, u.id)
      await run(req, sql`DELETE FROM trusted_devices WHERE user_id = ${u.id}`)
      await audit(req, { action: 'two-step.reset', summary: 'Authenticator app reset by Ernest; codes by email again', person: u.id, subjectType: 'users', subjectId: u.id })
      await notify(req, {
        to: [u.id],
        kind: 'security',
        title: 'Ernest reset your authenticator app',
        body: 'You will get sign-in codes by email again. You can set up an app again on your profile.',
        link: '/profile',
        important: true,
        action: 'Open your profile',
      })
      return json({ ok: true })
    },
  },
]
