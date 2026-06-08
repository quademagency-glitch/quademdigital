import type { APIRoute } from 'astro';
import { sanityClient } from "sanity:client";
import { Resend } from 'resend';

export const OPTIONS: APIRoute = async () => {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
};

export const POST: APIRoute = async ({ request }) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    try {
        const body = await request.json();
        const { documentId } = body;

        if (!documentId) {
             return new Response(JSON.stringify({ error: 'Missing documentId' }), { status: 400, headers });
        }

        // Removed sanityToken check since dataset is public for reads.

        const resendApiKey = import.meta.env.RESEND_API_KEY;
        if (!resendApiKey) {
            return new Response(JSON.stringify({ error: 'Resend API key missing on server' }), { status: 500, headers });
        }

        // Fetch invoice and client details securely on the server
        const query = `*[_type == "invoice" && _id == $id][0]{
            ...,
            client->{clientName, clientEmail}
        }`;
        
        const invoiceData = await sanityClient.fetch(query, { id: documentId });

        if (!invoiceData) {
             return new Response(JSON.stringify({ error: 'Invoice not found in database' }), { status: 404, headers });
        }

        if (!invoiceData.client || !invoiceData.client.clientEmail) {
             return new Response(JSON.stringify({ error: 'Client email not found for this invoice' }), { status: 400, headers });
        }

        const resend = new Resend(resendApiKey);
        
        const portalLink = `https://quademdigital.com/portal`; 
        
        const formatterGHS = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' });
        const formatterUSD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
        
        // Calculate total
        const subtotal = invoiceData.items ? invoiceData.items.reduce((acc: number, item: any) => acc + (item.rate * item.quantity), 0) : 0;
        const taxAmount = subtotal * ((invoiceData.taxRate || 0) / 100);
        const total = subtotal + taxAmount;
        const currency = invoiceData.currency || 'USD';
        const displayAmount = currency === 'GHS' ? formatterGHS.format(total) : formatterUSD.format(total);

        const formattedDate = invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Due on receipt';

        const htmlBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <img src="https://quademdigital.com/images/logo.png" alt="Quadem Digital" style="max-height: 40px;" />
                </div>
                <h2 style="color: #0f172a; font-size: 24px; margin-bottom: 20px;">New Invoice Available: ${invoiceData.invoiceId}</h2>
                <p style="color: #475569; font-size: 16px; line-height: 1.5;">Hi ${invoiceData.client.clientName},</p>
                <p style="color: #475569; font-size: 16px; line-height: 1.5;">An invoice has been generated for your project. You can view the details and make your payment securely from your Client Portal.</p>
                
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0;">
                    <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px; text-transform: uppercase; font-weight: bold;">Invoice Summary</p>
                    <p style="margin: 0 0 5px 0; color: #0f172a; font-size: 16px;"><strong>Amount:</strong> <span style="color: #00AEEF; font-weight: bold; font-size: 18px;">${displayAmount}</span></p>
                    <p style="margin: 0; color: #0f172a; font-size: 16px;"><strong>Due Date:</strong> ${formattedDate}</p>
                </div>

                <div style="text-align: center; margin: 35px 0;">
                    <a href="${portalLink}" style="background-color: #00AEEF; color: white; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block;">View in Client Portal</a>
                </div>
                
                <p style="color: #94a3b8; font-size: 14px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 40px;">
                    If you have any questions, reply to this email or contact us at billing@quademdigital.com
                </p>
            </div>
        `;

        await resend.emails.send({
            from: 'Quadem Digital Billing <billing@quademdigital.com>',
            to: invoiceData.client.clientEmail,
            subject: `New Invoice from Quadem Digital: ${invoiceData.invoiceId}`,
            html: htmlBody
        });

        return new Response(JSON.stringify({ success: true, message: 'Invoice email sent successfully!' }), {
            status: 200,
            headers,
        });

    } catch (error: any) {
        console.error('Send Invoice Email Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
            status: 500,
            headers,
        });
    }
};
