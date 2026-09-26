import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';

for (const status of ['pending', 'unsubscribed', 'bounced', 'complained', null, 'subscribed']) {
  for (const optedIn of [false, true]) {
    test(`enquiry keeps transactional delivery separate from ${status} marketing, opt-in ${optedIn}`, async () => {
      const calls = { emails: [], contacts: [], events: [], confirmations: [], records: [], alerts: [] };
      const env = { RESEND_API_KEY: 'test-only', CMS_WEBHOOK_SECRET: 'test-secret-longer-than-sixteen', PUBLIC_PAYLOAD_URL: 'https://cms.invalid' };
      class Resend {
        emails = { send: async data => { calls.emails.push(data); return { data: { id: 'test' } }; } };
        contacts = { create: async data => { calls.contacts.push(data); return {}; } };
        events = { send: async data => { calls.events.push(data); return {}; } };
      }
      const api = loadTs('src/pages/api/submit-form.ts', { env, globals: { fetch: async () => Response.json({ doc: { id: 123 } }) }, mocks: {
        resend: { Resend },
        '../../lib/leadToken': loadTs('src/lib/leadToken.ts', { env }),
        '../../lib/alert': { alertPipelineFailure: async (...args) => calls.alerts.push(args) },
        '../../utils/emailValidation': { isValidEmail: () => ({ valid: true }) },
        '../../lib/html': { escapeHtml: String }, '../../lib/mailFrom': { mailFrom: () => 'sender@example.com' },
        '../../lib/subscribers': {
          recordSubscriber: async data => { calls.records.push(data); return status ? { status, unsubscribeToken: 'test-token' } : null; },
          mayEmail: async () => true, NEWSLETTER_AUDIENCE_ID: 'test-audience',
        },
        '../../lib/emailTemplate': { renderEmail: async () => '<p>Receipt</p>', p: String, html: String, link: String },
        '../../lib/confirmSubscription': { sendConfirmation: async (...args) => calls.confirmations.push(args) },
        '../../lib/payload': {},
      } });
      const response = await api.POST({ request: new Request('https://site.invalid/api/submit-form/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'QA', email: 'qa@example.com', message: 'Test enquiry', newsletterOptIn: optedIn }),
      }) });
      assert.equal(response.status, 200);
      assert.equal(calls.emails.length, 2, 'owner notification and transactional receipt still send');
      assert.equal(calls.records[0].consented, optedIn);
      assert.equal(calls.records[0].status, 'pending');
      assert.equal(calls.contacts.length, status === 'subscribed' ? 1 : 0);
      assert.equal(calls.events.length, status === 'subscribed' ? 1 : 0);
      assert.equal(calls.confirmations.length, status === 'pending' && optedIn ? 1 : 0);
      assert.equal(calls.alerts.length, 0);
    });
  }
}
