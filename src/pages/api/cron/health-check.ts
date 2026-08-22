import type { APIRoute } from 'astro';
import { escapeHtml } from '../../../lib/html';

/**
 * Daily watchdog for failures that report success.
 *
 * alertPipelineFailure() already covers everything that throws. This covers what
 * does not: on 2026-06-05 hello@quademdigital.com bounced once, Resend added it
 * to the suppression list, and for 71 days every lead notification was accepted
 * with a 200 and then silently discarded. Nothing errored, so nothing alerted,
 * and a $10k+ enquiry sat unread for 19 days.
 *
 * The rule this encodes: an email that is *accepted* is not an email that is
 * *delivered*, and the gap between those two is invisible from the request that
 * sent it. Only a later look at the outcome can see it.
 *
 * Deliberately silent when healthy. A daily "all fine" email trains you to
 * ignore it, which is exactly what you must not do with this one.
 *
 * Known limitation, stated rather than hidden: this cannot detect its own
 * absence. If the cron stops running, nothing here will tell you. The Monday
 * reconciliation email is the backstop: if that stops arriving, assume the
 * schedule is broken.
 */

interface Problem {
  severity: 'critical' | 'warning';
  what: string;
  detail: string;
  fix: string;
}

export const GET: APIRoute = async ({ request }) => {
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const cronSecret = import.meta.env.CRON_SECRET?.trim();
  const auth = request.headers.get('authorization') || '';
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return json({ ok: false, error: 'Not authorised.' }, 401);
  }

  const resendKey = import.meta.env.RESEND_API_KEY?.trim();
  const payloadUrl = import.meta.env.PUBLIC_PAYLOAD_URL?.trim().replace(/\/+$/, '');
  const payloadToken = import.meta.env.PAYLOAD_API_KEY?.trim();
  const owner = import.meta.env.ERNEST_EMAIL?.trim() || 'ernest@quademdigital.com';

  if (!resendKey) return json({ ok: false, error: 'Not configured.' }, 503);

  const problems: Problem[] = [];
  const rk = { Authorization: `Bearer ${resendKey}` };

  // 1. Suppressed addresses: the exact failure that hid for 71 days.
  try {
    const res = await fetch('https://api.resend.com/suppressions', { headers: rk });
    if (res.ok) {
      const body = await res.json();
      for (const s of body.data ?? []) {
        // An address on this list receives nothing, and stays on it even after
        // the underlying mailbox is fixed.
        const ours = String(s.email || '').endsWith('@quademdigital.com');
        problems.push({
          severity: ours ? 'critical' : 'warning',
          what: `Email blocked: ${s.email}`,
          detail: `Blocked since ${String(s.created_at).slice(0, 10)} (reason: ${s.origin}). Every message sent to this address is being discarded, and the send still reports success.`,
          fix: ours
            ? 'This is one of your own addresses. Anything sent to it is being lost. Check the mailbox exists, then remove it from Resend → Suppressions.'
            : 'If this is a real client, confirm the correct address, update it in the CMS, then remove the entry from Resend → Suppressions.',
        });
      }
    } else {
      problems.push({
        severity: 'warning',
        what: 'Could not read the email block list',
        detail: `Resend returned ${res.status}.`,
        fix: 'Check the Resend API key is still valid.',
      });
    }
  } catch (err) {
    problems.push({
      severity: 'warning',
      what: 'Could not reach the email service',
      detail: String(err),
      fix: 'Check resend.com is up.',
    });
  }

  // 2. Anything that bounced or was complained about in the last 24 hours.
  try {
    const res = await fetch('https://api.resend.com/emails?limit=100', { headers: rk });
    if (res.ok) {
      const body = await res.json();
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const bad = (body.data ?? []).filter((e: any) => {
        const when = Date.parse(String(e.created_at).replace(' ', 'T'));
        return when >= cutoff && ['bounced', 'complained', 'suppressed'].includes(e.last_event);
      });
      for (const e of bad) {
        problems.push({
          severity: 'critical',
          what: `Email did not arrive: ${(e.to ?? []).join(', ')}`,
          detail: `"${e.subject}", outcome: ${e.last_event}.`,
          fix: 'The recipient never received this. Resend it to a verified address, or contact them another way.',
        });
      }
    }
  } catch {
    // Non-fatal: the suppression check above is the important one.
  }

  // 3. Is the CMS answering? If not, the portal and invoices are down.
  if (payloadUrl && payloadToken) {
    try {
      const res = await fetch(`${payloadUrl}/api/leads?limit=1`, {
        headers: { Authorization: `users API-Key ${payloadToken}` },
      });
      if (!res.ok) {
        problems.push({
          severity: 'critical',
          what: 'The CMS is not responding correctly',
          detail: `Asking for leads returned ${res.status}.`,
          fix: res.status === 403
            ? 'The API key has stopped working. Reissue it (runbook → Rotating the CMS key).'
            : 'Check the Railway service is running.',
        });
      }
    } catch (err) {
      problems.push({
        severity: 'critical',
        what: 'The CMS is unreachable',
        detail: String(err),
        fix: 'Check Railway. While it is down the client portal and invoice pages will not load.',
      });
    }
  }

  if (problems.length === 0) {
    return json({ ok: true, problems: 0, checkedAt: new Date().toISOString() }, 200);
  }

  const critical = problems.filter(p => p.severity === 'critical').length;
  const row = (p: Problem) => `
    <div style="border-left:4px solid ${p.severity === 'critical' ? '#c0392b' : '#e67e22'};background:#faf9f7;padding:14px 18px;margin:0 0 14px;border-radius:0 6px 6px 0;">
      <div style="font-weight:bold;color:#1a1a1a;margin-bottom:6px;">${escapeHtml(p.what)}</div>
      <div style="color:#444;font-size:14px;line-height:1.6;margin-bottom:8px;">${escapeHtml(p.detail)}</div>
      <div style="color:#0D1B6E;font-size:14px;line-height:1.6;"><strong>What to do:</strong> ${escapeHtml(p.fix)}</div>
    </div>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { ...rk, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Quadem Alerts <ernest@quademdigital.com>',
      to: [owner],
      subject: `${critical > 0 ? '🔴' : '⚠️'} ${problems.length} thing${problems.length === 1 ? '' : 's'} need${problems.length === 1 ? 's' : ''} attention`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
          <h2 style="color:#1a1a1a;margin-bottom:4px;">Daily check found ${problems.length} problem${problems.length === 1 ? '' : 's'}</h2>
          <p style="color:#666;font-size:14px;margin-top:0;">
            These are failures that do not show up as errors, the kind that report
            success and then quietly do nothing.
          </p>
          ${problems.map(row).join('')}
          <p style="color:#888;font-size:13px;">
            You only get this email when something is wrong. Silence means everything passed.
          </p>
        </div>`,
    }),
  });

  return json({ ok: true, problems: problems.length, critical }, 200);
};
