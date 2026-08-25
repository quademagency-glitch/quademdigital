import { escapeHtml } from './html';
import { unsubscribeUrl } from './subscribers';
import { payloadFetchGlobal } from './payload';

/**
 * One layout for every email this site sends.
 *
 * There were nineteen senders, each with its own HTML written inline as a
 * template literal. They disagreed about width, colour, whether the heading sat
 * on a dark band, whether values were escaped, and whether there was a footer
 * at all. None of them carried an unsubscribe link, and none named the sender
 * beyond a signature.
 *
 * Three things are true of every message that leaves here now:
 *
 *  - it says who sent it and how to reach a person,
 *  - a marketing message carries a working unsubscribe link,
 *  - anything interpolated from a form has been escaped, because the helpers
 *    below take text and produce HTML rather than the other way round.
 */

const NAVY = '#050814';
const ACCENT = '#00AEEF';
const INK = '#333333';
const MUTED = '#666666';
const FAINT = '#888888';
const HAIRLINE = '#eeeeee';

/** The address a reply reaches a person at. */
const CONTACT_EMAIL = 'info@quademdigital.com';

/**
 * The postal address, which commercial email is legally required to carry in
 * the US, and expected to carry in the UK and EU.
 *
 * Read from Site Settings, which is the one canonical copy: the requirement is
 * that the same line appears verbatim on the site and in every message, and a
 * second copy in here is how the two drift apart. Never guessed. If the field
 * is empty or the CMS is unreachable, the line is simply absent, because a
 * made-up address at the bottom of a thousand emails is worse than a missing
 * one. MAIL_POSTAL_ADDRESS overrides, for a send that runs without the CMS.
 */
const postalAddress = async (): Promise<string | null> => {
  const override = import.meta.env.MAIL_POSTAL_ADDRESS?.trim();
  if (override) return override;
  try {
    const settings = await payloadFetchGlobal('siteSettings');
    const v = typeof settings?.address === 'string' ? settings.address.trim() : '';
    return v || null;
  } catch {
    return null;
  }
};

export interface EmailOptions {
  /** Sits in the dark band at the top, and in the browser title. */
  heading: string;
  /**
   * The grey line most inboxes show next to the subject. Without one they
   * show the first words of the body, which is usually "Hi there,".
   */
  preheader?: string;
  /** Trusted HTML for the body. Build it with `p()` and `list()`, not by hand. */
  bodyHtml: string;
  cta?: { label: string; url: string };
  /**
   * Marketing only. Pass the subscriber's token and the footer grows an
   * unsubscribe link. Leave it out for a transactional message: an invoice or
   * a password reset is not something anyone can opt out of, and offering to
   * unsubscribe from it is confusing rather than compliant.
   */
  unsubscribeToken?: string | null;
  /** Ernest's sign-off. On by default, because these are from a person. */
  signOff?: boolean;
}

/** An escaped paragraph. Use this for anything a visitor typed. */
export const p = (text: string): string =>
  `<p style="font-size:16px;line-height:1.65;color:${INK};margin:0 0 16px;">${escapeHtml(text)}</p>`;

/** A paragraph of already-built HTML, for when it needs a link or bold inside. */
export const html = (trusted: string): string =>
  `<p style="font-size:16px;line-height:1.65;color:${INK};margin:0 0 16px;">${trusted}</p>`;

/** A label and value pair, the shape most notification emails want. */
export const field = (label: string, value: string): string =>
  `<p style="font-size:15px;line-height:1.6;color:${INK};margin:0 0 8px;">
     <strong style="color:${NAVY};">${escapeHtml(label)}:</strong> ${escapeHtml(value)}
   </p>`;

/** An escaped bullet list. */
export const list = (items: string[]): string =>
  `<ul style="font-size:16px;line-height:1.7;color:${INK};margin:0 0 16px;padding-left:20px;">
     ${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}
   </ul>`;

/** A safe absolute link. Anything not http(s) is dropped rather than rendered. */
export const link = (label: string, url: string): string => {
  const safe = /^https?:\/\//i.test(url) ? url : '#';
  return `<a href="${escapeHtml(safe)}" style="color:${ACCENT};">${escapeHtml(label)}</a>`;
};

const button = (label: string, url: string): string => {
  const safe = /^https?:\/\//i.test(url) ? url : null;
  if (!safe) return '';
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td style="border-radius:999px;background:${ACCENT};">
        <a href="${escapeHtml(safe)}"
           style="display:inline-block;padding:13px 28px;font-size:16px;font-weight:bold;color:${NAVY};text-decoration:none;border-radius:999px;">
          ${escapeHtml(label)}
        </a>
      </td></tr>
    </table>`;
};

const signature = `
  <p style="font-size:16px;color:${INK};margin:28px 0 0;">Best regards,</p>
  <p style="font-size:16px;font-weight:bold;color:${ACCENT};margin:4px 0 0;">Ernest Avorwlanu</p>
  <p style="font-size:14px;color:${MUTED};margin:2px 0 0;">Founder, Quadem Digital Enterprise</p>`;

const footer = async (unsubscribeToken?: string | null): Promise<string> => {
  const address = await postalAddress();
  const lines: string[] = [];

  if (unsubscribeToken) {
    lines.push(
      `You are getting this because you asked to hear from Quadem Digital.
       <a href="${escapeHtml(unsubscribeUrl(unsubscribeToken))}" style="color:${FAINT};">Unsubscribe, or choose what you hear about</a>.`,
    );
  }
  lines.push(
    `Quadem Digital Enterprise. Reply to this email, or write to <a href="mailto:${CONTACT_EMAIL}" style="color:${FAINT};">${CONTACT_EMAIL}</a>.`,
  );
  if (address) lines.push(escapeHtml(address));

  return `
    <div style="padding:20px 30px 0;border-top:1px solid ${HAIRLINE};margin-top:28px;">
      ${lines
        .map(
          (l) =>
            `<p style="font-size:12px;line-height:1.6;color:${FAINT};margin:0 0 6px;">${l}</p>`,
        )
        .join('')}
    </div>`;
};

/** The whole message, ready to hand to Resend. */
export async function renderEmail(o: EmailOptions): Promise<string> {
  const { heading, preheader, bodyHtml, cta, unsubscribeToken, signOff = true } = o;

  /*
    The preheader is hidden text that inboxes read as the preview line. The
    run of zero-width spaces after it stops the client pulling the first words
    of the body in behind it, which is the usual "Hi there, Hi there," effect.
  */
  const preview = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}${'&#8203;'.repeat(60)}</div>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:24px 12px;background:#f4f6fa;">
${preview}
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
  <div style="background:${NAVY};padding:28px 30px;text-align:center;">
    <h1 style="color:${ACCENT};margin:0;font-size:22px;line-height:1.3;">${escapeHtml(heading)}</h1>
  </div>
  <div style="padding:30px;">
    ${bodyHtml}
    ${cta ? button(cta.label, cta.url) : ''}
    ${signOff ? signature : ''}
    ${await footer(unsubscribeToken)}
  </div>
</div>
</body>
</html>`;
}
