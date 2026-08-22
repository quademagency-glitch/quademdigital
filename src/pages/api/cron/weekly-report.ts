import type { APIRoute } from 'astro';
import { escapeHtml } from '../../../lib/html';

/**
 * Monday morning reconciliation.
 *
 * The audit's point: three numbers should agree every week, and when they drift
 * you are losing enquiries silently. The dead newsletter form and the homepage
 * form that bypassed the CRM both survived for months precisely because nobody
 * was comparing anything.
 *
 *   Leads saved      Payload: what actually reached you
 *   Contacts added   Resend: what started a nurture sequence
 *   Form submits     GA4: what visitors believe they did
 *
 * GA4 is deliberately NOT fetched: reading it needs a Google service account and
 * the Data API, neither of which is set up here, and inventing a number would be
 * worse than leaving a blank. The email states the figure to look up and where,
 * so the comparison still happens: by a human, once a week, in one minute.
 */

export const GET: APIRoute = async ({ request }) => {
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const cronSecret = import.meta.env.CRON_SECRET?.trim();
  const auth = request.headers.get('authorization') || '';
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return json({ ok: false, error: 'Not authorised.' }, 401);
  }

  const baseUrl = import.meta.env.PUBLIC_PAYLOAD_URL?.trim().replace(/\/+$/, '');
  const payloadToken = import.meta.env.PAYLOAD_API_KEY?.trim();
  const resendKey = import.meta.env.RESEND_API_KEY?.trim();
  const audienceId = import.meta.env.RESEND_AUDIENCE_ID?.trim();
  const owner = import.meta.env.ERNEST_EMAIL?.trim() || 'ernest@quademdigital.com';

  if (!baseUrl || !payloadToken || !resendKey) {
    console.error('[weekly-report] missing config');
    return json({ ok: false, error: 'Not configured.' }, 503);
  }

  const headers = { Authorization: `users API-Key ${payloadToken}`, 'Content-Type': 'application/json' };
  const since = new Date(Date.now() - 7 * 86_400_000);
  const sinceIso = since.toISOString();

  // Payload returns totalDocs, so ask for one row and read the count.
  const countOf = async (collection: string, extra: Record<string, string> = {}) => {
    try {
      const q = new URLSearchParams({ limit: '1', depth: '0', ...extra });
      const res = await fetch(`${baseUrl}/api/${collection}?${q}`, { headers });
      if (!res.ok) return null;
      return Number((await res.json())?.totalDocs ?? 0);
    } catch {
      return null;
    }
  };

  const leadsThisWeek = await countOf('leads', { 'where[createdAt][greater_than]': sinceIso });
  const leadsNewUnworked = await countOf('leads', { 'where[status][equals]': 'new' });
  const leadsStale = await countOf('leads', {
    'where[status][equals]': 'new',
    'where[createdAt][less_than]': new Date(Date.now() - 86_400_000).toISOString(),
  });
  const invoicesUnpaid = await countOf('invoices', { 'where[status][not_equals]': 'paid' });
  const invoicesOverdue = await countOf('invoices', { 'where[status][equals]': 'overdue' });

  // Resend audience size. Total, not weekly: Resend has no created-since
  // filter, so it is reported as a running total and compared week to week.
  let audienceTotal: number | null = null;
  if (audienceId) {
    try {
      const r = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
        headers: { Authorization: `Bearer ${resendKey}` },
      });
      if (r.ok) audienceTotal = ((await r.json())?.data ?? []).length;
    } catch { /* reported as unavailable below */ }
  }

  const n = (v: number | null) => (v === null ? '-' : String(v));
  const row = (label: string, value: string, note: string) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eef1f6;color:#1A1A1A;font-size:15px;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eef1f6;color:#0D1B6E;font-size:19px;font-weight:bold;text-align:right;">${escapeHtml(value)}</td>
      <td style="padding:10px 0 10px 14px;border-bottom:1px solid #eef1f6;color:#777;font-size:12px;">${escapeHtml(note)}</td>
    </tr>`;

  const warn =
    leadsStale && leadsStale > 0
      ? `<div style="background:#FFF4E5;border-left:4px solid #F59E0B;padding:14px 18px;margin:18px 0;color:#7c4a03;font-size:14px;">
           <strong>${leadsStale}</strong> lead${leadsStale === 1 ? '' : 's'} older than 24 hours still marked “new”.
           Your auto-reply promises a reply within 24 hours.
         </div>`
      : '';

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#0D1B6E;padding:22px;border-radius:8px 8px 0 0;color:#fff;">
    <div style="font-size:19px;font-weight:bold;">Weekly check: Quadem Digital</div>
    <div style="font-size:13px;opacity:.85;margin-top:4px;">
      ${escapeHtml(since.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))}
      – ${escapeHtml(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))}
    </div>
  </div>
  <div style="background:#fff;border:1px solid #dde3f0;border-top:none;padding:26px;border-radius:0 0 8px 8px;">
    <table style="width:100%;border-collapse:collapse;">
      ${row('Leads saved this week', n(leadsThisWeek), 'reached your CRM')}
      ${row('Newsletter contacts', n(audienceTotal), 'running total in Resend')}
      ${row('Leads awaiting a reply', n(leadsNewUnworked), 'status still “new”')}
      ${row('Unpaid invoices', n(invoicesUnpaid), 'including deposits outstanding')}
      ${row('Overdue invoices', n(invoicesOverdue), 'past due date, being chased')}
    </table>
    ${warn}
    <div style="background:#F4F7FB;padding:16px 20px;border-radius:8px;margin-top:20px;">
      <div style="color:#0D1B6E;font-weight:bold;font-size:14px;margin-bottom:6px;">The one-minute check</div>
      <p style="color:#333;font-size:13px;line-height:1.7;margin:0;">
        Open GA4 → Reports → Engagement → Events and read
        <strong>generate_lead</strong> / form submit events for the last 7 days.
        It should be close to “Leads saved” above. If GA4 is much higher,
        submissions are failing before they reach you. Tell Claude and it gets
        looked at the same day.
      </p>
    </div>
  </div>
</div>`;

  try {
    const mail = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Quadem Digital <ernest@quademdigital.com>',
        to: [owner],
        subject: `Weekly check: ${n(leadsThisWeek)} leads, ${n(invoicesOverdue)} overdue`,
        html,
      }),
    });
    if (!mail.ok) {
      console.error('[weekly-report] send failed:', await mail.text());
      return json({ ok: false, error: 'Report could not be sent.' }, 502);
    }
  } catch (e) {
    console.error('[weekly-report] send threw:', e);
    return json({ ok: false, error: 'Report could not be sent.' }, 502);
  }

  return json(
    { ok: true, leadsThisWeek, audienceTotal, leadsNewUnworked, leadsStale, invoicesUnpaid, invoicesOverdue },
    200,
  );
};
