import type { APIRoute } from 'astro';
import { sanityClient } from "sanity:client";
import { Resend } from 'resend';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { source, name, email, message, metadata } = body;

        if (!name || !email) {
            return new Response(JSON.stringify({ error: 'Name and email are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const sanityWriteToken = import.meta.env.SANITY_WRITE_TOKEN;
        const resendApiKey = import.meta.env.RESEND_API_KEY;
        const notificationEmail = 'info@quademdigital.com';

        // 1. Save to Sanity Studio
        if (sanityWriteToken) {
            try {
                const writableClient = sanityClient.withConfig({ token: sanityWriteToken });
                await writableClient.create({
                    _type: 'formSubmission',
                    source: source || 'Website Form',
                    name,
                    email,
                    message,
                    metadata,
                    status: 'new',
                    submittedAt: new Date().toISOString()
                });
            } catch (sanityErr) {
                console.error("Failed to save to Sanity:", sanityErr);
                // We don't fail the whole request if just Sanity fails, so we can still try sending email
            }
        } else {
            console.warn("SANITY_WRITE_TOKEN not found. Skipping saving lead to Sanity.");
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
                // Return success anyway if Sanity succeeded, or fail if both failed.
                if (!sanityWriteToken) {
                     return new Response(JSON.stringify({ error: 'Email failed to send and Sanity was not configured.' }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
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
