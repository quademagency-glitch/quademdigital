import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTs } from './helpers/load-ts.mjs';

// The home page prices section (src/lib/homeD/prices.ts) and the bundle rule
// in the CMS (cms/src/lib/pricingRules.ts), after "WhatsApp assistant" became
// "AI automation" on 24 October 2026.

const prices = loadTs('src/lib/homeD/prices.ts');
// Values made inside the loader's sandbox have its own Array and Object, so
// compare them as plain data.
const plain = (value) => JSON.parse(JSON.stringify(value));
class APIError extends Error {}
const rules = loadTs('cms/src/lib/pricingRules.ts', {
  mocks: { payload: { APIError }, '../access/roles': { hasRole: () => true }, './audit': { audit: async () => {} } },
});

const intlAi = {
  id: 55, name: 'AI automation', market: 'international', kind: 'bundle', priceUSD: 3000, billingCycle: '',
  addOns: [
    { label: 'Automation system, up to 3 connected workflows', amount: 6500, cadence: 'once' },
    { label: 'Monthly care', amount: 350, cadence: 'monthly' },
    { label: 'Monthly care for a system', amount: 650, cadence: 'monthly' },
  ],
};
const africaAi = { ...intlAi, id: 50, market: 'ghana', priceUSD: null, priceGHS: 3500, addOns: [
  { label: 'Automation system, up to 3 connected workflows', amount: 7500, cadence: 'once' },
  { label: 'Monthly care', amount: 600, cadence: 'monthly' },
  { label: 'Monthly care for a system', amount: 900, cadence: 'monthly' },
] };

test('the AI automation card prices its extra lines from its own list, so each converts like the main price', () => {
  assert.deepEqual(
    plain(prices.planAddOns(intlAi, 'international').map(({ label, base, amount, text, monthly }) => [label, base, amount, text, monthly])),
    [
      ['Automation system, up to 3 connected workflows', 'USD', 6500, '$6,500', false],
      ['Monthly care', 'USD', 350, '$350', true],
      ['Monthly care for a system', 'USD', 650, '$650', true],
    ],
  );
  assert.deepEqual(
    plain(prices.planAddOns(africaAi, 'africa').map(({ base, amount, text, monthly }) => [base, amount, text, monthly])),
    [['GHS', 7500, 'GH₵ 7,500', false], ['GHS', 600, 'GH₵ 600', true], ['GHS', 900, 'GH₵ 900', true]],
  );
  assert.deepEqual(plain(prices.planPrice(africaAi, 'africa')), { base: 'GHS', amount: 3500, text: 'GH₵ 3,500', monthly: false });
  assert.deepEqual(plain(prices.planPrice(intlAi, 'international')), { base: 'USD', amount: 3000, text: '$3,000', monthly: false });
});

test('an extra price with no label or no number is left off, and a plan without them shows none', () => {
  const plan = { ...intlAi, addOns: [{ label: '', amount: 10, cadence: 'once' }, { label: 'Free', amount: 0 }, { label: 'Typed', amount: '$6,500' }, null] };
  assert.equal(prices.planAddOns(plan, 'international').length, 0);
  assert.equal(prices.planAddOns({ name: 'Get seen' }, 'international').length, 0);
});

test('an africa plan is never priced from dollars, and both lists ship with international visible', () => {
  assert.equal(prices.planAmount({ priceUSD: 3000, priceGHS: null, price: 'GH₵3,500' }, 'africa'), null);
  const groups = prices.priceGroups([
    { name: 'One-page website', market: 'international', priceUSD: 3000, order: 1 },
    { name: 'Get seen', market: 'international', priceUSD: 1750, billingCycle: '/mo', order: 4 },
    { name: 'One-page website', market: 'ghana', priceGHS: 2500, order: 1 },
    { name: 'Old package', market: 'ghana', kind: 'package', priceGHS: 1 },
    { name: 'Switched off', market: 'ghana', active: false, priceGHS: 1 },
  ]);
  assert.deepEqual(plain(groups.map((g) => [g.market, g.hidden, g.rows.map((r) => [r.key, r.plans.map((p) => p.name)])])), [
    ['international', false, [['oneOff', ['One-page website']], ['monthly', ['Get seen']]]],
    ['africa', true, [['oneOff', ['One-page website']]]],
  ]);
  assert.equal(prices.priceGroups([])[0].rows.length, 2, 'with no plans at all, the international fallback still renders');
});

test('the section words fall back to the approved ones and never take an outside link', () => {
  const words = prices.loadPrices({ dPrices: { headline: '  ', free: { link: 'https://evil.example/' }, band: { items: [{ text: '' }] } } });
  assert.equal(words.headline, 'Clear scope. [Clear pricing.]');
  assert.equal(words.free.link, '/offers/free-seo-audit/');
  assert.equal(words.band.items.length, 3);
  assert.equal(prices.loadPrices({ dPrices: { oneOff: { label: 'Built once' } } }).oneOff.label, 'Built once');
});

test('"AI automation" is the protected bundle name, in both markets', () => {
  for (const market of ['ghana', 'international']) {
    const ai = { name: 'AI automation', market, kind: 'bundle' };
    assert.match(rules.protectedChange(ai, { name: 'WhatsApp assistant' }), /keeps its name/);
    assert.match(rules.protectedChange(ai, { kind: 'package' }), /stays a bundle/);
    assert.equal(rules.protectedChange(ai, { name: 'AI automation', priceGHS: 3500 }), null);
  }
});

test('the live "WhatsApp assistant" bundles can be renamed to "AI automation" and to nothing else', () => {
  const old = { name: 'WhatsApp assistant', market: 'ghana', kind: 'bundle' };
  assert.equal(rules.protectedChange(old, { name: 'AI automation' }), null);
  assert.match(rules.protectedChange(old, { name: 'AI assistant' }), /renamed “AI automation”/);
  assert.match(rules.protectedChange(old, { market: 'international' }), /stays in its market/);
  assert.equal(rules.protectedChange({ ...old, kind: 'package' }, { name: 'Anything' }), null, 'the price list package of the same name is not a bundle');
  const before = { ...old, price: 'GH₵3,000', priceGHS: 3000, billingCycle: '' };
  assert.equal(rules.planEdit(before, { name: 'AI automation' }).changes?.name, 'AI automation');
  assert.match(rules.planEdit(before, { name: 'WhatsApp bot' }).error, /no other/);
});

test('the price check finds the AI automation card under either name until the rename has run', () => {
  const audit = readFileSync(new URL('../scripts/pricing-audit.mjs', import.meta.url), 'utf8');
  assert.match(audit, /bundle\('AI automation', m, \[\['WhatsApp assistant', 'services\/ai-automation'\]\], 10, 5, \['WhatsApp assistant'\]\)/);
  assert.match(audit, /spec\.was\.includes\(p\.name\)/);
  assert.deepEqual(plain(Object.entries(rules.BUNDLE_RENAMES)), [['WhatsApp assistant', 'AI automation']]);
});
