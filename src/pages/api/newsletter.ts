import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { isValidEmail } from '../../utils/emailValidation';
import { escapeHtml } from '../../lib/html';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

/**
 * The footer form had no method attribute, so it submitted a native GET here.
 * Only POST was exported, so every footer subscribe landed the visitor on a
 * 404. The form now posts, but keep this so a stray GET never shows a 404.
 */
export const GET: APIRoute = () =>
    new Response(null, { status: 303, headers: { Location: '/' } });

export const POST: APIRoute = async ({ request }) => {
    try {
        // Accept both the JSON fetch and a native form POST (the no-JS path).
        const contentType = request.headers.get('content-type') || '';
        let email: string | null;
        let isFormPost = false;

        if (contentType.includes('application/json')) {
            ({ email } = await request.json());
        } else {
            const form = await request.formData();
            email = form.get('email') ? String(form.get('email')) : null;
            isFormPost = true;
        }

        const bounce = (ok: boolean) =>
            new Response(null, {
                status: 303,
                headers: { Location: ok ? '/?subscribed=1' : '/?subscribe_error=1' },
            });

        if (!email) {
            if (isFormPost) return bounce(false);
            return new Response(JSON.stringify({ error: 'Email is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const emailCheck = isValidEmail(email);
        if (!emailCheck.valid) {
            if (isFormPost) return bounce(false);
            return new Response(JSON.stringify({ error: emailCheck.reason }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 1. Add subscriber to Resend Audience
        const { error: contactError } = await resend.contacts.create({
            email,
            audienceId: '6f7f906d-e7ff-4217-b425-1e15eb61e099',
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
                        If you ever need anything or have a project in mind, just reply to this email. It comes straight to me.
                    </p>
                    <br/>
                    <p style="font-size: 16px; margin: 0;">Best regards,</p>
                    <p style="font-size: 16px; font-weight: bold; margin-top: 5px; color: #00AEEF;">Ernest Avorwlanu</p>
                    <p style="font-size: 14px; margin: 2px 0 0; color: #666;">Founder - Quadem Digital Enterprise</p>
                </div>
            </div>
        `;

        const { error: welcomeError } = await resend.emails.send({
            // Sender name matches the signature. A mail from "Quadem Digital"
            // signed by Ernest reads as a mailing list; both saying Ernest reads
            // as a person, which is the whole positioning.
            from: 'Ernest at Quadem Digital <hello@quademdigital.com>',
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
            html: `<p>A new user has subscribed to the newsletter: <strong>${escapeHtml(email)}</strong></p>`,
        });

        if (contactError || welcomeError || internalError) {
            if (isFormPost) return bounce(false);
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

        if (isFormPost) return bounce(true);
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
