import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { isValidEmail } from '../../utils/emailValidation';
import { escapeHtml } from '../../lib/html';
import { alertPipelineFailure } from '../../lib/alert';

const NEWSLETTER_AUDIENCE_ID = '6f7f906d-e7ff-4217-b425-1e15eb61e099';
const LEAD_NURTURE_EVENT = 'lead.created';

/**
 * Read the submission from either a JSON fetch or a native form POST.
 *
 * The forms carry method="POST" so they still work if JavaScript fails, but
 * that submits application/x-www-form-urlencoded. Parsing only JSON meant the
 * no-JS path threw and returned a 500 — the fallback was broken in exactly the
 * situation it existed for.
 */
async function readSubmission(request: Request) {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        return { data: await request.json(), isFormPost: false };
    }

    const form = await request.formData();
    const services = form.getAll('services[]').map(String).filter(Boolean);
    const single = form.get('service');
    if (single) services.push(String(single));

    return {
        data: {
            source: form.get('source'),
            name: form.get('name'),
            email: form.get('email'),
            message: form.get('message'),
            budget: form.get('budget'),
            services,
            metadata: { services, budget: form.get('budget') },
            magnetRequested: form.get('magnetRequested'),
        },
        isFormPost: true,
    };
}

const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

export const POST: APIRoute = async ({ request }) => {
    const resendApiKey = import.meta.env.RESEND_API_KEY;
    const notificationEmail = import.meta.env.PUBLIC_CONTACT_EMAIL || 'hello@quademdigital.com';
    let submission: unknown = null;
    let isFormPost = false;

    try {
        const parsed = await readSubmission(request);
        const body = parsed.data;
        isFormPost = parsed.isFormPost;
        submission = body;

        const { source, name, email, message, metadata, budget, services, magnetRequested } = body;

        // A native form POST has nowhere to render a JSON error, so send the
        // visitor somewhere that explains itself.
        const fail = (status: number, error: string) =>
            isFormPost
                ? new Response(null, { status: 303, headers: { Location: '/contact/?error=1' } })
                : json({ error }, status);

        if (!name || !email) {
            return fail(400, 'Name and email are required');
        }

        const emailCheck = isValidEmail(email);
        if (!emailCheck.valid) {
            return fail(400, emailCheck.reason || 'Invalid email address');
        }

        // 1. Save to Payload.
        // A failure here is a lost lead, so it is escalated by email with the
        // raw submission attached rather than logged. The request still
        // continues to the notification email below, which is the second
        // chance at capturing this lead.
        let leadSaved = false;
        let notified = false;
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
            if (leadRes.ok) {
                leadSaved = true;
            } else {
                await alertPipelineFailure('payload-save', await leadRes.text(), body);
            }
        } catch (payloadErr) {
            await alertPipelineFailure('payload-unreachable', payloadErr, body);
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
                        <p><strong>Email:</strong> <a href="mailto:${escapeHtml(String(email))}">${escapeHtml(String(email))}</a></p>
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
                    // Notification failing on top of a failed Payload save means
                    // the lead exists nowhere at all.
                    notified = false;
                    await alertPipelineFailure('notification-email', notifyError, body);
                } else {
                    notified = true;
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
                    // Non-fatal: the lead is captured, the visitor just gets no receipt.
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
                    // Non-fatal, but it silently breaks the Monday reconciliation count.
                    console.error("Failed to add lead to Resend audience:", audienceError);
                }

                // 5. Fire the lead.created event to start the Day 1/3/7 nurture automation
                const { error: nurtureEventError } = await resend.events.send({
                    event: LEAD_NURTURE_EVENT,
                    email,
                    payload: { source: source || 'other', name },
                });
                if (nurtureEventError) {
                    await alertPipelineFailure('nurture-event', nurtureEventError, body);
                }
            } catch (resendErr) {
                await alertPipelineFailure('resend', resendErr, body);
            }
        } else {
            await alertPipelineFailure(
                'missing-resend-key',
                'RESEND_API_KEY is not set, so no lead email was sent.',
                body,
            );
        }

        // The lead reached neither the CRM nor an inbox. Tell the caller, so the
        // visitor is asked to try WhatsApp instead of walking away believing
        // the message was received.
        if (!leadSaved && !notified) {
            return isFormPost
                ? new Response(null, { status: 303, headers: { Location: '/contact/?error=1' } })
                : json(
                      {
                          error:
                              "We could not record your message. Please reach us on WhatsApp so nothing is lost.",
                      },
                      502,
                  );
        }

        if (isFormPost) {
            return new Response(null, { status: 303, headers: { Location: '/contact/?sent=1' } });
        }

        return json({ success: true, message: 'Your message has been sent successfully!' }, 200);

    } catch (error: any) {
        await alertPipelineFailure('unhandled', error, submission);
        return isFormPost
            ? new Response(null, { status: 303, headers: { Location: '/contact/?error=1' } })
            : json({ error: error.message || 'Internal Server Error' }, 500);
    }
};
