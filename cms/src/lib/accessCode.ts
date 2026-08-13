import crypto from 'node:crypto'

/**
 * Portal access codes.
 *
 * The old codes were six characters from `Math.random().toString(36)` — about a
 * million possibilities, from a generator that is not cryptographically secure,
 * guarding client files, timelines and invoices behind a login endpoint with no
 * meaningful throttle. These are 56^14.
 *
 * Ambiguous characters (0/O, 1/l/I) are omitted: this gets read off a screen in
 * an email and typed by hand, and a code nobody can transcribe is a support call.
 *
 * Lives here rather than inline so the field hook and the won-lead conversion
 * cannot drift into inventing codes by different rules — which is exactly what
 * had happened.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

export function generateAccessCode(length = 14): string {
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}
