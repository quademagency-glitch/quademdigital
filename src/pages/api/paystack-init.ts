import type { APIRoute } from 'astro';

/**
 * Start a Paystack checkout with server-authoritative parameters.
 *
 * Previously the browser called PaystackPop.setup() with an amount, currency,
 * email and reference all computed client-side, and the reference embedded a
 * `documentId` that was undefined. Everything that matters is now decided here:
 * the amount comes from the invoice's stored amountMinor, and metadata.invoiceId
 * is what settlement later trusts to identify the invoice.
 *
 * Requires the invoice's access token, so this cannot be used to enumerate
 * invoices or to generate checkouts for someone else's bill.
 */
export const POST: APIRoute = async ({ request }) => {
    const json = (body: unknown, status: number) =>
        new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
        });

    // .trim(): these are pasted into dashboards by hand and a trailing newline
    // or space survives the paste. Paystack answers a whitespace-padded key
    // with "Invalid key", which reads as a wrong key rather than a dirty one.
    const secret = import.meta.env.PAYSTACK_SECRET_KEY?.trim();
    const payloadToken = import.meta.env.PAYLOAD_API_KEY?.trim();
    const baseUrl = import.meta.env.PUBLIC_PAYLOAD_URL?.trim().replace(/\/+$/, '');
    const site = (import.meta.env.PUBLIC_SITE_URL?.trim() || 'https://quademdigital.com').replace(/\/+$/, '');

    if (!secret || !payloadToken || !baseUrl) {
        console.error('[paystack-init] missing config');
        return json({ ok: false, error: 'Payments are not configured.' }, 503);
    }

    try {
        const { invoiceId, token } = await request.json();
        if (!invoiceId || !token) {
            return json({ ok: false, error: 'Missing invoice or token.' }, 400);
        }

        const query = new URLSearchParams({
            'where[invoiceId][equals]': String(invoiceId),
            depth: '1',
            limit: '1',
        });
        const res = await fetch(`${baseUrl}/api/invoices?${query}`, {
            headers: { Authorization: `users API-Key ${payloadToken}` },
        });
        if (!res.ok) return json({ ok: false, error: 'Could not load the invoice.' }, 502);

        const invoice = (await res.json())?.docs?.[0];
        // 404 rather than 403 on a bad token, so this cannot confirm which
        // invoice ids exist.
        if (!invoice || !invoice.accessToken || invoice.accessToken !== token) {
            return json({ ok: false, error: 'Not found.' }, 404);
        }
        if (String(invoice.status).toLowerCase() === 'paid') {
            return json({ ok: false, error: 'This invoice is already paid.' }, 409);
        }

        const amountMinor = Number(invoice.amountMinor);
        if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
            return json({ ok: false, error: 'This invoice has no payable amount.' }, 409);
        }

        const email = invoice.client?.clientEmail;
        if (!email) return json({ ok: false, error: 'This invoice has no client email.' }, 409);

        const reference = `INV-${invoice.invoiceId}-${crypto.randomUUID().slice(0, 12)}`;

        const initRes = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                amount: amountMinor,
                currency: String(invoice.currency || 'USD').toUpperCase(),
                reference,
                // Settlement reads invoiceId back off this. It is the only
                // trusted link between a payment and an invoice.
                metadata: { invoiceId: invoice.invoiceId },
                callback_url: `${site}/invoice/${encodeURIComponent(invoice.invoiceId)}/?t=${encodeURIComponent(token)}&ref=${encodeURIComponent(reference)}`,
            }),
        });
        const initData = await initRes.json();
        if (!initRes.ok || !initData?.status) {
            console.error('[paystack-init] initialize failed:', initRes.status, initData);
            // A 401/403 means OUR key is wrong, not anything the client did.
            // Relaying Paystack's wording verbatim showed a paying client the
            // words "Invalid key", which reads as though their card was refused
            // and is an internal detail they cannot act on. Tell them the truth
            // at their level and put the cause in the log.
            if (initRes.status === 401 || initRes.status === 403) {
                return json(
                    { ok: false, error: 'Online payment is temporarily unavailable. Please use the bank transfer details above, or contact us.' },
                    503,
                );
            }
            return json({ ok: false, error: initData?.message || 'Could not start payment.' }, 502);
        }

        return json({ ok: true, authorizationUrl: initData.data.authorization_url, reference }, 200);
    } catch (error: any) {
        console.error('[paystack-init] error:', error);
        return json({ ok: false, error: 'Could not start payment.' }, 500);
    }
};
