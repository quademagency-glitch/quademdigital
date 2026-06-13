import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { reference, documentId } = body;

        if (!reference || !documentId) {
            return new Response(JSON.stringify({ error: 'Missing reference or documentId' }), { status: 400 });
        }

        const paystackSecret = import.meta.env.PAYSTACK_SECRET_KEY;
        if (!paystackSecret) {
            return new Response(JSON.stringify({ error: 'Paystack secret key missing on server' }), { status: 500 });
        }

        const payloadToken = import.meta.env.PAYLOAD_API_KEY;
        if (!payloadToken) {
            return new Response(JSON.stringify({ error: 'Payload API Key missing on server' }), { status: 500 });
        }

        // Verify the transaction with Paystack
        const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${paystackSecret}`
            }
        });

        const paystackData = await paystackRes.json();

        if (!paystackRes.ok || !paystackData.status) {
            return new Response(JSON.stringify({ error: paystackData.message || 'Payment verification failed' }), { status: 400 });
        }

        if (paystackData.data.status !== 'success') {
            return new Response(JSON.stringify({ error: `Payment status is ${paystackData.data.status}` }), { status: 400 });
        }

        // Payment is valid! Update Payload Invoice Status securely
        const baseUrl = import.meta.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';
        await fetch(`${baseUrl}/api/invoices/${documentId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `users API-Key ${payloadToken}`
            },
            body: JSON.stringify({ status: 'Paid' })
        });

        return new Response(JSON.stringify({ success: true, message: 'Invoice updated to Paid successfully!' }), { status: 200 });

    } catch (error: any) {
        console.error('Verify Paystack Error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
