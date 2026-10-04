/**
 * The website's half of electronic signing: calls to the CMS on the signer's
 * behalf.
 *
 * The signer's browser never talks to the CMS. Every call goes from this
 * server with the website's own key, and passes on the visitor's IP address and
 * browser for the signing certificate. The link token is the only thing that
 * identifies the signer; the CMS decides what that token may do.
 */

const CMS = () =>
  (import.meta.env.PUBLIC_PAYLOAD_URL || process.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000').replace(/\/$/, '');

export const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/** The code session lives in a cookie scoped to one signing link. */
export const SESSION_COOKIE = 'qd_sign';
export const cookiePath = (token: string) => `/sign/${token}/`;

export async function cmsSign(action: string, body: Record<string, unknown>) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = import.meta.env.PAYLOAD_API_KEY || process.env.PAYLOAD_API_KEY;
  if (key) headers.Authorization = `users API-Key ${key}`;
  return fetch(`${CMS()}/api/signature-requests/signing/${action}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
}

export function visitorOf(request: Request, clientAddress?: () => string) {
  let fallback = '';
  try { fallback = clientAddress?.() || ''; } catch { /* not available in every adapter */ }
  return {
    ip: (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || fallback,
    ua: request.headers.get('user-agent') || '',
  };
}

export const noStore = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};
