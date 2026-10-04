import crypto from 'node:crypto'

/**
 * The secrets that make a signing link private.
 *
 * Each signer gets a random link token. The database keeps its SHA-256, which
 * is what an incoming link is looked up by, so a copy of the database cannot be
 * turned back into working links. It also keeps the token sealed with a key
 * derived from PAYLOAD_SECRET, because Ernest needs to copy a signer's link to
 * send it by WhatsApp, and a hash cannot be shown back to him.
 *
 * A signer asked for a code gets a session after entering it: a signed value
 * that says "this signer, until this time", kept in a cookie on the signing
 * page. It is checked on every later request, so a link forwarded to someone
 * else is no use without the code that went to the original inbox.
 */

const secret = () => {
  const s = process.env.PAYLOAD_SECRET
  if (!s) throw new Error('PAYLOAD_SECRET is not set, so signing links cannot be made.')
  return s
}
const key = (purpose: string) => crypto.createHash('sha256').update(`${secret()}:signing:${purpose}`).digest()

export const newToken = () => crypto.randomBytes(24).toString('base64url')
export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

export const sealToken = (token: string) => {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key('seal'), iv)
  const body = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString('base64url')).join('.')
}

export const openToken = (sealed: string | null | undefined): string | null => {
  if (!sealed) return null
  try {
    const [iv, tag, body] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'))
    const decipher = crypto.createDecipheriv('aes-256-gcm', key('seal'), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

const SESSION_HOURS = 2

export const makeSession = (sessionId: string | number, now = Date.now()) => {
  const until = now + SESSION_HOURS * 3_600_000
  const sig = crypto.createHmac('sha256', key('session')).update(`${sessionId}.${until}`).digest('base64url')
  return `${until}.${sig}`
}

export const checkSession = (sessionId: string | number, value: unknown, now = Date.now()) => {
  if (typeof value !== 'string') return false
  const [until, sig] = value.split('.')
  if (!until || !sig || Number(until) < now) return false
  const expected = crypto.createHmac('sha256', key('session')).update(`${sessionId}.${until}`).digest('base64url')
  const a = Buffer.from(sig), b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** Six digits, and the hash it is checked against. */
export const newCode = () => {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  return { code, hash: crypto.createHmac('sha256', key('code')).update(code).digest('hex') }
}
export const codeMatches = (code: string, hash: string | null | undefined) => {
  if (!hash || !/^\d{6}$/.test(code)) return false
  const a = Buffer.from(crypto.createHmac('sha256', key('code')).update(code).digest('hex'))
  const b = Buffer.from(hash)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export const sha256 = (data: Uint8Array) => crypto.createHash('sha256').update(data).digest('hex')
