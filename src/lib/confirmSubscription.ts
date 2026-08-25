import { Resend } from 'resend';
import { mailFrom } from './mailFrom';
import { renderEmail, p as para, html as htmlPara, link } from './emailTemplate';

/**
 * Double opt-in: proving the address belongs to the person who typed it.
 *
 * Anyone could put any address into the footer form and it went straight onto
 * the list, confirmed as far as the system was concerned. That is how a list
 * fills up with typos, with addresses signed up by somebody else, and with spam
 * traps, and a single spam trap is enough to get a sending domain blocked. It
 * also meant the consent date recorded against an address was no evidence at
 * all, because nobody had shown they could read that inbox.
 *
 * Nobody is `subscribed` now until they click the link in a message sent to the
 * address itself. Until then they sit as `pending` and receive nothing else.
 *
 * The confirmation link carries the same token as the unsubscribe link. One
 * secret per person rather than two: both are capabilities held by the same
 * person, and the failure mode of a leaked confirm link is that somebody joins
 * a list they were already asking to join.
 */

const site = (): string =>
  (import.meta.env.SITE_URL || 'https://quademdigital.com').replace(/\/$/, '');

export const confirmUrl = (token: string): string =>
  `${site()}/confirm/?t=${encodeURIComponent(token)}`;

/**
 * Sends the "yes, it is me" message.
 *
 * Never throws. Returns whether it went, so the caller can tell the visitor
 * to check their inbox only when there is something to check.
 */
export async function sendConfirmation(
  email: string,
  token: string,
  context?: { claimed?: string | null },
): Promise<boolean> {
  const key = import.meta.env.RESEND_API_KEY?.trim();
  if (!key || !token) return false;

  const because = context?.claimed
    ? `You ticked the box while claiming ${context.claimed}.`
    : 'You put this address into the subscribe form on quademdigital.com.';

  try {
    const { error } = await new Resend(key).emails.send({
      from: mailFrom('Ernest at Quadem Digital'),
      to: [email],
      subject: 'One click to confirm',
      /*
        No unsubscribe link on this one, on purpose. They are not on the list
        yet, so there is nothing to leave. Ignoring this email is the way out,
        and the last line says so.
      */
      html: await renderEmail({
        heading: 'One click to confirm',
        preheader: 'Confirm and you are on the list. Ignore this and nothing happens.',
        bodyHtml: [
          para('Hi there,'),
          para(`${because} Click below and you are on the list.`),
          para(
            'About once a week I send one email on what is genuinely working right now ' +
              'in search, web design and short video for businesses here in Ghana.',
          ),
          htmlPara(
            `If this was not you, ignore this email. Nothing happens without that click, ` +
              `and I will not write again. Questions go to ${link('info@quademdigital.com', 'mailto:info@quademdigital.com')}.`,
          ),
        ].join(''),
        cta: { label: 'Yes, subscribe me', url: confirmUrl(token) },
      }),
    });
    if (error) {
      console.error('[confirm] Resend refused the confirmation email', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[confirm] could not send the confirmation email', err);
    return false;
  }
}
