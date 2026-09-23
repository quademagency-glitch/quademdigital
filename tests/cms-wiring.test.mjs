import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';

const env = { CMS_WEBHOOK_SECRET: 'isolated-test-key-with-more-than-16-characters', PAYLOAD_API_KEY: 'test-only', PUBLIC_PAYLOAD_URL: 'https://cms.invalid' };
const tokens = loadTs('src/lib/leadToken.ts', { env });
const request = body => ({ request: new Request('https://site.invalid/api/submit-form/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });

function leadApi(fetch) {
  const alerts = [];
  const api = loadTs('src/pages/api/submit-form.ts', { env, globals: { fetch }, mocks: {
    '../../lib/leadToken': tokens,
    '../../lib/alert': { alertPipelineFailure: async (...args) => alerts.push(args) },
    '../../utils/emailValidation': { isValidEmail: () => ({ valid: true }) },
    '../../lib/html': {}, '../../lib/mailFrom': {}, '../../lib/subscribers': {},
    '../../lib/emailTemplate': {}, '../../lib/confirmSubscription': {}, '../../lib/payload': {},
  } });
  return { ...api, alerts };
}

test('lead tokens bind the record, email and expiry and reject tampering or missing signing keys', () => {
  const now = Date.now();
  const token = tokens.signLeadToken(123, 'Owner@example.com', now);
  assert.equal(tokens.verifyLeadToken(123, 'owner@example.com', token, now), true);
  for (const [id, email, value, time] of [
    [124, 'owner@example.com', token, now], [123, 'other@example.com', token, now],
    [123, 'owner@example.com', token + 'x', now], [123, 'owner@example.com', null, now],
    [123, 'owner@example.com', token, now + 86400000],
  ]) assert.equal(tokens.verifyLeadToken(id, email, value, time), false);
  const disabled = loadTs('src/lib/leadToken.ts');
  assert.equal(disabled.signLeadToken(123, 'owner@example.com'), null);
  assert.equal(disabled.verifyLeadToken(123, 'owner@example.com', token), false);
});

test('unauthorized enrichment never reaches the CMS or sends a notification', async () => {
  let calls = 0;
  const api = leadApi(async () => { calls++; throw new Error('must not run'); });
  for (const input of [{ leadId: 123, message: 'changed' }, { leadId: 123, email: 'other@example.com', leadToken: tokens.signLeadToken(123, 'owner@example.com') }]) {
    const res = await api.POST(request(input));
    assert.equal(res.status, 403);
  }
  assert.equal(calls, 0);
  assert.equal(api.alerts.length, 0);
});

test('initial capture issues a token usable for that same enquiry', async () => {
  const api = leadApi(async () => Response.json({ doc: { id: 123 } }));
  const res = await api.POST(request({ name: 'Fixture', email: 'owner@example.com', metadata: { partial: true } }));
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.leadId, 123);
  assert.equal(tokens.verifyLeadToken(body.leadId, 'owner@example.com', body.leadToken), true);
});

const nativeRequest = data => ({ request: new Request('https://site.invalid/api/submit-form/', {
  method: 'POST', body: new URLSearchParams(data),
}) });

test('native form errors cannot redirect visitors to an external return address', async () => {
  const api = leadApi(async () => { throw new Error('must not save an invalid enquiry'); });
  for (const returnTo of ['https://outside.invalid/', '//outside.invalid/', '/\\outside.invalid/', '/\t/outside.invalid/', '/folder/..//outside.invalid/', '/%2e//outside.invalid/']) {
    const response = await api.POST(nativeRequest({ returnTo }));
    assert.equal(response.status, 303);
    assert.equal(new URL(response.headers.get('location'), 'https://site.invalid').href, 'https://site.invalid/contact/?error=1');
  }
  assert.equal(api.alerts.length, 0);
});

test('native validation errors preserve page queries and anchors while replacing stale success', async () => {
  const api = leadApi(async () => { throw new Error('must not save an invalid enquiry'); });
  const response = await api.POST(nativeRequest({ returnTo: '/services/seo/?ref=footer&sent=1#error-message' }));
  assert.equal(response.status, 303);
  const location = new URL(response.headers.get('location'), 'https://site.invalid');
  assert.equal(location.pathname, '/services/seo/');
  assert.equal(location.searchParams.get('ref'), 'footer');
  assert.equal(location.searchParams.get('error'), '1');
  assert.equal(location.searchParams.has('sent'), false);
  assert.equal(location.hash, '#error-message');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('native form success preserves its page and clears stale errors after the lead is saved', async () => {
  const saved = [];
  const api = leadApi(async (_url, init) => { saved.push(JSON.parse(init.body)); return Response.json({ doc: { id: 123 } }); });
  const response = await api.POST(nativeRequest({ name: 'Fixture', email: 'owner@example.com', message: 'Project brief', returnTo: '/services/web-design/?ref=service&error=1#enquiry' }));
  assert.equal(response.status, 303);
  const location = new URL(response.headers.get('location'), 'https://site.invalid');
  assert.equal(location.pathname, '/services/web-design/');
  assert.equal(location.searchParams.get('ref'), 'service');
  assert.equal(location.searchParams.get('sent'), '1');
  assert.equal(location.searchParams.has('error'), false);
  assert.equal(location.hash, '#enquiry');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].message, 'Project brief');
});

test('failed enrichment returns an error; a retry updates the same record and succeeds', async () => {
  let status = 500;
  const calls = [];
  const api = leadApi(async (url, init) => { calls.push({ url, init }); return Response.json({}, { status }); });
  const input = { leadId: 123, email: 'owner@example.com', leadToken: tokens.signLeadToken(123, 'owner@example.com'), message: 'Complete details' };
  assert.equal((await api.POST(request(input))).status, 502);
  status = 200;
  assert.equal((await api.POST(request(input))).status, 200);
  assert.equal(api.alerts.length, 1);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.url, 'https://cms.invalid/api/leads/123');
    assert.equal(call.init.method, 'PATCH');
    assert.equal(JSON.parse(call.init.body).message, 'Complete details');
  }
  const offline = leadApi(async () => { throw new Error('offline'); });
  assert.equal((await offline.POST(request(input))).status, 502);
});

const client = { id: 123, clientName: 'Fixture Ltd', clientEmail: 'owner@example.com', contactName: 'Owner', service: 'web-design', price: 2500, startDate: '2026-10-01', accessCode: 'private-fixture', pipelineStatus: 'won' };
const onboarding = globals => loadTs('cms/src/lib/onboarding.ts', { globals: { process: { env: { ASTRO_SITE_URL: 'https://site.invalid', CMS_WEBHOOK_SECRET: 'test-only' } }, ...globals } });

test('Won conversion marks the client Won and keeps enquiry context for scope review', async () => {
  let created;
  const hook = loadTs('cms/src/hooks/convertWonLeadToClient.ts', { mocks: { '../lib/accessCode': { generateAccessCode: () => 'test-only' } } });
  await hook.convertWonLeadToClient({ operation: 'update', previousDoc: { status: 'qualified' }, doc: { id: 1, status: 'won', name: 'Fixture', email: 'owner@example.com', message: 'Need an online shop', servicesInterested: ['Web design'] }, req: { payload: { create: async args => { created = args.data; return { id: 123 }; }, update: async () => ({}) } } });
  assert.equal(created.pipelineStatus, 'won');
  assert.match(created.notes, /online shop/);
  const { prepareOnboarding } = onboarding();
  const review = prepareOnboarding({ data: created });
  assert.equal(review.onboardingState.status, 'needs-review');
  assert.match(review.onboardingStatus, /agreed price/);
  const ready = prepareOnboarding({ data: client, originalDoc: review });
  assert.equal(ready.onboardingState.status, 'pending');
  assert.ok(ready.onboardingState.requestId);
});

test('onboarding is queued once inside the client transaction, never sent in the save hook', async () => {
  const { prepareOnboarding, queueOnboarding } = onboarding();
  const doc = { ...client, ...prepareOnboarding({ data: { ...client } }) };
  const queued = [];
  const req = { payload: { jobs: { queue: async arg => queued.push(arg) } } };
  await queueOnboarding({ doc, req });
  await queueOnboarding({ doc, previousDoc: doc, req });
  assert.equal(queued.length, 1);
  assert.equal(queued[0].req, req);
  assert.equal(queued[0].task, 'clientOnboarding');
});

test('ordinary saves cannot overwrite delivery checkpoints or queue another completed run', () => {
  const { prepareOnboarding } = onboarding();
  for (const status of ['running', 'complete']) {
    const originalDoc = { ...client, onboardingState: { status, requestId: 'worker-checkpoint' }, onboardingStatus: 'Worker result' };
    const data = prepareOnboarding({ originalDoc, data: { notes: 'Editorial change', onboardingState: { status: 'pending' }, onboardingStatus: 'Old form value', retryOnboarding: status === 'complete' } });
    assert.equal(Object.hasOwn(data, 'onboardingState'), false);
    assert.equal(Object.hasOwn(data, 'onboardingStatus'), false);
    assert.equal(data.notes, 'Editorial change');
    assert.equal(data.retryOnboarding, false);
  }
});

test('an older frontend generic success cannot mark an onboarding step complete', async () => {
  let saved;
  const mod = onboarding({ fetch: async () => Response.json({ ok: true, skipped: true }) });
  const doc = { ...client, onboardingState: { requestId: 'request', runId: 'run' } };
  await mod.runClientOnboarding({ input: { clientId: 123, requestId: 'request' }, req: { payload: {
    findByID: async () => doc, db: { updateOne: async args => { saved = args.data; } },
  } } });
  assert.equal(saved.onboardingState.status, 'failed');
  assert.equal(saved.onboardingState.steps.fileContract.status, 'failed');
  assert.match(saved.onboardingStatus, /both deployments/);
});

test('filing-date failures are retryable without repeating an accepted email', async () => {
  const now = new Date().toISOString();
  let rejectFiling = true;
  const mod = onboarding({ fetch: async () => { throw new Error('must not resend'); } });
  let stored = { ...client, onboardingState: { requestId: 'request', runId: 'run', steps: Object.fromEntries(mod.ONBOARDING_STEPS.map(step => [step, { status: 'complete', result: step.startsWith('file') ? { documentId: step } : { providerId: step, acceptedAt: now } }])) } };
  const req = { payload: { findByID: async () => structuredClone(stored), db: { updateOne: async args => {
    if (args.collection === 'clients') stored = { ...stored, ...structuredClone(args.data) };
    else if (rejectFiling) throw new Error('Temporary database failure');
  } } } };
  const run = () => mod.runClientOnboarding({ input: { clientId: 123, requestId: 'request' }, req });
  assert.equal((await run()).output.ok, false);
  assert.match(stored.onboardingStatus, /without resending/);
  rejectFiling = false;
  assert.equal((await run()).output.ok, true);
});

test('onboarding checkpoints each step; retry skips accepted work and keeps request keys stable', async () => {
  let failContract = true;
  const calls = [], filings = [];
  const mod = onboarding({ fetch: async (_url, init) => {
    const b = JSON.parse(init.body); calls.push(b);
    if (b.step === 'contract' && failContract) return Response.json({ ok: false, error: 'Provider refused' }, { status: 502 });
    return Response.json({ ok: true, ...(b.step.startsWith('file') ? { documentId: b.step } : { providerId: b.step, acceptedAt: new Date().toISOString() }) });
  } });
  let stored = { ...client, ...mod.prepareOnboarding({ data: { ...client } }) };
  const req = { payload: {
    findByID: async () => structuredClone(stored),
    db: { updateOne: async arg => { if (arg.collection === 'clients') stored = { ...stored, ...structuredClone(arg.data) }; else filings.push(arg); } },
  } };
  const run = () => mod.runClientOnboarding({ input: { clientId: '123', requestId: stored.onboardingState.requestId }, req });
  assert.equal((await run()).output.ok, false);
  assert.equal(stored.onboardingState.status, 'failed');
  assert.equal(stored.onboardingState.steps.welcome.status, 'complete');
  const priorKey = stored.onboardingState.steps.contract.key;
  stored = { ...stored, ...mod.prepareOnboarding({ data: { retryOnboarding: true }, originalDoc: stored }) };
  failContract = false;
  assert.equal((await run()).output.ok, true);
  assert.equal(stored.onboardingState.status, 'complete');
  assert.equal(calls.filter(c => c.step === 'welcome').length, 1);
  assert.equal(calls.filter(c => c.step === 'fileContract').length, 1);
  assert.deepEqual(calls.filter(c => c.step === 'contract').map(c => c.key), [priorKey, priorKey]);
  assert.equal(filings.length, 3);
  const before = calls.length;
  await run();
  assert.equal(calls.length, before);
});

test('an uncertain email outside the idempotency window stops for reconciliation without a resend', async () => {
  const mod = onboarding({ fetch: async () => { throw new Error('must not send'); } });
  const state = { requestId: 'request', runId: 'run', steps: { fileContract: { status: 'complete' }, fileWelcome: { status: 'complete' }, fileSetup: { status: 'complete' }, welcome: { status: 'failed', attemptedAt: new Date(Date.now() - 86400000).toISOString() } } };
  let saved;
  const result = await mod.runClientOnboarding({ input: { clientId: 123, requestId: 'request' }, req: { payload: { findByID: async () => ({ ...client, onboardingState: state }), db: { updateOne: async args => { saved = args.data; } } } } });
  assert.equal(result.output.ok, false);
  assert.match(saved.onboardingStatus, /reconciliation/);
});

function emailApi(fetch) {
  return loadTs('src/pages/api/client-won.ts', { env: { ...env, RESEND_API_KEY: 'test-only' }, globals: { fetch }, mocks: { '../../lib/html': { escapeHtml: x => String(x) } } });
}
function stepRequest(step, overrides = {}) {
  return { request: new Request('https://site.invalid/api/client-won/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-quadem-secret': env.CMS_WEBHOOK_SECRET }, body: JSON.stringify({ event: 'client.onboarding.step', step, key: `onboarding/123/run/${step}`, attemptedAt: new Date().toISOString(), client: { id: '123', businessName: 'Fixture', contactName: 'Owner', email: 'owner@example.com', service: 'web-design', price: 2500 }, document: { documentId: 99 }, ...overrides }) }) };
}

test('document retries return the existing unique file and never upload a duplicate', async () => {
  let calls = 0;
  const api = emailApi(async () => { calls++; return Response.json({ docs: [{ id: 99, client: 123, filename: 'saved.docx' }] }); });
  const response = await api.POST(stepRequest('fileContract'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).documentId, 99);
  assert.equal(calls, 1);
});

test('email rejection reports failure and scheduling uses the raw API field and stable idempotency key', async () => {
  const sends = [];
  let status = 500;
  const api = emailApi(async (url, init) => {
    if (url.includes('/api/onboarding-documents/99')) return Response.json({ id: 99, client: 123, documentType: 'sla', origin: 'automation', filename: 'saved.docx' });
    if (url.includes('/api/onboarding-documents/file/')) return new Response('fixed file bytes');
    sends.push(init);
    return Response.json(status === 200 ? { id: 'provider-confirmation' } : { error: 'refused' }, { status });
  });
  const attemptedAt = new Date().toISOString();
  assert.equal((await api.POST(stepRequest('contract', { attemptedAt }))).status, 502);
  status = 200;
  const accepted = await api.POST(stepRequest('contract', { attemptedAt }));
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).providerId, 'provider-confirmation');
  assert.equal(sends[0].headers['Idempotency-Key'], sends[1].headers['Idempotency-Key']);
  assert.equal(sends[0].body, sends[1].body);
  assert.ok(JSON.parse(sends[0].body).scheduled_at);
  assert.equal(JSON.parse(sends[0].body).scheduledAt, undefined);
});

test('legacy all-at-once onboarding requests are rejected without sending', async () => {
  const api = emailApi(async () => { throw new Error('must not send'); });
  assert.equal((await api.POST(stepRequest('welcome', { event: 'client.won' }))).status, 409);
});
