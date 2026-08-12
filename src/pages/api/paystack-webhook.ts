import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { settleInvoice } from '../../lib/paystack';

/**
 * Paystack webhook — the answer to "money taken, write failed".
 *
 * Before this existed, the browser callback was the ONLY path that could mark
 * an invoice paid. If the customer closed the tab, lost connection, or the
 * verify call failed, the money moved and nothing recorded it. Paystack retries
 * failed webhooks, and settleInvoice is idempotent (unique reference index), so
 * settlement now self-heals within minutes.
 */
export const POST: APIRoute = async ({ request }) => {
    // .trim(): the HMAC is keyed on this. A stray newline silently makes every
    // signature mismatch, which would look like a forged webhook.
    const secret = import.meta.env.PAYSTACK_SECRET_KEY?.trim();
    if (!secret) {
        console.error('[paystack-webhook] PAYSTACK_SECRET_KEY missing');
        return new Response('not configured', { status: 503 });
    }

    // The signature is over the RAW body. Parsing to JSON and re-stringifying
    // reorders/reformats and the HMAC will never match.
    const raw = await request.text();
    const signature = request.headers.get('x-paystack-signature') || '';
    const expected = crypto.createHmac('sha512', secret).update(raw).digest('hex');

    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        console.error('[paystack-webhook] bad signature');
        return new Response('invalid signature', { status: 401 });
    }

    let event: any;
    try {
        event = JSON.parse(raw);
    } catch {
        return new Response('bad payload', { status: 400 });
    }

    if (event?.event !== 'charge.success') {
        // Acknowledge everything else so Paystack stops retrying it.
        return new Response('ignored', { status: 200 });
    }

    const result = await settleInvoice(event?.data?.reference);

    // Return non-2xx on a genuine settle failure so Paystack retries. Client
    // errors (already paid, amount mismatch) are terminal — retrying will not
    // change them, so acknowledge and rely on the logged alarm instead.
    if (result.status >= 500) {
        return new Response('settle failed, retry', { status: 500 });
    }
    return new Response('ok', { status: 200 });
};
