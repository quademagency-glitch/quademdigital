import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { mailFrom } from '../../../lib/mailFrom';
import { renderEmail, block } from '../../../lib/emailTemplate';
import { lexicalToHtml } from '../../../lib/payload';

/**
 * Sending a campaign, from the list Payload owns.
 *
 * This replaces /api/send-campaign.ts and /admin/campaigns.astro, which were a
 * hand-rolled admin page with a password compiled into the client-side
 * JavaScript. That page created a Resend broadcast to the whole audience, read
 * nothing from the EmailCampaigns collection and wrote nothing back, so a
 * campaign left no record of who received it or when, and the AI drafts sat in
 * a collection nothing could send from.
 *
 * It runs here rather than in the CMS because everything a campaign needs is
 * already here: the shared layout, the unsubscribe links, the subscriber
 * helpers and Resend. Putting it in the CMS would have meant a second copy of
 * the email template, which is the thing this work exists to remove. The CMS
 * has the button and keeps the record; this does the rendering and the sending.
 *
 * Authenticated with the secret the two apps already share, the same one behind
 * the client-won webhook and the preview links. No new password, and nothing
 * that ships to a browser.
 */

const CMS = (import.meta.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000').replace(/\/$/, '');

/** Resend accepts up to 100 messages in one batch call. */
const BATCH = 100;

/** Its default rate limit is two requests a second, so batches are paced. */
const PAUSE_MS = 600;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface Subscriber {
  id: number | string;
  email: string;
  status: string;
  interests?: string[] | null;
  unsubscribeToken: string;
}

/**
 * Who a segment means.
 *
 * Somebody who has chosen no interests is interested in everything, which is
 * the only reading that does not silently exclude every person who signed up
 * before interests existed.
 */
const matchesSegment = (sub: Subscriber, segment: string): boolean => {
  if (segment === 'all') return true;
  const chosen = Array.isArray(sub.interests) ? sub.interests : [];
  if (!chosen.length) return true;
  return chosen.includes(segment) || chosen.includes('general');
};

export const POST: APIRoute = async ({ request }) => {
  const secret = import.meta.env.CMS_WEBHOOK_SECRET?.trim();
  const apiKey = import.meta.env.PAYLOAD_API_KEY?.trim();
  const resendKey = import.meta.env.RESEND_API_KEY?.trim();

  if (!secret || !apiKey || !resendKey) {
    console.error('[send-campaign] not configured');
    return json({ error: 'Not configured.' }, 503);
  }
  if (request.headers.get('x-quadem-secret') !== secret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let campaignId: string | number | undefined;
  try {
    ({ campaignId } = await request.json());
  } catch {
    return json({ error: 'Expected JSON.' }, 400);
  }
  if (!campaignId) return json({ error: 'campaignId is required.' }, 400);

  const headers = { 'Content-Type': 'application/json', Authorization: `users API-Key ${apiKey}` };
  const resend = new Resend(resendKey);

  // ---- the campaign -------------------------------------------------------

  const cRes = await fetch(`${CMS}/api/emailCampaigns/${campaignId}?depth=0`, { headers });
  if (!cRes.ok) return json({ error: `Campaign ${campaignId} could not be read.` }, 404);
  const campaign = await cRes.json();

  /*
    The guard against sending twice, and it is the whole reason sentAt is
    written before anything else could go wrong rather than after. A double
    click on the button in the admin is not a rare event.
  */
  if (campaign.sentAt) {
    return json({ error: `Already sent on ${campaign.sentAt}.`, sentAt: campaign.sentAt }, 409);
  }
  if (!campaign.subject) return json({ error: 'The campaign has no subject.' }, 400);

  const bodyHtml: string =
    campaign.body_html?.trim() ||
    (campaign.body ? lexicalToHtml(campaign.body?.root ?? campaign.body) : '');
  if (!bodyHtml.trim()) return json({ error: 'The campaign has no body.' }, 400);

  const segment: string = campaign.segment || 'all';

  // ---- who it goes to -----------------------------------------------------

  const owner = import.meta.env.ERNEST_EMAIL?.trim() || 'ernest@quademdigital.com';
  let recipients: Subscriber[] = [];

  if (segment === 'test') {
    /*
      A test sends to Ernest at his own address, through the same code path as
      a real send. The alternative, a "preview" that renders differently from
      the thing that goes out, is how a broken campaign reaches a thousand
      people looking fine in the admin.
    */
    const own = await fetch(
      `${CMS}/api/subscribers?where[email][equals]=${encodeURIComponent(owner)}&limit=1&depth=0`,
      { headers },
    );
    const doc = own.ok ? (await own.json())?.docs?.[0] : null;
    recipients = [
      {
        id: doc?.id ?? 'test',
        email: owner,
        status: 'subscribed',
        interests: null,
        unsubscribeToken: doc?.unsubscribeToken ?? '',
      },
    ];
  } else {
    // Page through, because a growing list must not silently stop at the first
    // page and report a smaller number as if it were the whole audience.
    let page = 1;
    for (;;) {
      const r = await fetch(
        `${CMS}/api/subscribers?where[status][equals]=subscribed&limit=200&page=${page}&depth=0`,
        { headers },
      );
      if (!r.ok) return json({ error: 'The subscriber list could not be read.' }, 502);
      const data = await r.json();
      recipients.push(...(data.docs || []));
      if (!data.hasNextPage) break;
      page += 1;
    }
    recipients = recipients.filter((s) => matchesSegment(s, segment));
  }

  if (!recipients.length) {
    return json({ error: 'Nobody matches that segment, so nothing was sent.' }, 400);
  }

  // ---- send ---------------------------------------------------------------

  const from = mailFrom('Ernest at Quadem Digital');
  const cta =
    campaign.ctaText && campaign.ctaUrl
      ? { label: String(campaign.ctaText), url: String(campaign.ctaUrl) }
      : undefined;

  let sent = 0;
  const problems: string[] = [];

  for (let i = 0; i < recipients.length; i += BATCH) {
    const chunk = recipients.slice(i, i + BATCH);

    /*
      Rendered per person, not once for everybody, because the unsubscribe link
      carries their own token. One shared link would let anyone who received the
      campaign remove anyone else who did.
    */
    const messages = await Promise.all(
      chunk.map(async (sub) => ({
        from,
        to: [sub.email],
        subject: String(campaign.subject),
        html: await renderEmail({
          heading: String(campaign.subject),
          preheader: campaign.previewText || undefined,
          /*
            block(), not html(). The campaign body is
            `<div class="payload-richtext"><p>...</p></div>`, and wrapping that
            in a `<p>` is invalid, so the paragraph closes early and every style
            on it is discarded.
          */
          bodyHtml: block(bodyHtml),
          cta,
          unsubscribeToken: sub.unsubscribeToken || null,
        }),
      })),
    );

    try {
      const { error } = await resend.batch.send(messages);
      if (error) {
        problems.push(`Batch starting at ${i + 1}: ${error.message || String(error)}`);
      } else {
        sent += chunk.length;
      }
    } catch (err: any) {
      problems.push(`Batch starting at ${i + 1}: ${err?.message || String(err)}`);
    }

    if (i + BATCH < recipients.length) await wait(PAUSE_MS);
  }

  // ---- write back ---------------------------------------------------------

  /*
    A test send is not the campaign going out, so it must not stamp sentAt and
    lock the real send out afterwards. It still records what happened.
  */
  const isTest = segment === 'test';
  const stamp = new Date().toISOString();
  const log = [
    `${stamp}: ${isTest ? 'test send' : 'sent'} to ${sent} of ${recipients.length} in segment "${segment}".`,
    ...problems,
  ].join('\n');

  const patch: Record<string, unknown> = {
    sendLog: [campaign.sendLog, log].filter(Boolean).join('\n'),
  };
  if (!isTest) {
    patch.sentAt = stamp;
    patch.recipientCount = sent;
    patch.status = 'sent';
  }

  const write = await fetch(`${CMS}/api/emailCampaigns/${campaignId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patch),
  });
  if (!write.ok) {
    // The email has gone. Say so loudly rather than reporting a failure that
    // would invite someone to press send again.
    console.error('[send-campaign] sent but could not record it', await write.text());
    return json(
      { ok: true, sent, of: recipients.length, warning: 'Sent, but the record could not be written.' },
      200,
    );
  }

  return json({ ok: true, test: isTest, sent, of: recipients.length, segment, problems }, 200);
};
