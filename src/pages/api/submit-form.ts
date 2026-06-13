import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { isValidEmail } from '../../utils/emailValidation';

export const POST: APIRoute = async ({ request }) => {
    const resendApiKey = import.meta.env.RESEND_API_KEY;
    const notificationEmail = import.meta.env.PUBLIC_CONTACT_EMAIL || 'hello@quademdigital.com';
    try {
        const body = await request.json();
        const { source, name, email, message, metadata } = body;

        if (!name || !email) {
            return new Response(JSON.stringify({ error: 'Name and email are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const emailCheck = isValidEmail(email);
        if (!emailCheck.valid) {
            return new Response(JSON.stringify({ error: emailCheck.reason }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 1. Save to Payload
        try {
            const baseUrl = import.meta.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';
            await fetch(`${baseUrl}/api/leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: source || 'Website Form',
                    name,
                    email,
                    message,
                    metadata: metadata ? { raw: metadata } : null,
                    status: 'new'
                })
            });
        } catch (payloadErr) {
            console.error("Failed to save to Payload:", payloadErr);
            // We don't fail the whole request if just Payload fails, so we can still try sending email
        }

        // 2. Send Email via Resend
        if (resendApiKey) {
            try {
                const resend = new Resend(resendApiKey);
                
                // Build a nice HTML email for the notification
                const htmlBody = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
                        <h2 style="color: #00AEEF; border-bottom: 2px solid #00AEEF; padding-bottom: 10px;">New Lead: ${source || 'Website Form'}</h2>
                        <p><strong>Name:</strong> ${name}</p>
                        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                        ${message ? `<p><strong>Message:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>` : ''}
                        ${metadata ? `<div style="background: #eef; padding: 15px; border-radius: 6px; margin-top: 15px;"><p><strong>Additional Info:</strong><br/>${metadata}</p></div>` : ''}
                    </div>
                `;

                await resend.emails.send({
                    from: 'Quadem Digital <hello@quademdigital.com>',
                    to: notificationEmail,
                    replyTo: email,
                    subject: `New Lead from ${name} via ${source || 'Website'}`,
                    html: htmlBody
                });
            } catch (resendErr) {
                console.error("Failed to send Resend email:", resendErr);
                // Return success anyway if Payload succeeded, or fail if both failed.
                return new Response(JSON.stringify({ error: 'Email failed to send.' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        } else {
            console.warn("RESEND_API_KEY not found. Skipping email notification.");
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Your message has been sent successfully!'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Submit Form API Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
