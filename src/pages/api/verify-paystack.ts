import type { APIRoute } from "astro";
import { sanityClient } from "sanity:client";

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

        const sanityToken = import.meta.env.SANITY_WRITE_TOKEN;
        if (!sanityToken) {
            return new Response(JSON.stringify({ error: 'Sanity write token missing on server' }), { status: 500 });
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

        // Payment is valid! Update Sanity Invoice Status securely
        const writeClient = sanityClient.withConfig({ token: sanityToken });
        await writeClient.patch(documentId).set({ status: 'Paid' }).commit();

        return new Response(JSON.stringify({ success: true, message: 'Invoice updated to Paid successfully!' }), { status: 200 });

    } catch (error: any) {
        console.error('Verify Paystack Error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
