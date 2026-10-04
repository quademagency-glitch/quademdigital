import { button, escape, firstName, layout } from '../teamEmails'
import { longDate } from './stamp'

/**
 * Every email the signing flow sends, in the same layout as the team emails.
 *
 * The person asked to sign is often a client opening this on a phone, from an
 * address they have never seen before, so the first line says who is asking
 * and what the document is, and nothing asks them to sign in or create an
 * account.
 */

const p = (html: string) => `<p style="margin:0 0 12px">${html}</p>`
const small = (html: string) => `<p style="margin:16px 0 0;color:#5b6474;font-size:14px">${html}</p>`
const hello = (name?: string | null) => (firstName(name) ? `Hello ${escape(firstName(name))},` : 'Hello,')
const quote = (text: string) =>
  `<p style="margin:16px 0;padding:12px 14px;background:#f6f4ef;border-radius:10px;white-space:pre-line">${escape(text)}</p>`

export const requestEmail = (a: {
  name: string; from: string; title: string; message?: string | null; url: string; expiresAt: Date; needsCode: boolean; reminder?: boolean
}) => ({
  subject: `${a.reminder ? 'Reminder: ' : ''}${a.from} has sent you "${a.title}" to sign`,
  html: layout(
    p(hello(a.name)) +
      p(`${escape(a.from)} has sent you <strong>${escape(a.title)}</strong> to read and sign.`) +
      (a.message ? quote(a.message) : '') +
      p(`It takes a couple of minutes on your phone or computer. You do not need an account.`) +
      button(a.url, 'Review and sign') +
      small(
        `The link works until ${escape(longDate(a.expiresAt))}.` +
          (a.needsCode ? ' When you open it, a six-digit code is sent to this email address to confirm it is you.' : '') +
          ' It is for you alone, so please do not forward this email.',
      ),
  ),
  text: `${hello(a.name).replace(/&#39;/g, "'")}

${a.from} has sent you "${a.title}" to read and sign.
${a.message ? `\n${a.message}\n` : ''}
Review and sign: ${a.url}

The link works until ${longDate(a.expiresAt)}.${a.needsCode ? ' When you open it, a six-digit code is sent to this email address.' : ''}
It is for you alone, so please do not forward this email.

Quadem Digital`,
})

export const codeEmail = (a: { name: string; title: string; code: string }) => ({
  subject: `Your code to sign "${a.title}": ${a.code}`,
  html: layout(
    p(hello(a.name)) +
      p(`Your code to open <strong>${escape(a.title)}</strong> is:`) +
      `<p style="margin:16px 0;font-size:30px;font-weight:700;letter-spacing:6px">${escape(a.code)}</p>` +
      small('It works for 10 minutes. If you did not just open a signing link, you can ignore this email.'),
  ),
  text: `Your code to open "${a.title}" is ${a.code}. It works for 10 minutes.`,
})

export const signedNoticeEmail = (a: { to: string | null; who: string; title: string; waitingFor: string[]; url: string }) => ({
  subject: `${a.who} signed "${a.title}"`,
  html: layout(
    p(hello(a.to)) +
      p(`<strong>${escape(a.who)}</strong> has signed <strong>${escape(a.title)}</strong>.`) +
      p(a.waitingFor.length ? `Still to sign: ${a.waitingFor.map(escape).join(', ')}.` : 'Everyone has signed.') +
      button(a.url, 'Open the request'),
  ),
  text: `${a.who} has signed "${a.title}". ${a.waitingFor.length ? `Still to sign: ${a.waitingFor.join(', ')}.` : 'Everyone has signed.'}\n${a.url}`,
})

export const completedEmail = (a: { name: string; title: string; reference: string; names: string[]; hash: string }) => ({
  subject: `Signed by everyone: "${a.title}"`,
  html: layout(
    p(hello(a.name)) +
      p(`<strong>${escape(a.title)}</strong> has been signed by ${a.names.map(escape).join(' and ')}.`) +
      p('The signed copy is attached. Keep it with your records. The last page is the signing certificate, showing who signed and when.') +
      small(`Reference ${escape(a.reference)}. Fingerprint of the signed copy (SHA-256): <span style="word-break:break-all">${escape(a.hash)}</span>`),
  ),
  text: `"${a.title}" has been signed by ${a.names.join(' and ')}. The signed copy is attached; its last page is the signing certificate.\n\nReference ${a.reference}. Fingerprint of the signed copy (SHA-256): ${a.hash}\n\nQuadem Digital`,
})

export const declinedEmail = (a: { name: string | null; who: string; title: string; reason?: string | null }) => ({
  subject: `${a.who} declined to sign "${a.title}"`,
  html: layout(
    p(hello(a.name)) +
      p(`<strong>${escape(a.who)}</strong> declined to sign <strong>${escape(a.title)}</strong>, so it will not be completed.`) +
      (a.reason ? quote(a.reason) : '') +
      small('The signing links no longer work. A corrected version can be sent as a new request.'),
  ),
  text: `${a.who} declined to sign "${a.title}".${a.reason ? `\n\n${a.reason}` : ''}\n\nThe signing links no longer work.`,
})

export const cancelledEmail = (a: { name: string; from: string; title: string }) => ({
  subject: `"${a.title}" no longer needs your signature`,
  html: layout(
    p(hello(a.name)) +
      p(`${escape(a.from)} has withdrawn <strong>${escape(a.title)}</strong>, so it no longer needs your signature. The link you were sent has stopped working.`),
  ),
  text: `${a.from} has withdrawn "${a.title}", so it no longer needs your signature. The link you were sent has stopped working.`,
})
