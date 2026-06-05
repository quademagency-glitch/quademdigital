import type { APIRoute } from 'astro';
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
            return new Response(JSON.stringify({ error: 'Email is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 1. Add subscriber to Resend Audience
        const { error: contactError } = await resend.contacts.create({
            email,
            unsubscribed: false,
        });

        if (contactError) {
            console.error('Error adding contact:', contactError);
            // We proceed anyway to try to send the welcome email even if audience add fails
        }

        // 2. Send Welcome Email to the Subscriber
        const welcomeHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <div style="background-color: #050814; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="color: #00AEEF; margin: 0;">Welcome to Quadem Digital! 🚀</h1>
                </div>
                <div style="padding: 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
                    <p style="font-size: 16px;">Hi there,</p>
                    <p style="font-size: 16px; line-height: 1.6;">
                        Thank you for subscribing to our newsletter! We're thrilled to have you on board. 
                        Every week, we'll share our top digital growth tips, web design insights, and marketing strategies 
                        to help elevate your brand.
                    </p>
                    <p style="font-size: 16px; line-height: 1.6;">
                        If you ever need anything or have a project in mind, just reply to this email. We'd love to hear from you.
                    </p>
                    <br/>
                    <p style="font-size: 16px; margin: 0;">Best regards,</p>
                    <p style="font-size: 16px; font-weight: bold; margin-top: 5px; color: #00AEEF;">The Quadem Digital Team</p>
                </div>
            </div>
        `;

        const { error: welcomeError } = await resend.emails.send({
            from: 'Quadem Digital <hello@quademdigital.com>',
            to: [email],
            subject: 'Welcome to Quadem Digital! 🚀',
            html: welcomeHtml,
        });

        if (welcomeError) {
            console.error('Error sending welcome email:', welcomeError);
        }

        // 3. Send Internal Notification Email
        const { error: internalError } = await resend.emails.send({
            from: 'Quadem Digital <hello@quademdigital.com>',
            to: ['hello@quademdigital.com'],
            subject: '🎉 New Newsletter Subscriber!',
            html: `<p>A new user has subscribed to the newsletter: <strong>${email}</strong></p>`,
        });

        if (contactError || welcomeError || internalError) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Resend API Error',
                contactError,
                welcomeError,
                internalError
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ success: true, message: 'Subscribed successfully' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Newsletter API Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
