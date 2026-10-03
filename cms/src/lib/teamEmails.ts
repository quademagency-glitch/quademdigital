/**
 * The emails a team member gets from the CMS: the welcome with a link to set a
 * password, and the password reset.
 *
 * Both links go to the team portal, never to /admin. A team member who lands on
 * the CMS is refused there, so Payload's stock reset email, which points at
 * /admin/reset, would have sent them to a screen that says "not allowed" right
 * after setting a password.
 */

export const TEAM_PORTAL_URL = (process.env.TEAM_PORTAL_URL || 'https://team.quademdigital.com').replace(/\/$/, '')

/** How long a welcome link works. A reset link keeps Payload's one hour. */
export const WELCOME_LINK_DAYS = 7

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

const firstName = (name?: string | null) => (name || '').trim().split(/\s+/)[0] || ''

const layout = (body: string) => `<!doctype html>
<html lang="en-GB"><body style="margin:0;padding:24px 16px;background:#f2efe8;font-family:Urbanist,Segoe UI,Helvetica,Arial,sans-serif;color:#0b1220">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px 24px;line-height:1.55;font-size:16px">
${body}
<p style="margin:28px 0 0;color:#5b6474;font-size:14px">Quadem Digital</p>
</div></body></html>`

const button = (url: string, label: string) =>
  `<p style="margin:24px 0"><a href="${escape(url)}" style="display:inline-block;background:#00aeef;color:#04121c;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">${escape(label)}</a></p>
<p style="margin:0;color:#5b6474;font-size:14px">Or paste this into your browser:<br><span style="word-break:break-all">${escape(url)}</span></p>`

export const welcomeEmail = ({ name, email, token }: { name?: string | null; email: string; token: string }) => {
  const url = `${TEAM_PORTAL_URL}/welcome/${encodeURIComponent(token)}`
  const hello = firstName(name) ? `Hello ${escape(firstName(name))},` : 'Hello,'
  return {
    url,
    subject: 'Welcome to Quadem: set your password',
    html: layout(`<p style="margin:0 0 12px">${hello}</p>
<p style="margin:0 0 12px">Welcome to Quadem. Your team portal is ready: your leads, your daily report and your money, in one place.</p>
<p style="margin:0">Set your password to open it. The link works for ${WELCOME_LINK_DAYS} days.</p>
${button(url, 'Set your password')}
<p style="margin:24px 0 0">You sign in with <strong>${escape(email)}</strong> at ${escape(TEAM_PORTAL_URL.replace(/^https?:\/\//, ''))}. On your phone, open it in the browser and add it to your home screen.</p>`),
    text: `${firstName(name) ? `Hello ${firstName(name)},` : 'Hello,'}

Welcome to Quadem. Your team portal is ready: your leads, your daily report and your money, in one place.

Set your password to open it (the link works for ${WELCOME_LINK_DAYS} days):
${url}

You sign in with ${email} at ${TEAM_PORTAL_URL.replace(/^https?:\/\//, '')}.

Quadem Digital`,
  }
}

export const resetEmail = ({ token, team, serverURL }: { token: string; team: boolean; serverURL: string }) => {
  const url = team
    ? `${TEAM_PORTAL_URL}/reset/${encodeURIComponent(token)}`
    : `${(serverURL || 'https://cms.quademdigital.com').replace(/\/$/, '')}/admin/reset/${encodeURIComponent(token)}`
  return {
    subject: 'Reset your Quadem password',
    html: layout(`<p style="margin:0 0 12px">Someone asked to reset the password for this account. If it was you, choose a new one here. The link works for one hour.</p>
${button(url, 'Choose a new password')}
<p style="margin:24px 0 0">If it was not you, ignore this email and your password stays as it is.</p>`),
  }
}

/** "Ernest handed you 3 leads", with their names, sent once per handover. */
export const handoverEmail = ({ name, from, leads }: { name?: string | null; from: string; leads: string[] }) => {
  const url = `${TEAM_PORTAL_URL}/leads`
  const n = leads.length
  const what = n === 1 ? 'a lead' : `${n} leads`
  const list = leads
    .slice(0, 12)
    .map((l) => `<li style="margin:0 0 4px">${escape(l)}</li>`)
    .join('')
  return {
    subject: `${from} handed you ${what}`,
    html: layout(`<p style="margin:0 0 12px">${firstName(name) ? `Hello ${escape(firstName(name))},` : 'Hello,'}</p>
<p style="margin:0 0 12px">${escape(from)} handed you ${what}. They are in your leads now, and they count toward your monthly target.</p>
<ul style="margin:0 0 4px;padding-left:20px">${list}</ul>${n > 12 ? `<p style="margin:4px 0 0;color:#5b6474">and ${n - 12} more</p>` : ''}
${button(url, 'Open your leads')}`),
  }
}
