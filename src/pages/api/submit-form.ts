import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { isValidEmail } from '../../utils/emailValidation';

const NEWSLETTER_AUDIENCE_ID = '6f7f906d-e7ff-4217-b425-1e15eb61e099';
const LEAD_NURTURE_EVENT = 'lead.created';

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export const POST: APIRoute = async ({ request }) => {
    const resendApiKey = import.meta.env.RESEND_API_KEY;
    const notificationEmail = import.meta.env.PUBLIC_CONTACT_EMAIL || 'hello@quademdigital.com';
    try {
        const body = await request.json();
        const { source, name, email, message, metadata, budget, services, magnetRequested } = body;

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
            const leadRes = await fetch(`${baseUrl}/api/leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: source || 'other',
                    magnetRequested: magnetRequested || null,
                    name,
                    email,
                    message,
                    budget: budget || null,
                    servicesInterested: Array.isArray(services) && services.length ? services : null,
                    metadata: metadata ? { raw: metadata } : null,
                    status: 'new'
                })
            });
            if (!leadRes.ok) {
                console.error("Payload rejected the lead:", await leadRes.text());
            }
        } catch (payloadErr) {
            console.error("Failed to save to Payload:", payloadErr);
            // We don't fail the whole request if just Payload fails, so we can still try sending email
        }

        // 2. Send Email via Resend
        if (resendApiKey) {
            try {
                const resend = new Resend(resendApiKey);
                const safeName = escapeHtml(String(name));
                const safeMessage = message ? escapeHtml(String(message)).replace(/\n/g, '<br/>') : '';

                // Build a nice HTML email for the notification
                const htmlBody = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
                        <h2 style="color: #00AEEF; border-bottom: 2px solid #00AEEF; padding-bottom: 10px;">New Lead: ${escapeHtml(String(source || 'Website Form'))}</h2>
                        <p><strong>Name:</strong> ${safeName}</p>
                        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                        ${budget ? `<p><strong>Budget:</strong> ${escapeHtml(String(budget))}</p>` : ''}
                        ${Array.isArray(services) && services.length ? `<p><strong>Services:</strong> ${escapeHtml(services.join(', '))}</p>` : ''}
                        ${safeMessage ? `<p><strong>Message:</strong><br/>${safeMessage}</p>` : ''}
                    </div>
                `;

                const { error: notifyError } = await resend.emails.send({
                    from: 'Quadem Digital <hello@quademdigital.com>',
                    to: notificationEmail,
                    replyTo: email,
                    subject: `New Lead from ${name} via ${source || 'Website'}`,
                    html: htmlBody
                });
                if (notifyError) {
                    console.error("Resend rejected the notification email:", notifyError);
                }

                // 3. Auto-reply to the lead
                const { error: autoReplyError } = await resend.emails.send({
                    from: 'Quadem Digital <hello@quademdigital.com>',
                    to: [email],
                    subject: 'Got your message — we will be in touch soon',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                            <div style="background-color: #050814; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                                <h1 style="color: #00AEEF; margin: 0;">Thanks for reaching out, ${safeName}!</h1>
                            </div>
                            <div style="padding: 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
                                <p style="font-size: 16px; line-height: 1.6;">We've received your message and will get back to you within 24 hours.</p>
                                <p style="font-size: 16px; margin: 0;">Best regards,</p>
                                <p style="font-size: 16px; font-weight: bold; margin-top: 5px; color: #00AEEF;">The Quadem Digital Team</p>
                            </div>
                        </div>
                    `,
                });
                if (autoReplyError) {
                    console.error("Resend rejected the auto-reply email:", autoReplyError);
                }

                // 4. Add the lead to the newsletter audience
                const { error: audienceError } = await resend.contacts.create({
                    email,
                    firstName: name,
                    audienceId: NEWSLETTER_AUDIENCE_ID,
                    unsubscribed: false,
                });
                if (audienceError) {
                    console.error("Failed to add lead to Resend audience:", audienceError);
                }

                // 5. Fire the lead.created event to start the Day 1/3/7 nurture automation
                const { error: nurtureEventError } = await resend.events.send({
                    event: LEAD_NURTURE_EVENT,
                    email,
                    payload: { source: source || 'other', name },
                });
                if (nurtureEventError) {
                    console.error("Failed to fire lead.created nurture event:", nurtureEventError);
                }
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
