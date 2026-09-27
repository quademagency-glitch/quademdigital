import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadTs } from './helpers/load-ts.mjs';
const env = { CMS_WEBHOOK_SECRET: 'fixture-secret', PAYLOAD_API_KEY: 'fixture', RESEND_API_KEY: 'fixture', PUBLIC_PAYLOAD_URL: 'https://cms.invalid', PAYSTACK_SECRET_KEY: 'sk_test_fixture', CRON_SECRET: 'cron-fixture' };
const req = (url, body, headers = {}) => new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
function campaignApi({ fail = false, finishFail = false, claimFail = false, subscribers } = {}) {
  const writes = [], messages = [];
  const api = loadTs('src/pages/api/campaigns/send.ts', { env, mocks: {
    resend: { Resend: class { batch = { send: async (m) => { messages.push(...m); return fail ? { error: { message: 'rejected' } } : { data: { data: m.map((_, i) => ({ id: `mail-${i}` })) } }; } }; } },
    '../../../lib/mailFrom': { mailFrom: () => 'test@example.com' },
    '../../../lib/emailTemplate': { renderEmail: async x => x.bodyHtml, block: x => x },
    '../../../lib/payload': { lexicalToHtml: () => '<p>Fixture</p>' },
  }, globals: { fetch: async (url, init) => {
    if (url.includes('/delivery')) { const b = JSON.parse(init.body); writes.push(b); return Response.json({ ok: !(b.action === 'claim' ? claimFail : finishFail) }, { status: (b.action === 'claim' ? claimFail : finishFail) ? 409 : 200 }); }
    if (url.includes('emailCampaigns')) return Response.json({ subject: 'QA fixture', body_html: '<p>QA fixture</p>', segment: subscribers ? 'all' : 'test' });
    if (url.includes('subscribers')) return Response.json({ docs: subscribers || [], hasNextPage: false });
    if (init?.method === 'DELETE') return Response.json({});
    throw Error(url);
  } } });
  return { api, writes, messages };
}
const campaignRequest = () => ({ request: req('https://site.invalid/api/campaigns/send/', { campaignId: 1 }, { 'x-quadem-secret': env.CMS_WEBHOOK_SECRET }) });
test('campaign failures are not marked sent and reserve the attempt for reconciliation', async () => {
  const { api, writes } = campaignApi({ fail: true });
  assert.equal((await api.POST(campaignRequest())).status, 502);
  assert.equal(writes[0].action, 'claim'); assert.equal(writes[1].complete, false); assert.equal(writes[1].sent, 0);
});
test('campaign cannot send when its atomic reservation is refused', async () => {
  const { api, messages } = campaignApi({ claimFail: true });
  assert.equal((await api.POST(campaignRequest())).status, 409); assert.equal(messages.length, 0);
});
test('campaign requires confirmed provider IDs and saved completion; successful test stays a test', async () => {
  const { api, writes } = campaignApi();
  assert.equal((await api.POST(campaignRequest())).status, 200); assert.equal(writes.at(-1).complete, true); assert.equal(writes.at(-1).test, true);
  assert.equal((await campaignApi({ finishFail: true }).api.POST(campaignRequest())).status, 502);
});
test('campaign excludes pending subscribers and deduplicates addresses', async () => {
  const { api, messages } = campaignApi({ subscribers: [{ email: 'ONE@example.com', status: 'subscribed' }, { email: 'one@example.com', status: 'subscribed' }, { email: 'pending@example.com', status: 'pending' }] });
  assert.equal((await api.POST(campaignRequest())).status, 200); assert.equal(messages.length, 1);
});
const invoice = { id: 12, invoiceId: 'QA-12', status: 'pending', amountMinor: 10000, currency: 'GHS', depositMinor: 3000, amountPaidMinor: 0 };
function settlement({ amount = 3000, currency = 'GHS', status = 'success', existing = {}, writeFails = false } = {}) {
  const writes = [];
  const api = loadTs('src/lib/paystack.ts', { env, globals: { fetch: async (url, init) => {
    if (url.includes('paystack.co')) return Response.json({ status: true, data: { status, amount, currency, metadata: { invoiceId: 'QA-12' } } });
    if (init?.method === 'PATCH') { writes.push(JSON.parse(init.body)); return Response.json({}, { status: writeFails ? 500 : 200 }); }
    return Response.json({ docs: [{ ...invoice, ...existing }] });
  } } }); return { ...api, writes };
}
test('payment settles a deposit then only the outstanding balance; replay makes no write', async () => {
  const first = settlement(); assert.equal((await first.settleInvoice('payment-first')).body.fullySettled, false); assert.equal(first.writes[0].amountPaidMinor, 3000);
  const balance = settlement({ amount: 7000, existing: { amountPaidMinor: 3000, paystackReference: 'payment-first' } });
  assert.equal((await balance.settleInvoice('payment-balance')).body.fullySettled, true); assert.equal(balance.writes[0].status, 'paid');
  const replay = settlement({ existing: { paystackReference: 'payment-first' } });
  assert.equal((await replay.settleInvoice('payment-first')).body.alreadyApplied, true); assert.equal(replay.writes.length, 0);
});
test('payment rejects wrong currency, underpayment, non-finite amount, and unsuccessful charge', async () => {
  for (const options of [{ currency: 'USD' }, { amount: 100 }, { amount: 'not-a-number' }, { status: 'abandoned' }]) {
    const s = settlement(options); assert.equal((await s.settleInvoice('payment-invalid')).body.ok, false); assert.equal(s.writes.length, 0);
  }
  assert.equal((await settlement({ writeFails: true }).settleInvoice('payment-write')).status, 500);
});
test('checkout ignores browser amount and derives the deposit from the saved invoice', async () => {
  let submitted;
  const api = loadTs('src/pages/api/paystack-init.ts', { env, globals: { crypto, fetch: async (url, init) => {
    if (url.includes('paystack.co')) { submitted = JSON.parse(init.body); return Response.json({ status: true, data: { authorization_url: 'https://checkout.paystack.com/fixture' } }); }
    return Response.json({ docs: [{ ...invoice, accessToken: 'invoice-token', client: { clientEmail: 'owner@example.com' } }] });
  } } });
  const response = await api.POST({ request: req('https://site.invalid/api/paystack-init/', { invoiceId: 'QA-12', token: 'invoice-token', payWhat: 'deposit', amount: 1 }) });
  assert.equal(response.status, 200); assert.equal(submitted.amount, 3000); assert.equal(submitted.metadata.invoiceId, 'QA-12');
});
test('payment webhook rejects invalid signatures and requests a retry on settlement failures', async () => {
  let called = 0;
  const api = loadTs('src/pages/api/paystack-webhook.ts', { env, mocks: { '../../lib/paystack': { settleInvoice: async () => { called++; return { status: 500 }; } } } });
  const body = { event: 'charge.success', data: { reference: 'payment-hook' } };
  assert.equal((await api.POST({ request: req('https://site.invalid/hook', body) })).status, 401); assert.equal(called, 0);
  const signature = crypto.createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(JSON.stringify(body)).digest('hex');
  assert.equal((await api.POST({ request: req('https://site.invalid/hook', body, { 'x-paystack-signature': signature }) })).status, 500);
});
test('proposal preserves one-off billing and blocks mismatched totals before creating anything', async () => {
  const { provisionFromProposal } = loadTs('cms/src/utils/provisionFromProposal.ts');
  const base = { clientName: 'QA Fixture', clientEmail: 'owner@example.com', service: 'web-design', total: 100, currency: 'USD', startDate: '2026-10-01', recurring: false, durationMonths: 2, journeySteps: [{ title: 'Kickoff', owner: 'quadem', dueOffsetDays: 0 }] };
  const created = [];
  const payload = { findByID: async () => base, create: async args => { created.push(args); return { id: created.length, invoiceId: 'QA', currency: 'USD' }; }, update: async () => ({}) };
  assert.equal((await provisionFromProposal(1, payload)).ok, true);
  assert.equal(created[0].data.customizations.duration, 0); assert.equal(created[0].data.currency, 'USD');
  const { Clients } = loadTs('cms/src/collections/Clients.ts', { mocks: {
    '../fields/activityLog': { activityField: () => ({}), nextFollowUpField: () => ({}) },
    '../lib/accessCode': { generateAccessCode: () => 'fixture' },
    '../lib/onboarding': { prepareOnboarding() {}, queueOnboarding() {} },
  } });
  const flatten = fields => fields.flatMap(f => [f, ...flatten(f.fields || []), ...(f.tabs || []).flatMap(t => flatten(t.fields || []))]);
  const duration = flatten(Clients.fields).find(f => f.name === 'duration');
  assert.ok(created[0].data.customizations.duration >= duration.min, 'Proposal one-off duration must satisfy the actual CMS field constraint');

  base.lineItems = [{ description: 'Mismatch', quantity: 1, rate: 90 }]; created.length = 0;
  assert.equal((await provisionFromProposal(1, payload)).ok, false); assert.equal(created.length, 0);
  base.lineItems = []; base.startDate = null;
  assert.equal((await provisionFromProposal(1, payload)).ok, false); assert.equal(created.length, 0);
});
test('authenticated invoice reminder dry run never sends mail or writes an invoice', async () => {
  const api = loadTs('src/pages/api/cron/chase-invoices.ts', { env, mocks: { '../../../lib/html': { escapeHtml: String } }, globals: { fetch: async (_url, init) => { assert.equal(init.method, undefined); return Response.json({ docs: [{ ...invoice, dueDate: '2020-01-01', client: { clientEmail: 'owner@example.com' }, accessToken: 'private' }] }); } } });
  const response = await api.GET({ request: new Request('https://site.invalid/cron?dryRun=1', { headers: { Authorization: 'Bearer '+env.CRON_SECRET } }) });
  assert.equal(response.status, 200); assert.deepEqual((await response.json()).eligible, ['QA-12']);
});
test('invoice email uses its actual currency, escapes client text, and requires provider acceptance', async () => {
  let fail = true, sent;
  const api = loadTs('src/pages/api/send-invoice-email.ts', { env, mocks: {
    '../../lib/html': loadTs('src/lib/html.ts'),
    resend: { Resend: class { emails = { send: async m => { sent = m; return fail ? { error: { message: 'rejected' } } : { data: { id: 'invoice-provider' } }; } }; } },
  }, globals: { fetch: async () => Response.json({ invoiceId: 'QA-GBP', currency: 'GBP', accessToken: 'fixture-token', items: [{ quantity: 1, rate: 100 }], client: { clientName: '<img src=x>', clientEmail: 'owner@example.com' } }) } });
  const context = () => ({ request: req('https://site.invalid/invoice-email', { documentId: 7 }, { 'x-quadem-secret': env.CMS_WEBHOOK_SECRET }) });
  assert.equal((await api.POST(context())).status, 502);
  fail = false; const response = await api.POST(context()); assert.equal(response.status, 200); assert.equal((await response.json()).providerId, 'invoice-provider');
  assert.match(sent.html, /£100\.00/); assert.match(sent.html, /&lt;img src=x&gt;/); assert.equal(sent.replyTo, 'ernest@quademdigital.com');
});
