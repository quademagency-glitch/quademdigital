import crypto from 'node:crypto';

/**
 * Signed portal sessions.
 *
 * `client_auth` used to hold the client slug in plain text. httpOnly stops
 * page JavaScript reading it, but it does nothing to stop someone *sending*
 * one — a cookie is just a request header. Slugs are derived from the client
 * name ("quadem", "omek-gh"), so `Cookie: client_auth=quadem` was a complete
 * authentication bypass: no access code, no guessing, straight into that
 * client's portal.
 *
 * It also defeated the invoice access token, because the invoice page accepts
 * a matching session as an alternative to the token.
 *
 * The cookie now carries `slug.signature`, signed with a server-side secret.
 * The slug is still readable — it is not a secret — but it can no longer be
 * changed without the key.
 *
 * Existing unsigned cookies fail verification, so everyone is signed out once.
 * That is the correct outcome: those cookies were forgeable.
 */

function secret(): string | null {
  const s = import.meta.env.PORTAL_SESSION_SECRET?.trim();
  // No fallback on purpose. A default would be identical across every
  // deployment and therefore forgeable by anyone who has seen this file.
  return s && s.length >= 16 ? s : null;
}

export function signSession(slug: string): string | null {
  const key = secret();
  if (!key) {
    console.error('[session] PORTAL_SESSION_SECRET missing or too short');
    return null;
  }
  const sig = crypto.createHmac('sha256', key).update(slug).digest('base64url');
  return `${slug}.${sig}`;
}

/**
 * Returns the slug only if the signature is intact, otherwise null.
 * Callers must treat null as "not logged in".
 */
export function verifySession(value: string | undefined | null): string | null {
  if (!value) return null;
  const key = secret();
  if (!key) return null;

  // rsplit: slugs cannot contain '.', but splitting from the right is still
  // the safer parse if that ever changes.
  const idx = value.lastIndexOf('.');
  if (idx <= 0) return null;

  const slug = value.slice(0, idx);
  const provided = value.slice(idx + 1);
  const expected = crypto.createHmac('sha256', key).update(slug).digest('base64url');

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  return slug;
}

/**
 * Signed admin sessions, for the campaign tools.
 *
 * `admin_auth` used to hold the literal string "authenticated", which is the
 * same bug the portal cookie had: httpOnly stops page JavaScript reading it and
 * does nothing to stop anyone sending it. `Cookie: admin_auth=authenticated`
 * was a complete bypass of the campaign sender.
 *
 * Worse, the three endpoints behind it took the password in the request body
 * and the page shipped that password to the browser in plain text, so it was
 * readable in view-source by anyone who loaded the login screen. The endpoints
 * now read this cookie instead, and no secret reaches the client at all.
 *
 * Signed with PORTAL_SESSION_SECRET, the same server key as the portal, but
 * over a domain-separated message so a portal session can never be replayed as
 * an admin one. Client slugs are slugified to lowercase alphanumerics and
 * hyphens, so the '|' below cannot appear in one.
 */
const ADMIN_SUBJECT = 'admin|campaigns';

export function signAdminSession(): string | null {
  const key = secret();
  if (!key) {
    console.error('[session] PORTAL_SESSION_SECRET missing or too short');
    return null;
  }
  return crypto.createHmac('sha256', key).update(ADMIN_SUBJECT).digest('base64url');
}

export function verifyAdminSession(value: string | undefined | null): boolean {
  if (!value) return false;
  const expected = signAdminSession();
  if (!expected) return false;

  const a = Buffer.from(value, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Access codes for new clients. The existing ones are six numeric digits —
 * a million possibilities, which is minutes of guessing against an endpoint
 * with no limit. These are ~62^12.
 */
export function generateAccessCode(length = 12): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
