import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadTs } from './helpers/load-ts.mjs';

// Several client portals open at once in one browser (lib/session.ts), and
// opening one from the team portal with a link the CMS signs (lib/portalOpen.ts).
const env = { PORTAL_SESSION_SECRET: 'a-portal-session-secret-for-tests', CMS_WEBHOOK_SECRET: 'a-shared-cms-secret-for-tests', PROD: true };
const session = loadTs('src/lib/session.ts', { env });
const { verifyPortalOpen } = loadTs('src/lib/portalOpen.ts', { env });
// Copied out of the sandbox the modules run in, so they compare as this realm's arrays.
const slugs = (value) => [...session.sessionSlugs(value)];

// A cookie jar standing in for Astro's.
const jar = (value) => {
  const store = { value, options: null };
  return { store, get: () => (store.value == null ? undefined : { value: store.value }), set: (_n, v, o) => { store.value = v; store.options = o; }, delete: () => { store.value = null; } };
};
const redirect = (to) => new Response(null, { status: 302, headers: { Location: to } });

test('a cookie from before holds one portal; a list holds several, and only signed ones count', () => {
  const kitchen = session.signSession('sample-kitchen');
  assert.deepEqual(slugs(kitchen), ['sample-kitchen']);
  const two = session.withSession(kitchen, 'kubaid-pharmacy');
  assert.deepEqual(slugs(two), ['kubaid-pharmacy', 'sample-kitchen']);
  // A slug added by hand, unsigned or wrongly signed, opens nothing.
  const forged = JSON.stringify([...JSON.parse(two), 'tannor-freight', 'omek.notasignature']);
  assert.deepEqual(slugs(forged), ['kubaid-pharmacy', 'sample-kitchen']);
  assert.deepEqual(slugs('not json and not signed'), []);
  assert.deepEqual(slugs(undefined), []);
});

test('signing in again moves a portal to the front, never twice, and keeps at most twenty', () => {
  let value = null;
  for (let i = 0; i < 25; i++) value = session.withSession(value, `client-${i}`);
  const kept = slugs(value);
  assert.equal(kept.length, 20);
  assert.equal(kept[0], 'client-24');
  value = session.withSession(value, 'client-10');
  assert.deepEqual(slugs(value).slice(0, 2), ['client-10', 'client-24']);
  assert.equal(session.sessionSlugs(value).filter((s) => s === 'client-10').length, 1);
});

test('signing out of one portal keeps the others; the last one empties the cookie', () => {
  const both = session.withSession(session.signSession('a'), 'b');
  assert.deepEqual(slugs(session.withoutSession(both, 'b')), ['a']);
  assert.equal(session.withoutSession(session.signSession('a'), 'a'), null);
});

test('without the session secret nothing is signed in', () => {
  const bare = loadTs('src/lib/session.ts', { env: {} });
  assert.equal(bare.withSession(null, 'a'), null);
  assert.equal(bare.sessionSlugs(session.signSession('a')).length, 0);
});

// The link exactly as cms/src/lib/clientDesk.ts portalLink signs it.
const cmsLink = (client, exp, secret = env.CMS_WEBHOOK_SECRET) => {
  const key = crypto.createHmac('sha256', secret).update('quadem:portal-open:v1').digest();
  return { client, exp: String(exp), sig: crypto.createHmac('sha256', key).update(`${client}:${exp}`).digest('base64url') };
};

test('a portal link opens only the client it was signed for, and only for two minutes', () => {
  const now = Date.now();
  const l = cmsLink('kubaid-pharmacy', now + 120_000);
  assert.equal(verifyPortalOpen(l.client, l.exp, l.sig, now), true);
  assert.equal(verifyPortalOpen('tannor-freight', l.exp, l.sig, now), false);
  assert.equal(verifyPortalOpen(l.client, String(now + 999_999), l.sig, now), false);
  assert.equal(verifyPortalOpen(l.client, l.exp, l.sig, now + 121_000), false);
  const other = cmsLink('kubaid-pharmacy', now + 120_000, 'some-other-secret-entirely');
  assert.equal(verifyPortalOpen(other.client, other.exp, other.sig, now), false);
  assert.equal(verifyPortalOpen(null, l.exp, l.sig, now), false);
});

test('opening from the team portal adds that portal to the ones already open', async () => {
  const { GET } = loadTs('src/pages/api/portal-open.ts', { env });
  const cookies = jar(session.signSession('sample-kitchen'));
  const l = cmsLink('kubaid-pharmacy', Date.now() + 120_000);
  const url = new URL(`https://quademdigital.com/api/portal-open/?client=${l.client}&exp=${l.exp}&sig=${l.sig}`);
  const res = await GET({ url, cookies, redirect });
  assert.equal(res.headers.get('Location'), '/portal/?client=kubaid-pharmacy');
  assert.deepEqual(slugs(cookies.store.value), ['kubaid-pharmacy', 'sample-kitchen']);
  assert.equal(cookies.store.options.httpOnly, true);

  // A bad link changes nothing and says nothing about why.
  const bad = jar(session.signSession('sample-kitchen'));
  const wrong = await GET({ url: new URL(`https://quademdigital.com/api/portal-open/?client=tannor-freight&exp=${l.exp}&sig=${l.sig}`), cookies: bad, redirect });
  assert.equal(wrong.headers.get('Location'), '/portal/');
  assert.deepEqual(slugs(bad.store.value), ['sample-kitchen']);
});

test('a code signs in to its portal beside the others, and says which to open', async () => {
  const { POST } = loadTs('src/pages/api/login.ts', {
    env,
    mocks: { '../../lib/payload': { payloadFetch: async (_c, q) => (q['where[accessCode][equals]'] === 'GoodCode1234' ? [{ slug: 'kubaid-pharmacy' }] : []) } },
  });
  const cookies = jar(session.signSession('sample-kitchen'));
  const request = new Request('https://quademdigital.com/api/login/', { method: 'POST', body: JSON.stringify({ accessCode: 'GoodCode1234' }) });
  const res = await POST({ request, cookies, clientAddress: '203.0.113.9' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { success: true, client: 'kubaid-pharmacy' });
  assert.deepEqual(slugs(cookies.store.value), ['kubaid-pharmacy', 'sample-kitchen']);
});

test('Log out on a portal signs out of that one; with none named, all of them', async () => {
  const { POST, GET } = loadTs('src/pages/api/logout.ts', { env });
  const cookies = jar(session.withSession(session.signSession('a'), 'b'));
  const form = new FormData();
  form.set('client', 'b');
  await POST({ request: new Request('https://quademdigital.com/api/logout/', { method: 'POST', body: form }), cookies, redirect });
  assert.deepEqual(slugs(cookies.store.value), ['a']);
  await GET({ cookies, redirect });
  assert.equal(cookies.store.value, null);
});
