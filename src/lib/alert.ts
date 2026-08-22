import { escapeHtml } from './html';
import { mailFrom } from './mailFrom';

/**
 * Escalate a lead-pipeline failure to the owner, carrying the raw submission.
 *
 * Every failure path in the lead pipeline used to end at console.error. On
 * Vercel that is a log nobody reads, so a lead could fail to save and vanish
 * while the visitor saw a success message. The submission travels with the
 * alert deliberately: a lead that arrives as an email is recoverable, a lead
 * that arrives in a log file is gone.
 *
 * Never throws: alerting must not be able to fail the request it is reporting.
 */
export async function alertPipelineFailure(
  stage: string,
  detail: unknown,
  submission: unknown,
): Promise<void> {
  console.error(`[lead-pipeline] ${stage}:`, detail);

  const apiKey = import.meta.env.RESEND_API_KEY;
  const to = import.meta.env.ERNEST_EMAIL || 'ernest@quademdigital.com';
  if (!apiKey) return;

  const detailText =
    detail instanceof Error
      ? `${detail.name}: ${detail.message}`
      : typeof detail === 'string'
        ? detail
        : JSON.stringify(detail, null, 2);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: mailFrom('Quadem Alerts'),
        to: [to],
        subject: `⚠️ Lead pipeline failure at: ${stage}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 640px;">
            <h2 style="color:#c0392b; margin-bottom: 4px;">Lead pipeline failure</h2>
            <p style="margin-top:0;"><strong>Stage:</strong> ${escapeHtml(stage)}</p>
            <p><strong>Error</strong></p>
            <pre style="background:#f4f4f4;padding:12px;border-radius:6px;white-space:pre-wrap;">${escapeHtml(detailText)}</pre>
            <p><strong>Submission</strong></p>
            <pre style="background:#f4f4f4;padding:12px;border-radius:6px;white-space:pre-wrap;">${escapeHtml(JSON.stringify(submission, null, 2))}</pre>
            <p>This lead may not have been saved. Follow up manually.</p>
          </div>
        `,
      }),
    });
    if (!res.ok) {
      console.error('[lead-pipeline] alert email rejected:', await res.text());
    }
  } catch (err) {
    // Deliberately swallowed: the caller is already in a failure path.
    console.error('[lead-pipeline] alert email itself failed:', err);
  }
}
