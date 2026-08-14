import type { APIRoute } from 'astro';
import { escapeHtml } from '../../../lib/html';

/**
 * Chase unpaid invoices.
 *
 * The `overdue` status existed in the schema and nothing ever computed it, so
 * nothing chased anything: an invoice went out and then sat there. This runs
 * daily and sends at most one reminder per stage — day 3, 7 and 14 past the due
 * date — recording reminderCount so a re-run never emails the same client twice.
 *
 * It also finally sets the `overdue` status, so the admin list tells the truth.
 *
 * Deposits: an invoice with a deposit paid is still outstanding for the balance,
 * so it is still chased. The email quotes the balance, not the original total.
 */

const STAGES = [3, 7, 14];

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

export const GET: APIRoute = async ({ request }) => {
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  // Vercel Cron sends this header; the secret also lets it be triggered by hand
  // during testing without leaving the endpoint open to the internet.
  const cronSecret = import.meta.env.CRON_SECRET?.trim();
  const auth = request.headers.get('authorization') || '';
  const isVercelCron = auth === `Bearer ${cronSecret}`;
  if (!cronSecret || !isVercelCron) {
    return json({ ok: false, error: 'Not authorised.' }, 401);
  }

  const baseUrl = import.meta.env.PUBLIC_PAYLOAD_URL?.trim().replace(/\/+$/, '');
  const payloadToken = import.meta.env.PAYLOAD_API_KEY?.trim();
  const resendKey = import.meta.env.RESEND_API_KEY?.trim();
  const site = (import.meta.env.PUBLIC_SITE_URL?.trim() || 'https://quademdigital.com').replace(/\/+$/, '');
  const owner = import.meta.env.ERNEST_EMAIL?.trim() || 'ernest@quademdigital.com';

  if (!baseUrl || !payloadToken || !resendKey) {
    console.error('[chase-invoices] missing config');
    return json({ ok: false, error: 'Not configured.' }, 503);
  }

  const headers = { Authorization: `users API-Key ${payloadToken}`, 'Content-Type': 'application/json' };
  const now = new Date();

  let invoices: any[] = [];
  try {
    // Everything not yet settled with a due date in the past. Status is checked
    // rather than amountPaidMinor because an invoice can be marked paid by hand.
    const q = new URLSearchParams({
      'where[status][not_equals]': 'paid',
      'where[dueDate][less_than]': now.toISOString(),
      depth: '1',
      limit: '100',
    });
    const res = await fetch(`${baseUrl}/api/invoices?${q}`, { headers });
    if (!res.ok) {
      console.error('[chase-invoices] lookup failed:', await res.text());
      return json({ ok: false, error: 'Could not load invoices.' }, 502);
    }
    invoices = (await res.json())?.docs ?? [];
  } catch (e) {
    console.error('[chase-invoices] lookup threw:', e);
    return json({ ok: false, error: 'Could not load invoices.' }, 502);
  }

  const sent: string[] = [];
  const skipped: string[] = [];

  for (const inv of invoices) {
    const due = new Date(inv.dueDate);
    if (Number.isNaN(due.getTime())) { skipped.push(`${inv.invoiceId}: bad due date`); continue; }

    const overdueDays = daysBetween(due, now);
    const already = Number(inv.reminderCount) || 0;

    // How many stages this invoice has passed. One email per stage, ever.
    const dueStages = STAGES.filter((d) => overdueDays >= d).length;
    if (dueStages <= already) { skipped.push(`${inv.invoiceId}: nothing due`); continue; }

    const email = inv.client?.clientEmail;
    const token = inv.accessToken;
    if (!email || !token) { skipped.push(`${inv.invoiceId}: no client email or token`); continue; }

    const totalMinor = Number(inv.amountMinor) || 0;
    const paidMinor = Math.max(0, Number(inv.amountPaidMinor) || 0);
    const balanceMinor = Math.max(0, totalMinor - paidMinor);
    const currency = String(inv.currency || 'GHS').toUpperCase();
    const amount = new Intl.NumberFormat('en-US', {
      style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(balanceMinor / 100);

    const link = `${site}/invoice/${encodeURIComponent(inv.invoiceId)}/?t=${encodeURIComponent(token)}`;
    const stage = STAGES[Math.min(dueStages, STAGES.length) - 1];
    const firm = stage >= 14;

    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;">
  <div style="background:#0D1B6E;padding:22px;border-radius:8px 8px 0 0;color:#fff;font-size:19px;font-weight:bold;">
    ${firm ? 'Overdue invoice' : 'A gentle reminder'}
  </div>
  <div style="background:#fff;border:1px solid #dde3f0;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;margin-top:0;">
      Hi ${escapeHtml(inv.client?.contactName || inv.client?.clientName || 'there')},
    </p>
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      ${firm
        ? `Invoice <strong>${escapeHtml(inv.invoiceId)}</strong> is now ${overdueDays} days past due. Could you let us know when we can expect payment?`
        : `This is a friendly nudge that invoice <strong>${escapeHtml(inv.invoiceId)}</strong> was due on ${escapeHtml(due.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))}.`}
    </p>
    <div style="background:#F4F7FB;border-left:4px solid #00B4D8;padding:16px 20px;margin:20px 0;">
      <div style="color:#0D1B6E;font-weight:bold;font-size:20px;">${escapeHtml(amount)}</div>
      <div style="color:#666;font-size:13px;margin-top:4px;">
        ${paidMinor > 0 ? 'Balance outstanding after your deposit' : 'Amount outstanding'}
      </div>
    </div>
    <a href="${escapeHtml(link)}" style="display:inline-block;background:#0D1B6E;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:15px;font-weight:bold;">View &amp; pay invoice</a>
    <p style="color:#666;font-size:13px;line-height:1.7;margin-top:22px;">
      Already paid? Ignore this and accept our apologies — just reply and we will
      put it right.
    </p>
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      Ernest Avorwlanu<br><span style="color:#666;font-size:13px;">Founder - Quadem Digital Enterprise</span>
    </p>
  </div>
</div>`;

    try {
      const mail = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Ernest at Quadem Digital <ernest@quademdigital.com>',
          to: [email],
          reply_to: owner,
          subject: firm
            ? `Overdue: invoice ${inv.invoiceId} — ${amount}`
            : `Reminder: invoice ${inv.invoiceId} — ${amount}`,
          html,
        }),
      });
      if (!mail.ok) {
        console.error('[chase-invoices] send failed', inv.invoiceId, await mail.text());
        skipped.push(`${inv.invoiceId}: send failed`);
        continue;
      }
    } catch (e) {
      console.error('[chase-invoices] send threw', inv.invoiceId, e);
      skipped.push(`${inv.invoiceId}: send threw`);
      continue;
    }

    // Only record after the email actually went, so a send failure retries
    // tomorrow rather than being silently marked done.
    try {
      await fetch(`${baseUrl}/api/invoices/${inv.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'overdue',
          reminderCount: dueStages,
          lastReminderAt: now.toISOString(),
        }),
      });
    } catch (e) {
      console.error('[chase-invoices] could not record reminder', inv.invoiceId, e);
    }

    sent.push(`${inv.invoiceId} (day ${stage})`);
  }

  console.log('[chase-invoices]', { checked: invoices.length, sent, skipped });
  return json({ ok: true, checked: invoices.length, sent, skipped }, 200);
};
