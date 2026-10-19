import crypto from 'node:crypto';

/**
 * Opening a client's portal from the team portal, the site half (Ernest,
 * 19 October 2026: several client portals open at the same time, without
 * copying codes). The CMS signs a link for one client that lasts two minutes
 * (cms/src/lib/clientDesk.ts portalLink), only for the founder, and
 * /api/portal-open/ checks it here before adding that client to the browser's
 * portal sessions.
 *
 * Keyed like draft preview (lib/preview.ts): derived from CMS_WEBHOOK_SECRET,
 * which both apps already share, under its own name so a link of one kind can
 * never be used as the other. Change the name here and in the CMS together.
 */
const KEY_INFO = 'quadem:portal-open:v1';

const key = (): Buffer | null => {
  const base = (import.meta.env.CMS_WEBHOOK_SECRET || process.env.CMS_WEBHOOK_SECRET)?.trim();
  return base && base.length >= 16 ? crypto.createHmac('sha256', base).update(KEY_INFO).digest() : null;
};

/** True when the link is the CMS's own, for this client, and has not run out. */
export function verifyPortalOpen(client: string | null, exp: string | null, sig: string | null, now = Date.now()): boolean {
  if (!client || !exp || !sig) return false;
  const expiry = Number(exp);
  if (!Number.isFinite(expiry) || expiry < now) return false;
  const k = key();
  if (!k) return false;
  const expected = crypto.createHmac('sha256', k).update(`${client}:${expiry}`).digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
