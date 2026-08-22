import type { APIRoute } from 'astro';
import { settleInvoice } from '../../lib/paystack';

/**
 * Browser callback after a Paystack checkout.
 *
 * Takes ONLY a reference. It used to accept a `documentId` from the request
 * body and mark that invoice paid on any successful transaction, so anyone
 * could POST a real reference against any invoice id and clear it. Invoice
 * identity now comes from Paystack's echoed metadata, set server-side at
 * initialise time.
 *
 * Deliberately unauthenticated: the webhook cannot carry a session cookie, and
 * the `client_auth` cookie is not a security boundary anyway. Safety comes from
 * settleInvoice's amount/currency assertion and its unique reference index.
 */

// Best-effort per-instance throttle. Vercel serverless has no shared store, so
// this is imperfect by construction: it is here to blunt naive enumeration,
// not as a security control. Every request costs a Paystack round trip, so
// their limits are the real ceiling.
const RATE_LIMIT = 30;
const WINDOW_MS = 5 * 60 * 1000;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || now > entry.resetAt) {
        hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        return false;
    }
    entry.count += 1;
    return entry.count > RATE_LIMIT;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
    const json = (body: unknown, status: number) =>
        new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
        });

    try {
        if (rateLimited(clientAddress || 'unknown')) {
            return json({ ok: false, code: 'RATE_LIMITED', error: 'Too many attempts.' }, 429);
        }

        const { reference } = await request.json();
        const result = await settleInvoice(reference);
        return json(result.body, result.status);
    } catch (error: any) {
        console.error('[paystack] verify endpoint error:', error);
        return json({ ok: false, code: 'UNEXPECTED', error: 'Verification failed.' }, 500);
    }
};
