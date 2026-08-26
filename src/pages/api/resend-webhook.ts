import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { NEWSLETTER_AUDIENCE_ID } from '../../lib/subscribers';

/**
 * Resend webhook: told about a delivery failure, instead of finding out later.
 *
 * Bounces were detected by a cron that polls the last hundred emails once a
 * day. That is how hello@quademdigital.com stayed broken from 2026-06-05: it
 * hard bounced, Resend suppressed it, every lead notification after that was
 * accepted by the API and silently discarded, and a $10k enquiry sat unread for
 * 19 days. A poll can only ever tell you late, and only about the last hundred.
 *
 * This is told within seconds, about every message. A hard bounce or a spam
 * complaint stops all further sending to that address, in Payload and in the
 * Resend audience, without anyone having to notice.
 *
 * Signed with Svix, which is what Resend uses. Verified by hand rather than by
 * adding the svix package: the Dockerfile installs with a frozen lockfile and a
 * new dependency there is a deploy failure waiting to happen. The scheme is
 * small and fully specified, so this is 20 lines rather than a supply chain.
 */

const CMS = (import.meta.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000').replace(/\/$/, '');

/** Five minutes, the Svix default. Anything older is a replay. */
const TOLERANCE_SECONDS = 5 * 60;

/**
 * Svix signs `${id}.${timestamp}.${body}` with the base64 part of the secret,
 * and sends a space separated list of `v1,<base64>` because a secret can be
 * mid-rotation. Any one of them matching is a pass.
 */
const signatureIsValid = (
    secret: string,
    id: string,
    timestamp: string,
    body: string,
    header: string,
): boolean => {
    const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const expected = crypto
        .createHmac('sha256', key)
        .update(`${id}.${timestamp}.${body}`)
        .digest('base64');

    const expBuf = Buffer.from(expected, 'utf8');
    return header
        .split(' ')
        .map((part) => part.split(',')[1] || '')
        .filter(Boolean)
        .some((candidate) => {
            const candBuf = Buffer.from(candidate, 'utf8');
            return candBuf.length === expBuf.length && crypto.timingSafeEqual(candBuf, expBuf);
        });
};

/**
 * The five events worth keeping against a campaign, and what Resend calls them.
 *
 * `email.sent` is deliberately absent: the campaign already records how many
 * messages left, and counting "sent" twice from two sources invites the two to
 * disagree. `email.delivery_delayed` is absent because a delay is not an
 * outcome, it is a message still on its way.
 */
const CAMPAIGN_EVENTS: Record<string, string> = {
    'email.delivered': 'delivered',
    'email.opened': 'opened',
    'email.clicked': 'clicked',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
};

/**
 * What each event means for whether this address can be written to again.
 *
 * A transient bounce is a full mailbox or a server having a bad afternoon, and
 * killing the address for it would lose real subscribers, so it is recorded and
 * nothing else. Only a permanent failure and a spam complaint are final.
 */
const FINAL: Record<string, 'bounced' | 'complained'> = {
    'email.bounced': 'bounced',
    'email.complained': 'complained',
};

const stopSendingAtResend = async (email: string) => {
    const key = import.meta.env.RESEND_API_KEY?.trim();
    if (!key) return;
    try {
        await fetch(
            `https://api.resend.com/audiences/${NEWSLETTER_AUDIENCE_ID}/contacts/${encodeURIComponent(email)}`,
            {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ unsubscribed: true }),
            },
        );
    } catch (err) {
        // Payload is the record and the send path reads it, so this is a mirror
        // falling behind rather than a message getting through.
        console.error('[resend-webhook] could not update the Resend audience', err);
    }
};

export const POST: APIRoute = async ({ request }) => {
    const secret = import.meta.env.RESEND_WEBHOOK_SECRET?.trim();
    if (!secret) {
        console.error('[resend-webhook] RESEND_WEBHOOK_SECRET missing, refusing everything');
        return new Response('not configured', { status: 503 });
    }

    // The signature is over the raw body. Parsing and re-stringifying reorders
    // keys and the HMAC never matches again.
    const raw = await request.text();
    const id = request.headers.get('svix-id') || '';
    const timestamp = request.headers.get('svix-timestamp') || '';
    const header = request.headers.get('svix-signature') || '';

    if (!id || !timestamp || !header) {
        return new Response('missing signature headers', { status: 400 });
    }

    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
        return new Response('timestamp outside tolerance', { status: 400 });
    }

    if (!signatureIsValid(secret, id, timestamp, raw, header)) {
        console.error('[resend-webhook] bad signature');
        return new Response('invalid signature', { status: 401 });
    }

    let event: any;
    try {
        event = JSON.parse(raw);
    } catch {
        return new Response('bad payload', { status: 400 });
    }

    const type: string = event?.type || '';
    const data = event?.data || {};
    const recipients: string[] = Array.isArray(data.to) ? data.to : data.to ? [data.to] : [];
    const at = event?.created_at ? new Date(event.created_at).toISOString() : new Date().toISOString();

    /*
      Resend describes a bounce in data.bounce. The wording has changed before,
      so treat anything not explicitly transient as permanent: wrongly keeping a
      dead address costs a bounce rate, wrongly dropping a live one costs a
      subscriber, and of the two the first is the one worth risking.
    */
    const bounceKind = String(data?.bounce?.type || data?.bounce?.subType || '').toLowerCase();
    const isTransient = bounceKind.includes('transient') || bounceKind.includes('soft');
    const finalState = type === 'email.bounced' && isTransient ? null : FINAL[type] || null;

    /*
      Two different secrets, and confusing them costs nothing visible.

      `secret` above is Resend's webhook signing key. The CMS endpoint wants
      CMS_WEBHOOK_SECRET, the one the two apps share. Sending the wrong one made
      the CMS answer 401, this route log and carry on, and Resend see a cheerful
      200, so events were verified, accepted and then dropped on the floor.
    */
    const shared = import.meta.env.CMS_WEBHOOK_SECRET?.trim();
    if (!shared) {
        console.error('[resend-webhook] CMS_WEBHOOK_SECRET missing, cannot record anything');
        return new Response('cannot record', { status: 500 });
    }
    const secretHeader = { 'Content-Type': 'application/json', 'x-quadem-secret': shared };

    /*
      Recorded through a CMS endpoint rather than by PATCHing the collection.

      A PATCH here read the row, merged its change and wrote the row back.
      Resend sends several events for one message at the same instant, so two of
      those raced: on 2026-08-25 a subscriber who had just confirmed and just
      hard bounced was put back to pending with no confirmation date, 37
      milliseconds later, by an `email.sent` event carrying a copy of the row
      from before either. Nothing errored, and only the version history showed
      it.

      The endpoint writes the named columns and nothing else, so a delivery
      event can no longer revert a decision it was never told about.
    */
    for (const address of recipients) {
        const email = String(address).trim().toLowerCase();
        if (!email) continue;

        try {
            const res = await fetch(`${CMS}/api/subscribers/delivery-event`, {
                method: 'POST',
                headers: secretHeader,
                body: JSON.stringify({
                    email,
                    event: type.replace(/^email\./, ''),
                    at,
                    detail: data?.bounce?.message || data?.bounce?.subType || null,
                    final: finalState,
                }),
            });

            if (!res.ok) {
                /*
                  Fail loudly. A 500 makes Resend retry, which is what should
                  happen when an event is real and could not be stored. Swallowing
                  it and answering 200 is how the first version of this lost
                  every event to a wrong header without anything looking wrong.
                */
                console.error('[resend-webhook] could not record', type, email, res.status);
                return new Response('could not record', { status: 500 });
            }

            const out = await res.json().catch(() => ({}));

            if (!out.known && finalState) {
                // A client invoice going astray is worth knowing about even
                // though there is no row to write it to.
                console.error(
                    `[resend-webhook] ${type} for ${email}, who is not on the list. Check this address by hand.`,
                );
            }

            if (finalState && out.known) {
                await stopSendingAtResend(email);
                console.error(`[resend-webhook] ${email} marked ${finalState}, no further sending`);
            }

            /*
              And, if this message came from a campaign, onto the campaign.

              Resend hands the tags back as an object, so `campaign_id` is the
              tag the send put on every message. No tag means a transactional
              email, an invoice or a nurture step, and none of those belong in a
              campaign's numbers.

              A transient bounce is not counted as a failure to deliver: the
              message may still arrive, and marking the campaign down for a full
              mailbox would misreport it. Same rule as `finalState` above, which
              is why it is reused rather than re-derived.
            */
            const campaignId = String((data?.tags as any)?.campaign_id || '').trim();
            const campaignEvent = CAMPAIGN_EVENTS[type];
            const countable = campaignEvent !== 'bounced' || finalState === 'bounced';

            if (campaignId && campaignEvent && countable) {
                try {
                    const rec = await fetch(`${CMS}/api/emailCampaigns/record-event`, {
                        method: 'POST',
                        headers: secretHeader,
                        body: JSON.stringify({
                            campaignId,
                            email,
                            event: campaignEvent,
                            at,
                            link: data?.click?.link || null,
                            /*
                              One webhook delivery is one svix id, and the id
                              repeats when Resend retries. The address is folded
                              in because an event addressed to several people
                              would otherwise collide with itself and only the
                              first would be counted.
                            */
                            eventId: `${id}:${email}`,
                        }),
                    });
                    if (!rec.ok) {
                        // Worth a retry: the subscriber half is idempotent and
                        // the campaign half is protected by the unique event id,
                        // so replaying the whole event costs nothing.
                        console.error('[resend-webhook] could not record on the campaign', type, email, rec.status);
                        return new Response('could not record', { status: 500 });
                    }
                } catch (err) {
                    console.error('[resend-webhook] campaign record failed', type, email, err);
                }
            }
        } catch (err) {
            console.error('[resend-webhook] failed handling', type, email, err);
        }
    }

    // Always acknowledge a verified event. Anything else and Resend retries it
    // for hours over a row we were never going to have.
    return new Response('ok', { status: 200 });
};
