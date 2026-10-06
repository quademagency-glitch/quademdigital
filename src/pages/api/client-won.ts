// ─────────────────────────────────────────────────────────────
//  QUADEM DIGITAL: Client Won Handler
//  Place at: src/pages/api/client-won.ts
//
//  Called one step at a time by the durable Payload onboarding task.
//  Files three documents before sending any email via Resend:
//    1. Service Agreement (contract)
//    2. Welcome Pack
//    3. Service-specific Setup Instructions
//
//  Also notifies Ernest with a summary + quick-reply links.
// ─────────────────────────────────────────────────────────────

import type { APIRoute } from 'astro'
import { escapeHtml } from '../../lib/html'
import { generateWelcomePackPdf as generateWelcomePack } from '../../lib/welcomePackPdf'
import { SERVICE, fmtDate, generateContract, generateSetupInstructions, type ClientData } from '../../lib/onboardingDocs'

// ── Env vars ──────────────────────────────────────────────────
const RESEND_API_KEY  = import.meta.env.RESEND_API_KEY
const ERNEST_EMAIL    = import.meta.env.ERNEST_EMAIL    ?? 'ernest@quademdigital.com'
const WEBHOOK_SECRET  = import.meta.env.CMS_WEBHOOK_SECRET

// ── Email delivery timing ─────────────────────────────────────
// Documents are generated once but delivered at staggered times so
// the client can read each one before the next arrives.
// Override these in .env if you want different intervals.
const CMS_URL = (import.meta.env.PUBLIC_PAYLOAD_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const CMS_API_KEY = import.meta.env.PAYLOAD_API_KEY

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const CONTRACT_DELAY_HOURS = Number(import.meta.env.CONTRACT_DELAY_HOURS ?? 2)    // default 2h
const SETUP_DELAY_HOURS    = Number(import.meta.env.SETUP_DELAY_HOURS    ?? 24)   // default 24h
const CHECKIN_DELAY_HOURS  = Number(import.meta.env.CHECKIN_DELAY_HOURS  ?? 168)  // default 7 days


// ─────────────────────────────────────────────────────────────
//  Send onboarding email to client (3 docs attached)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
//  Three staggered client emails
//  Email 1: Welcome Pack (immediate)
//  Email 2: Service Agreement (CONTRACT_DELAY_HOURS later, default 2h)
//  Email 3: Setup Instructions (SETUP_DELAY_HOURS later, default 24h)
// ─────────────────────────────────────────────────────────────

// Renders a personal note block if the note has content, otherwise returns empty string.
// Appears as a warm amber highlight so it visually reads as a personal message
// from Ernest rather than boilerplate.
function personalNote(note?: string): string {
  if (!note?.trim()) return ''
  return `
    <div style="background:#fffbf0;border-left:4px solid #f5a623;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
      <div style="color:#7a4f00;font-size:13px;font-weight:bold;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">A personal note</div>
      <div style="color:#333;font-size:14px;line-height:1.8;">${note.trim()}</div>
    </div>`
}

function header(c: ClientData) {
  return `
<div style="font-family:Calibri,Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#0D1B6E;padding:28px 32px;border-radius:8px 8px 0 0;">
    <div style="color:#00B4D8;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Quadem Digital Enterprise</div>`
}

function footer() {
  return `
    <p style="color:#1A1A1A;font-size:15px;">
      Questions? Reply to this email or reach me on WhatsApp.<br><br>
      Warm regards,<br>
      <strong>Ernest Avorwlanu</strong><br>
      Founder - Quadem Digital Enterprise<br>
      <a href="https://quademdigital.com" style="color:#00B4D8;">quademdigital.com</a>
    </p>
  </div>
</div>`
}

/**
 * Portal credentials, inside the welcome email.
 *
 * The access code was generated on client creation and then never delivered,
 * the only way a client could learn it was Ernest reading it out of the admin
 * panel, so the portal went largely unused. It ships with the welcome email now.
 *
 * Rendered only when a code is present, so an older client record that predates
 * this never emails an empty box.
 */
function portalBlock(c: ClientData): string {
  if (!c.accessCode) return ''
  const url = c.portalUrl || 'https://quademdigital.com/portal/'
  return `
    <div style="background:#F4F7FB;border:1px solid #dde3f0;padding:20px;border-radius:8px;margin:20px 0;">
      <div style="color:#0D1B6E;font-weight:bold;margin-bottom:6px;">Your client portal</div>
      <p style="color:#333;font-size:14px;line-height:1.7;margin:0 0 14px;">
        Track your project, view your documents and pay invoices in one place.
      </p>
      <div style="color:#333;font-size:14px;margin-bottom:4px;">Your access code</div>
      <div style="font-family:monospace;font-size:20px;font-weight:bold;color:#0D1B6E;letter-spacing:2px;background:#fff;border:1px dashed #00B4D8;padding:12px 16px;border-radius:6px;display:inline-block;">${escapeHtml(c.accessCode)}</div>
      <p style="color:#666;font-size:13px;line-height:1.6;margin:14px 0 16px;">
        Keep this private. Anyone with it can open your portal.
      </p>
      <a href="${escapeHtml(url)}" style="display:inline-block;background:#0D1B6E;color:#fff;text-decoration:none;padding:11px 22px;border-radius:6px;font-size:14px;font-weight:bold;">Open your portal</a>
    </div>`
}

// Email 1: Welcome Pack (sent immediately)
function sendWelcomeEmail(c: ClientData, filename: string, base64: string, key: string) {
  const service = SERVICE[c.service] ?? c.service
  const html = `
${header(c)}
    <div style="color:#fff;font-size:22px;font-weight:bold;">Welcome aboard, ${c.contactName}!</div>
  </div>
  <div style="background:#fff;border:1px solid #dde3f0;padding:32px;border-radius:0 0 8px 8px;">
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      Thank you for choosing Quadem Digital for <strong>${escapeHtml(c.businessName)}</strong>.
      I look forward to working with you on <strong>${escapeHtml(service)}</strong>.
    </p>
    ${personalNote(c.emailNotes?.welcome)}
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      Attached is your <strong>Welcome Pack PDF</strong>. It contains your project summary,
      your dedicated contact, and a clear picture of what happens next.
    </p>
    <div style="background:#E8F6FB;border-left:4px solid #00B4D8;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
      <div style="color:#0D1B6E;font-weight:bold;margin-bottom:8px;">What to expect next</div>
      <div style="color:#333;font-size:14px;line-height:2;">
        ${c.signOnline ? 'In a couple of hours, your <strong>Service Agreement</strong>, to read and sign online' : 'In a couple of hours, your <strong>Service Agreement</strong> to review and sign'}<br>
        Tomorrow, your <strong>Setup Checklist</strong> with the items we need from you<br>
        I will contact you to arrange our kick-off conversation
      </div>
    </div>
    ${portalBlock(c)}
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      Take a few minutes to read through the Welcome Pack at your convenience.
      Your agreement and setup checklist will follow separately. You can reply to this email whenever you have a question.
    </p>
${footer()}`

  return fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      from:        'Ernest at Quadem Digital <ernest@quademdigital.com>',
      to:          [c.email],
      subject:     `Welcome to Quadem Digital, ${c.contactName}!`,
      html,
      attachments: [{ filename, content: base64, content_type: 'application/pdf' }],
    }),
  })
}

// Email 2: Service Agreement (sent after CONTRACT_DELAY_HOURS)
function sendContractEmail(c: ClientData, filename: string, base64: string, scheduledAt: string, key: string) {
  const service = SERVICE[c.service] ?? c.service
  const html = `
${header(c)}
    <div style="color:#fff;font-size:22px;font-weight:bold;">Your Service Agreement is ready</div>
  </div>
  <div style="background:#fff;border:1px solid #dde3f0;padding:32px;border-radius:0 0 8px 8px;">
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      Hi ${c.contactName}, your <strong>Service Agreement PDF</strong> for your
      <strong>${service}</strong> engagement with Quadem Digital is attached.
    </p>
    ${personalNote(c.emailNotes?.contract)}
    <div style="background:#E8F6FB;border-left:4px solid #00B4D8;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
      <div style="color:#0D1B6E;font-weight:bold;margin-bottom:8px;">Action required</div>
      <div style="color:#333;font-size:14px;line-height:1.8;">
        Please read through the agreement, sign the signature block on the last page,
        and return a signed copy to this email address at your earliest convenience.
        We cannot begin work until the signed agreement is received.
      </div>
    </div>
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      If you have any questions about the agreement or would like to discuss any
      of the terms, simply reply to this email and we will sort it out together.
    </p>
${footer()}`

  return fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      from:        'Ernest at Quadem Digital <ernest@quademdigital.com>',
      to:          [c.email],
      subject:     `Your Service Agreement: ${c.businessName} x Quadem Digital`,
      html,
      attachments: [{ filename, content: base64, content_type: 'application/pdf' }],
      scheduled_at: scheduledAt,
    }),
  })
}

// Email 3: Setup Instructions (sent after SETUP_DELAY_HOURS)
function sendSetupEmail(c: ClientData, filename: string, base64: string, scheduledAt: string, key: string) {
  const service = SERVICE[c.service] ?? c.service
  const html = `
${header(c)}
    <div style="color:#fff;font-size:22px;font-weight:bold;">Here is what we need from you</div>
  </div>
  <div style="background:#fff;border:1px solid #dde3f0;padding:32px;border-radius:0 0 8px 8px;">
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      Hi ${c.contactName}, we are almost ready to kick off your <strong>${service}</strong> project.
      Before we can begin, there are a few things we need from your side.
    </p>
    ${personalNote(c.emailNotes?.setup)}
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      Attached is your <strong>Setup Checklist</strong>, a short list of access credentials,
      assets, and information specific to your service. The sooner we receive these,
      the sooner we can get started.
    </p>
    <div style="background:#E8F6FB;border-left:4px solid #00B4D8;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
      <div style="color:#0D1B6E;font-weight:bold;margin-bottom:8px;">How to send us what we need</div>
      <div style="color:#333;font-size:14px;line-height:1.8;">
        Simply reply to this email with the items listed in the checklist.
        If you have files to share (logos, documents), attach them directly to your reply
        or send a Google Drive or Dropbox link.
      </div>
    </div>
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      If anything on the list is unclear, do not hesitate to ask. We are here to help.
    </p>
${footer()}`

  return fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      from:        'Ernest at Quadem Digital <ernest@quademdigital.com>',
      to:          [c.email],
      subject:     `Getting started: what we need from ${c.businessName}`,
      html,
      attachments: [{ filename, content: base64 }],
      scheduled_at: scheduledAt,
    }),
  })
}

// Email 4: Week-one check-in (sent after CHECKIN_DELAY_HOURS, default 7 days)
function sendCheckinEmail(c: ClientData, scheduledAt: string, key: string) {
  const service = SERVICE[c.service] ?? c.service
  const html = `
${header(c)}
    <div style="color:#fff;font-size:22px;font-weight:bold;">Checking in. How is everything going?</div>
  </div>
  <div style="background:#fff;border:1px solid #dde3f0;padding:32px;border-radius:0 0 8px 8px;">
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      Hi ${c.contactName}, it has been a week since you came aboard and we wanted to
      check in. Your <strong>${service}</strong> project is underway and things are
      moving on our end.
    </p>
    ${personalNote(c.emailNotes?.checkin)}
    <div style="background:#E8F6FB;border-left:4px solid #00B4D8;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
      <div style="color:#0D1B6E;font-weight:bold;margin-bottom:8px;">A quick reminder</div>
      <div style="color:#333;font-size:14px;line-height:1.8;">
        ${c.signOnline
          ? 'If you have not yet signed your <strong>Service Agreement</strong>, the link to sign it online is in its email. Reply to this one and we will send it again.'
          : 'If you have not yet returned your signed <strong>Service Agreement</strong>, please do so at your earliest convenience so we can keep things moving without delays.'}<br><br>
        If you have not yet sent through your <strong>onboarding items</strong> (brand assets,
        access credentials, etc.), a quick reply to that email with what you have so far is
        all we need to get started.
      </div>
    </div>
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      If you have already taken care of both, thank you, we are all set!
      You will be hearing from us shortly with your first updates.
    </p>
    <p style="color:#1A1A1A;font-size:15px;line-height:1.7;">
      Any questions at all, just hit reply. We are always happy to help.
    </p>
${footer()}`

  return fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      from:        'Ernest at Quadem Digital <ernest@quademdigital.com>',
      to:          [c.email],
      subject:     `Quick check-in: ${c.businessName} x Quadem Digital`,
      html,
      scheduled_at: scheduledAt,
    }),
  })
}

// ─────────────────────────────────────────────────────────────
//  Notify Ernest
// ─────────────────────────────────────────────────────────────
async function notifyErnest(c: ClientData, key: string) {
  const service   = SERVICE[c.service] ?? c.service
  const waLink    = c.phone
    ? `https://wa.me/${c.phone.replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(c.contactName)}%2C%20welcome%20to%20Quadem%20Digital%21`
    : null

  const rows = [
    ['Business',   c.businessName],
    ['Contact',    c.contactName],
    ['Email',      c.email],
    ['Phone',      c.phone || 'Not provided'],
    ['Service',    service],
    ['Package',    c.package || '-'],
    ['Agreed fee', c.price ? `${c.currency || 'GHS'} ${c.price.toLocaleString()}${c.customizations?.duration === 0 ? ' (one-off)' : '/month'}` : '-'],
    ['Start Date', fmtDate(c.startDate)],
  ]

  const html = `
<div style="font-family:Calibri,Arial,sans-serif;max-width:600px;margin:32px auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(13,27,110,0.12);">
  <div style="background:#0D1B6E;padding:28px 32px;">
    <div style="color:#00B4D8;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Quadem CMS</div>
    <div style="color:#fff;font-size:22px;font-weight:bold;">New Client Won</div>
    <div style="color:#E8F6FB;font-size:13px;margin-top:4px;">Documents saved and onboarding emails accepted for delivery</div>
  </div>
  <div style="background:#fff;padding:32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
      ${rows.map(([label, value], i) => `
      <tr>
        <td style="padding:10px 14px;background:${i % 2 === 0 ? '#0D1B6E' : '#1a2b8a'};color:#fff;font-weight:bold;font-size:13px;width:35%;">${label}</td>
        <td style="padding:10px 14px;background:${i % 2 === 0 ? '#E8F6FB' : '#fff'};color:#1A1A1A;font-size:13px;">${value}</td>
      </tr>`).join('')}
    </table>
    <div style="background:#E8F6FB;border-left:4px solid #00B4D8;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <strong style="color:#0D1B6E;">Staggered delivery scheduled:</strong><br>
      <span style="color:#333;font-size:13px;line-height:2;">
        📋 <strong>Welcome Pack</strong>: accepted for sending<br>
        📄 <strong>Service Agreement</strong>: scheduled; see the client delivery record<br>
        ✅ <strong>Setup Instructions</strong>: scheduled; see the client delivery record<br>
        💬 <strong>Week-one check-in</strong>: scheduled; see the client delivery record
      </span>
    </div>
    <div>
      <a href="mailto:${c.email}?subject=Welcome%20to%20Quadem%20Digital" style="display:inline-block;background:#0D1B6E;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:bold;margin-right:8px;">Reply by Email</a>
      ${waLink ? `<a href="${waLink}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:bold;">WhatsApp ${c.contactName}</a>` : ''}
    </div>
  </div>
  <div style="background:#0D1B6E;padding:14px 32px;text-align:center;">
    <span style="color:#E8F6FB;font-size:11px;">Quadem CMS &bull; cms.quademdigital.com</span>
  </div>
</div>`

  return fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      from:    'Quadem CMS <ernest@quademdigital.com>',
      to:      [ERNEST_EMAIL],
      subject: `New client won: ${c.businessName}, ${service}`,
      html,
    }),
  })
}

// ─────────────────────────────────────────────────────────────
//  API Route Handler
// ─────────────────────────────────────────────────────────────
// Each call performs one queued step. The CMS persists its result before
// requesting another step, and reuses the same key after an uncertain response.
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const cmsHeaders = () => ({ Authorization: `users API-Key ${CMS_API_KEY}` });
const fileSpecs = {
  fileContract: { type: 'sla', name: 'Service-Agreement', extension: 'pdf', mime: 'application/pdf', generate: generateContract },
  fileWelcome: { type: 'guide', name: 'Welcome-Pack', extension: 'pdf', mime: 'application/pdf', generate: generateWelcomePack },
  fileSetup: { type: 'setup', name: 'Setup-Instructions', extension: 'docx', mime: DOCX_MIME, generate: generateSetupInstructions },
};

async function findDocument(key: string, clientId: string) {
  const query = new URLSearchParams({ 'where[automationKey][equals]': key, limit: '1', depth: '0' });
  const response = await fetch(`${CMS_URL}/api/onboarding-documents?${query}`, { headers: cmsHeaders(), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Could not check existing onboarding documents.');
  const doc = (await response.json()).docs?.[0];
  if (doc && String(typeof doc.client === 'object' ? doc.client.id : doc.client) !== String(clientId)) throw new Error('Document belongs to another client.');
  return doc;
}

async function ensureDocument(step: keyof typeof fileSpecs, c: ClientData, key: string) {
  if (step === 'fileWelcome' || step === 'fileContract') key = `${key}/pdf-v1`;
  const existing = await findDocument(key, String(c.id));
  if (existing) return existing;
  const spec = fileSpecs[step];
  const buffer = await spec.generate(c);
  const filename = `Quadem-${spec.name}-${c.businessName.replace(/[^a-zA-Z0-9]/g, '-')}-${key.split('/')[2]}.${spec.extension}`;
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: spec.mime }), filename);
  // Queue keys use strings, but Payload's Postgres relationship requires a
  // numeric ID. A string here rejects every new onboarding document.
  const clientId = Number(c.id);
  if (!Number.isSafeInteger(clientId) || clientId <= 0) throw new Error('Invalid client relationship ID.');
  form.append('_payload', JSON.stringify({ client: clientId, documentType: spec.type, origin: 'automation', automationKey: key }));
  const response = await fetch(`${CMS_URL}/api/onboarding-documents`, { method: 'POST', headers: cmsHeaders(), body: form, signal: AbortSignal.timeout(30000) });
  if (response.ok) return (await response.json()).doc;
  // A concurrent/uncertain create may already have committed the unique key.
  const saved = await findDocument(key, String(c.id));
  if (saved) return saved;
  throw new Error(`Document filing failed (${response.status}).`);
}

async function attachment(documentId: unknown, clientId: string, expectedType: string) {
  if (!documentId) throw new Error('Save the attachment before sending its email.');
  const response = await fetch(`${CMS_URL}/api/onboarding-documents/${encodeURIComponent(String(documentId))}?depth=0`, { headers: cmsHeaders(), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('The saved attachment could not be read.');
  const doc = await response.json();
  if (String(doc.client) !== String(clientId) || doc.documentType !== expectedType || doc.origin !== 'automation') throw new Error('Attachment does not match this client and email.');
  if (['guide', 'sla'].includes(expectedType) && !doc.filename?.toLowerCase().endsWith('.pdf')) throw new Error('Regenerate this document as a PDF before sending.');
  // Always read through the authenticated CMS route. Never send the API key
  // to an arbitrary URL returned by a media record.
  const file = await fetch(`${CMS_URL}/api/onboarding-documents/file/${encodeURIComponent(doc.filename)}`, { headers: cmsHeaders(), signal: AbortSignal.timeout(20000) });
  if (!file.ok) throw new Error('The saved attachment file is unavailable.');
  return { filename: doc.filename, base64: Buffer.from(await file.arrayBuffer()).toString('base64') };
}

export const POST: APIRoute = async ({ request }) => {
  if (!WEBHOOK_SECRET || request.headers.get('x-quadem-secret') !== WEBHOOK_SECRET) return reply({ ok: false, error: 'Unauthorized' }, 401);
  let body: any;
  try { body = await request.json(); } catch { return reply({ ok: false, error: 'Invalid JSON' }, 400); }
  if (body.event !== 'client.onboarding.step') return reply({ ok: false, error: 'Update the CMS to the queued onboarding workflow before sending.' }, 409);
  const { client, step, key, attemptedAt, document } = body;
  if (!client?.id || !client.businessName || !client.email || typeof key !== 'string' || !key.startsWith(`onboarding/${client.id}/`) || key.length > 220 || !Number.isFinite(Date.parse(attemptedAt))) return reply({ ok: false, error: 'Invalid onboarding step.' }, 400);
  if (!CMS_API_KEY || !RESEND_API_KEY) return reply({ ok: false, error: 'Onboarding credentials are not configured.' }, 503);
  if (!Object.hasOwn(fileSpecs, step) && !['welcome', 'contract', 'setup', 'checkin', 'notify'].includes(step)) return reply({ ok: false, error: 'Unknown onboarding step.' }, 400);
  try {
    if (Object.hasOwn(fileSpecs, step)) {
      const doc = await ensureDocument(step as keyof typeof fileSpecs, client, key);
      if (!doc?.id) throw new Error('The CMS did not confirm the saved document.');
      return reply({ ok: true, documentId: doc.id, filename: doc.filename });
    }
    // An uncertain response older than the provider's 24-hour key retention
    // requires reconciliation, not another send with an expired key.
    if (Date.now() - Date.parse(attemptedAt) >= 23 * 60 * 60 * 1000) return reply({ ok: false, error: 'This delivery needs reconciliation before retry.' }, 409);
    const hours = step === 'contract' ? CONTRACT_DELAY_HOURS : step === 'setup' ? SETUP_DELAY_HOURS : CHECKIN_DELAY_HOURS;
    const scheduledAt = new Date(Date.parse(attemptedAt) + hours * 3600000).toISOString();
    let response: Response;
    if (step === 'checkin') response = await sendCheckinEmail(client, scheduledAt, key);
    else if (step === 'notify') response = await notifyErnest(client, key);
    else {
      const file = await attachment(document?.documentId, String(client.id), step === 'welcome' ? 'guide' : step === 'contract' ? 'sla' : 'setup');
      response = step === 'welcome' ? await sendWelcomeEmail(client, file.filename, file.base64, key)
        : step === 'contract' ? await sendContractEmail(client, file.filename, file.base64, scheduledAt, key)
        : await sendSetupEmail(client, file.filename, file.base64, scheduledAt, key);
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.id) return reply({ ok: false, error: `Email was not confirmed by Resend (${response.status}).` }, 502);
    return reply({ ok: true, providerId: result.id, acceptedAt: new Date().toISOString(), ...(['contract', 'setup', 'checkin'].includes(step) ? { scheduledAt } : {}) });
  } catch (error) {
    console.error('[client-won] Step failed:', error);
    return reply({ ok: false, error: error instanceof Error ? error.message : 'Onboarding step failed.' }, 502);
  }
};

export const GET: APIRoute = () => reply({ service: 'client-onboarding', version: 2 });
