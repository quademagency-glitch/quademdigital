import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { isValidEmail } from '../../utils/emailValidation';
import { escapeHtml } from '../../lib/html';
import { alertPipelineFailure } from '../../lib/alert';
import { mailFrom } from '../../lib/mailFrom';
import { recordSubscriber, mayEmail, NEWSLETTER_AUDIENCE_ID } from '../../lib/subscribers';
import { renderEmail, p as para, html as htmlPara, link } from '../../lib/emailTemplate';
import { sendConfirmation } from '../../lib/confirmSubscription';
import { buildPayloadImageUrl } from '../../lib/payload';


const LEAD_NURTURE_EVENT = 'lead.created';

/**
 * Read the submission from either a JSON fetch or a native form POST.
 *
 * The forms carry method="POST" so they still work if JavaScript fails, but
 * that submits application/x-www-form-urlencoded. Parsing only JSON meant the
 * no-JS path threw and returned a 500: the fallback was broken in exactly the
 * situation it existed for.
 */
/*
  Campaign attribution, read off the cookie /global sets before paint.

  It rides on the cookie rather than a hidden input because the interesting case
  is a visitor who lands on /global from a cold email, reads it, and then fills
  in the ordinary contact form on another page a minute later. A hidden input
  only carries attribution on the one page that renders it.

  Lands in Leads.metadata, which is a `json` field, so it needs no schema
  change. Deliberately NOT written to Leads.source: that is a Postgres enum, and
  a value not in its list makes Payload reject the entire document while the
  notification email still sends, so the lead is lost with nothing to show for
  it. That has already happened once on this project.
*/
function readCampaign(request: Request): Record<string, string> | null {
    try {
        const cookie = request.headers.get('cookie') || '';
        const m = cookie.match(/(?:^|;\s*)qd_utm=([^;]*)/);
        if (!m) return null;
        const parsed = JSON.parse(decodeURIComponent(m[1]));
        if (!parsed || typeof parsed !== 'object') return null;
        // Only the keys we set, capped, so a forged cookie cannot bloat a record.
        const allow = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'ref'];
        const out: Record<string, string> = {};
        for (const k of allow) {
            const v = parsed[k];
            if (typeof v === 'string' && v) out[k] = v.slice(0, 120);
        }
        return Object.keys(out).length ? out : null;
    } catch {
        return null;
    }
}

async function readSubmission(request: Request) {
    const contentType = request.headers.get('content-type') || '';
    const campaign = readCampaign(request);

    if (contentType.includes('application/json')) {
        const data = await request.json();
        if (campaign) {
            data.metadata = { ...(typeof data.metadata === 'object' && data.metadata ? data.metadata : {}), campaign };
        }
        return { data, isFormPost: false, returnTo: null };
    }

    const form = await request.formData();
    const services = form.getAll('services[]').map(String).filter(Boolean);
    const single = form.get('service');
    if (single) services.push(String(single));

    /*
      Service-page question answers, posted as `q_<key>`.

      Mirrors collectQualifiers() in src/scripts/main.js. Without this the
      no-JavaScript path saves the lead and drops every answer, which is worse
      than failing: the enquiry looks complete and the qualifying information is
      simply absent.
    */
    const answers: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
        if (!key.startsWith('q_')) continue;
        const text = String(value).trim();
        if (text) answers[key.slice(2)] = text;
    }

    return {
        data: {
            source: form.get('source'),
            name: form.get('name'),
            email: form.get('email'),
            message: form.get('message'),
            budget: form.get('budget'),
            services,
            metadata: {
                services,
                budget: form.get('budget'),
                ...(Object.keys(answers).length ? { answers } : {}),
                ...(campaign ? { campaign } : {}),
            },
            magnetRequested: form.get('magnetRequested'),
            newsletterOptIn: form.get('newsletterOptIn'),
        },
        isFormPost: true,
        /*
          Where to send someone who submitted without JavaScript. Every redirect
          in here was hardcoded to /contact/, so filling in the form on
          /services/seo/ landed you on a different page with no explanation of
          what had just happened. Only same-origin paths are honoured, so a
          crafted `returnTo` cannot turn this endpoint into an open redirect.
        */
        returnTo: safeReturnTo(form.get('returnTo')),
    };
}

/** A site-relative path, or null. Anything absolute or protocol-relative is refused. */
function safeReturnTo(value: FormDataEntryValue | null): string | null {
    if (typeof value !== 'string') return null;
    const path = value.trim();
    if (!path.startsWith('/') || path.startsWith('//')) return null;
    if (/[\r\n]/.test(path)) return null;
    return path;
}

const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

export const POST: APIRoute = async ({ request }) => {
    const resendApiKey = import.meta.env.RESEND_API_KEY;
    // hello@ is not a real mailbox. It hard-bounced on 2026-06-05 and Resend has
    // suppressed it ever since, so every lead notification sent here was accepted
    // by the API, returned no error, and then silently dropped: a $10k enquiry on
    // 2026-07-27 was never delivered. ERNEST_EMAIL is the address the rest of the
    // codebase already notifies (alert.ts, chase-invoices, weekly-report) and is
    // verified deliverable. PUBLIC_CONTACT_EMAIL still overrides, for when a real
    // hello@ mailbox exists.
    const notificationEmail = import.meta.env.PUBLIC_CONTACT_EMAIL
        || import.meta.env.ERNEST_EMAIL
        || 'ernest@quademdigital.com';
    let submission: unknown = null;
    let isFormPost = false;
    /*
      Where a no-JavaScript submit goes when it is done. Defaults to the contact
      page, which is right for the contact page and wrong for everywhere else
      that now carries a form.
    */
    let backTo = '/contact/';

    try {
        const parsed = await readSubmission(request);
        const body = parsed.data;
        isFormPost = parsed.isFormPost;
        if (parsed.returnTo) backTo = parsed.returnTo;
        submission = body;

        const { source, name, email, message, metadata, budget, services, magnetRequested, leadId } = body;

        /*
          Did they actually ask to join the list?

          Arrives as a real boolean from the JSON forms and as the string "yes"
          from a native form post and from the calculator, which serialises the
          whole FormData. An absent value is the unticked box, which is the
          default and the answer "no".
        */
        const optedIn =
            body.newsletterOptIn === true ||
            body.newsletterOptIn === 'yes' ||
            body.newsletterOptIn === 'on';

        /*
          Enrichment pass. The contact wizard submits as soon as it has a name
          and email (step 2) and sends the id back when the visitor completes
          the last step, so abandoning at "what's your budget?" no longer means
          the lead is lost. Only fills fields in, never blanks them, and skips
          the notification/auto-reply/nurture side effects: those already ran
          on the initial submit.
        */
        if (leadId) {
            const baseUrl = import.meta.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';
            const patch: Record<string, unknown> = {};
            if (budget) patch.budget = budget;
            if (Array.isArray(services) && services.length) patch.servicesInterested = services;
            if (message) patch.message = message;
            if (metadata) patch.metadata = typeof metadata === 'string' ? { raw: metadata } : metadata;

            // Leads.create is public but Leads.update is not, so unlike the
            // create above this call must be authenticated.
            const payloadToken = import.meta.env.PAYLOAD_API_KEY;

            try {
                const res = await fetch(`${baseUrl}/api/leads/${encodeURIComponent(String(leadId))}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(payloadToken ? { Authorization: `users API-Key ${payloadToken}` } : {}),
                    },
                    body: JSON.stringify(patch),
                });
                if (!res.ok) {
                    await alertPipelineFailure('lead-enrich', await res.text(), body);
                }
            } catch (err) {
                await alertPipelineFailure('lead-enrich', err, body);
            }

            /*
              The wizard's tick box is on the last step, so this enrichment call
              is the first time consent is heard about. Without this, ticking it
              on the contact page would do nothing at all: the lead was already
              created at step 2 and the code below never runs again.
            */
            if (optedIn && email) {
                const sub = await recordSubscriber({
                    email,
                    name,
                    source: 'contact-form',
                    sourceDetail: source || null,
                    status: 'pending',
                });
                if (sub?.status === 'pending' && sub.unsubscribeToken) {
                    await sendConfirmation(email, sub.unsubscribeToken);
                }
            }

            // Always report success: the lead itself was captured at step 2 with
            // name, email and services. Only the budget is at risk here, and
            // showing the visitor an error for a message we already have would
            // invite them to submit again.
            return json({ success: true, leadId }, 200);
        }

        // A native form POST has nowhere to render a JSON error, so send the
        // visitor somewhere that explains itself.
        const fail = (status: number, error: string) =>
            isFormPost
                ? new Response(null, { status: 303, headers: { Location: `${backTo}?error=1` } })
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
        let createdLeadId: string | number | null = null;
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
                    // Callers send either a structured object (the offers form, the
                    // no-JS form path) or a plain string. Wrapping an object in
                    // `raw` would bury its keys one level deeper for no reason, so
                    // only strings get wrapped.
                    metadata: metadata
                        ? (typeof metadata === 'string' ? { raw: metadata } : metadata)
                        : null,
                    status: 'new'
                })
            });
            if (leadRes.ok) {
                leadSaved = true;
                createdLeadId = (await leadRes.json())?.doc?.id ?? null;
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
                    from: mailFrom('Quadem Digital'),
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
                /*
                  The receipt, and it now knows what was claimed.

                  Someone who filled in the Free SEO Audit form got back
                  "Thanks for reaching out, I've got your message", with no
                  mention of the audit anywhere. The offer they came for was
                  recorded in the CMS and never acknowledged, so the strongest
                  call to action on the site ended in a generic reply.

                  The offer's own description is quoted back rather than a
                  promise written here, so this email cannot say something the
                  offer page does not.
                */
                let claimed:
                    | {
                        title: string;
                        description?: string;
                        slug?: string;
                        deliverable?: { url?: string; filename?: string } | null;
                        deliverableLabel?: string | null;
                    }
                    | null = null;
                if (magnetRequested) {
                    try {
                        const base = import.meta.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';
                        // depth=1, so the attached file comes back as a document
                        // with a URL rather than as an id this cannot resolve.
                        const r = await fetch(
                            `${base}/api/offers?where[title][equals]=${encodeURIComponent(String(magnetRequested))}&limit=1&depth=1`,
                        );
                        if (r.ok) claimed = (await r.json())?.docs?.[0] ?? null;
                    } catch {
                        // Falls back to the general receipt below.
                    }
                }

                /*
                  The download, when the offer has one.

                  `magnetRequested` was recorded and nothing was ever sent, so
                  the site's strongest call to action ended in a promise to be
                  in touch. An offer that is a service still ends that way and
                  should. An offer that is a file now arrives with the file.
                */
                const deliverableUrl = claimed?.deliverable?.url
                    ? buildPayloadImageUrl(claimed.deliverable)
                    : '';
                const deliverableLabel =
                    (claimed?.deliverableLabel || '').trim() || 'Download your copy';

                const receiptBody = claimed
                    ? [
                        para(`Hi ${safeName},`),
                        para(`You have claimed: ${claimed.title}.`),
                        ...(claimed.description ? [para(claimed.description)] : []),
                        ...(deliverableUrl
                            ? [para('It is on the button below. The link keeps working, so there is no rush.')]
                            : []),
                        para('I will come back to you personally within 24 hours to get started.'),
                        htmlPara(
                            `If it is urgent, WhatsApp me on ${link('+233 53 089 0302', 'https://wa.me/233530890302')}. ` +
                            'You will be talking to me, not an account manager.',
                        ),
                    ].join('')
                    : [
                        para(`Hi ${safeName},`),
                        para("I have got your message and I will come back to you personally within 24 hours."),
                        htmlPara(
                            `If it is urgent, WhatsApp me on ${link('+233 53 089 0302', 'https://wa.me/233530890302')}. ` +
                            'You will be talking to me, not an account manager.',
                        ),
                    ].join('');

                const { error: autoReplyError } = await resend.emails.send({
                    // Founder-led, consistently. The site sells "you work
                    // directly with the person building your brand", then the
                    // first email a lead ever received was signed "The Quadem
                    // Digital Team", which invites them to conclude either
                    // that the studio is smaller than it claims or that their
                    // project gets handed off. Both read worse than the truth.
                    from: mailFrom('Ernest at Quadem Digital'),
                    to: [email],
                    subject: claimed
                        ? `Got it: ${claimed.title}`
                        : 'Got your message, I will be in touch soon',
                    /*
                      No unsubscribe link, deliberately. This is the receipt for
                      something they just did, not marketing, and offering to
                      unsubscribe from a reply to your own enquiry reads as a
                      brush-off. The newsletter, which they may have ticked on
                      the same form, carries one.
                    */
                    html: await renderEmail({
                        heading: claimed ? 'Got it, thank you' : `Thanks for reaching out, ${safeName}`,
                        preheader: claimed
                            ? deliverableUrl
                                ? `${claimed.title} is ready to download.`
                                : `${claimed.title}. I will be in touch within 24 hours.`
                            : 'I will be in touch within 24 hours.',
                        bodyHtml: receiptBody,
                        /*
                          One button, and the file wins it. Sending somebody
                          back to the page they just filled in, when the thing
                          they asked for is sitting in the same email, is the
                          weaker of the two by a distance.
                        */
                        ...(deliverableUrl
                            ? { cta: { label: deliverableLabel, url: deliverableUrl } }
                            : claimed?.slug
                                ? { cta: { label: 'Look at the offer again', url: `https://quademdigital.com/offers/${claimed.slug}/` } }
                                : {}),
                    }),
                });
                if (autoReplyError) {
                    // Non-fatal: the lead is captured, the visitor just gets no receipt.
                    console.error("Resend rejected the auto-reply email:", autoReplyError);
                }

                /*
                  4. Put the enquirer on the list, as PENDING and with no
                     consent date.

                     Neither the contact form nor the offer forms ask anyone to
                     join a newsletter: there is no tick box on either. So this
                     records that the address exists and where it came from,
                     which is what makes unsubscribes and bounces trackable for
                     them, and stops short of claiming they opted in. A campaign
                     send only goes to status 'subscribed', so nobody here
                     receives one until they ask.

                     The Resend audience add below is left exactly as it was, so
                     the nurture sequence and the Monday reconciliation count
                     keep working. That leaves an inconsistency worth closing:
                     a Resend broadcast would still reach these addresses even
                     though this list says they never opted in. Closing it means
                     putting a tick box on the forms, which changes the forms
                     themselves, so it is Ernest's call rather than mine.
                */
                await recordSubscriber({
                    email,
                    name,
                    source: magnetRequested ? 'lead-magnet' : 'contact-form',
                    sourceDetail: magnetRequested || source || null,
                    /*
                      Ticked is the only thing that makes someone a subscriber.
                      Everyone else is recorded as pending with no consent date,
                      so the address is known (which is what makes bounces and
                      unsubscribes trackable for them) without anybody claiming
                      they asked for a newsletter.
                    */
                    /*
                      Pending either way, and for two different reasons. Without
                      the tick box there is no consent to record. With it there
                      is consent but no proof the address belongs to the person
                      who typed it, which is what the confirmation click gives.
                    */
                    status: 'pending',
                    consented: optedIn,
                }).then(async (sub) => {
                    if (optedIn && sub?.status === 'pending' && sub.unsubscribeToken) {
                        await sendConfirmation(email, sub.unsubscribeToken, {
                            claimed: magnetRequested || null,
                        });
                    }
                });

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

                /*
                  5. Start the Day 1/3/7 nurture, unless this person has said no.

                     The sequence is a Resend automation and it fired at every
                     enquirer unconditionally, including anyone who had already
                     unsubscribed, hard bounced or marked a previous message as
                     spam. Sending three more to someone who pressed the spam
                     button is how a domain's reputation goes.

                     mayEmail fails closed: if the list cannot be read, the
                     assumption is that they might have opted out, so the
                     sequence does not start. The enquiry itself is already
                     saved and Ernest is already notified by this point, so the
                     cost of being wrong is a follow-up he sends by hand.
                */
                if (await mayEmail(email)) {
                    const { error: nurtureEventError } = await resend.events.send({
                        event: LEAD_NURTURE_EVENT,
                        email,
                        payload: { source: source || 'other', name },
                    });
                    if (nurtureEventError) {
                        await alertPipelineFailure('nurture-event', nurtureEventError, body);
                    }
                } else {
                    console.warn(`[submit-form] nurture skipped for ${email}: opted out, bounced or unreadable list`);
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
                ? new Response(null, { status: 303, headers: { Location: `${backTo}?error=1` } })
                : json(
                      {
                          error:
                              "We could not record your message. Please reach us on WhatsApp so nothing is lost.",
                      },
                      502,
                  );
        }

        if (isFormPost) {
            return new Response(null, { status: 303, headers: { Location: `${backTo}?sent=1` } });
        }

        return json(
            { success: true, message: 'Your message has been sent successfully!', leadId: createdLeadId },
            200,
        );

    } catch (error: any) {
        await alertPipelineFailure('unhandled', error, submission);
        return isFormPost
            ? new Response(null, { status: 303, headers: { Location: `${backTo}?error=1` } })
            : json({ error: error.message || 'Internal Server Error' }, 500);
    }
};
