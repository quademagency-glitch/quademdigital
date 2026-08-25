import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { isValidEmail } from '../../utils/emailValidation';
import { escapeHtml } from '../../lib/html';
import { mailFrom } from '../../lib/mailFrom';
import { recordSubscriber, unsubscribeUrl, NEWSLETTER_AUDIENCE_ID } from '../../lib/subscribers';

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

        /*
          1. Write to the list first, because that is the record.
             Resend used to be the only place a signup was stored, which meant
             the proof of consent lived in someone else's account and there was
             nowhere to ask whether this person had already opted out.
        */
        const subscriber = await recordSubscriber({
            email,
            source: 'newsletter',
        });

        /*
          Somebody who has already left is not put back on by filling the form
          again. recordSubscriber refuses to move them, so honour that here
          rather than sending them a welcome to a list they are not on.
        */
        if (subscriber && subscriber.status !== 'subscribed') {
            if (isFormPost) return bounce(true);
            return new Response(JSON.stringify({ success: true, message: 'Already handled' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 2. Mirror them into the Resend audience, which is the transport only.
        const { error: contactError } = await resend.contacts.create({
            email,
            audienceId: NEWSLETTER_AUDIENCE_ID,
            unsubscribed: false,
        });

        if (contactError) {
            // Not fatal. The list itself is written above, so a Resend outage
            // costs a mirror row rather than the subscriber.
            console.error('Error adding contact:', contactError);
        }

        /*
          Every marketing email carries a way off the list. Before this there
          was none on anything except a Resend broadcast, so the only way out
          of the welcome sequence was to mark it as spam.
        */
        const unsubLink = subscriber?.unsubscribeToken
            ? unsubscribeUrl(subscriber.unsubscribeToken)
            : 'https://quademdigital.com/contact/';
        const unsubFooter = `
                <div style="padding: 18px 30px 0; border-top: 1px solid #eee; margin-top: 24px;">
                    <p style="font-size: 12px; color: #888; line-height: 1.6; margin: 0;">
                        You are getting this because you subscribed at quademdigital.com.
                        <a href="${escapeHtml(unsubLink)}" style="color: #888;">Unsubscribe or choose what you hear about</a>.
                    </p>
                    <p style="font-size: 12px; color: #888; margin: 8px 0 0;">Quadem Digital Enterprise, Cape Coast, Ghana</p>
                </div>`;

        /*
          3. Welcome the subscriber.
             Rewritten in the first person. It said "we", "our newsletter" and
             "we're thrilled", which promises a team that does not exist, and
             the very next line inviting a reply straight to him contradicted
             the sentence above it.
        */
        const welcomeHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <div style="background-color: #050814; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="color: #00AEEF; margin: 0;">You are on the list</h1>
                </div>
                <div style="padding: 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
                    <p style="font-size: 16px;">Hi there,</p>
                    <p style="font-size: 16px; line-height: 1.6;">
                        Thank you for subscribing. About once a week I send one email on what is
                        genuinely working right now in search, web design and short video for
                        businesses here in Ghana. Real examples, not theory.
                    </p>
                    <p style="font-size: 16px; line-height: 1.6;">
                        If you ever need anything, or have a project in mind, just reply to this
                        email. It comes straight to me, because there is no one else here.
                    </p>
                    <br/>
                    <p style="font-size: 16px; margin: 0;">Best regards,</p>
                    <p style="font-size: 16px; font-weight: bold; margin-top: 5px; color: #00AEEF;">Ernest Avorwlanu</p>
                    <p style="font-size: 14px; margin: 2px 0 0; color: #666;">Founder, Quadem Digital Enterprise</p>
                    ${unsubFooter}
                </div>
            </div>
        `;

        const { error: welcomeError } = await resend.emails.send({
            // Sender name matches the signature. A mail from "Quadem Digital"
            // signed by Ernest reads as a mailing list; both saying Ernest reads
            // as a person, which is the whole positioning.
            from: mailFrom('Ernest at Quadem Digital'),
            to: [email],
            subject: 'You are on the list',
            html: welcomeHtml,
        });

        if (welcomeError) {
            console.error('Error sending welcome email:', welcomeError);
        }

        // 4. Tell Ernest.
        // Was addressed to hello@, which Resend has suppressed since it hard-bounced
        // on 2026-06-05, so every subscriber notification was accepted by the API
        // and then silently discarded. See the same fix in submit-form.ts.
        const { error: internalError } = await resend.emails.send({
            from: mailFrom('Quadem Digital'),
            to: [import.meta.env.ERNEST_EMAIL || 'ernest@quademdigital.com'],
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
