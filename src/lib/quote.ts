/**
 * The website's half of quotations: calls to the CMS on the client's behalf.
 *
 * The client's browser never talks to the CMS. Every call goes from this
 * server with the website's own key and the link's token, and the CMS answers
 * with only what the client may see (cms/src/lib/quoteDesk.ts).
 */

const CMS = () =>
  (import.meta.env.PUBLIC_PAYLOAD_URL || process.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000').replace(/\/$/, '');

export const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

export async function cmsQuote(action: 'open' | 'accept' | 'decline', body: Record<string, unknown>) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = import.meta.env.PAYLOAD_API_KEY || process.env.PAYLOAD_API_KEY;
  if (key) headers.Authorization = `users API-Key ${key}`;
  return fetch(`${CMS()}/api/proposals/quote-link/${action}`, {
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

const SYMBOL: Record<string, string> = { GHS: 'GH₵', NGN: '₦', USD: '$', KES: 'KSh ', ZAR: 'R', GBP: '£', EUR: '€' };

/** GH₵4,500 or GH₵4,500.50, the way invoices write it. */
export function money(amount: number, currency: string) {
  const whole = Number.isInteger(amount);
  const n = amount.toLocaleString('en-GB', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
  return `${SYMBOL[currency] ?? `${currency} `}${n}`;
}
