import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePricingLocation } from '../src/lib/pricingLocation.js';
import { AFRICA, BASE_CURRENCY, convert } from '../src/lib/markets.js';

test('Ghana edge detection selects the cedi list without an exchange rate', () => {
    for (const header of ['x-vercel-ip-country', 'cf-ipcountry']) {
        assert.deepEqual(resolvePricingLocation(new Headers({ [header]: 'GH' })), {
            country: 'GH', market: 'africa', currency: 'GHS', source: 'detected',
        });
    }
});

test('headerless Ghana development preview does not change the production fallback', () => {
    const headers = new Headers();
    assert.equal(resolvePricingLocation(headers, { developmentCountry: 'GH' }).currency, 'GHS');
    assert.deepEqual(resolvePricingLocation(headers), {
        country: '', market: 'international', currency: 'USD', source: 'unknown',
    });
});

test('real country headers take precedence over the local preview default', () => {
    assert.equal(resolvePricingLocation(new Headers({ 'x-vercel-ip-country': 'US' }), { developmentCountry: 'GH' }).country, 'US');
});

test('retired country selections cannot override automatic pricing', () => {
    const headers = new Headers({ 'x-vercel-ip-country': 'US' });
    assert.deepEqual(resolvePricingLocation(headers, { selection: 'gh' }), {
        country: 'US', market: 'international', currency: 'USD', source: 'detected',
    });
    assert.equal(resolvePricingLocation(new Headers(), { selection: 'GH' }).currency, 'USD');
});

test('invalid choices and unknown proxy codes cannot corrupt a valid country', () => {
    const headers = new Headers({ 'x-vercel-ip-country': 'XX', 'cf-ipcountry': 'GH' });
    assert.equal(resolvePricingLocation(headers, { selection: '<script>' }).country, 'GH');
    assert.equal(resolvePricingLocation(new Headers(), { selection: 'constructor' }).country, '');
});

test('every African country uses the independent GHS list and its local currency', () => {
    for (const [country, currency] of Object.entries(AFRICA)) {
        const location = resolvePricingLocation(new Headers({ 'x-vercel-ip-country': country }));
        assert.equal(location.market, 'africa', country);
        assert.equal(BASE_CURRENCY[location.market], 'GHS', country);
        assert.equal(location.currency, currency, country);
    }
});

test('other continents use the independent USD list and their local currency', () => {
    for (const [country, currency] of Object.entries({ US: 'USD', GB: 'GBP', DE: 'EUR', IN: 'INR', BR: 'BRL', AU: 'AUD' })) {
        const location = resolvePricingLocation(new Headers({ 'cf-ipcountry': country }));
        assert.equal(location.market, 'international', country);
        assert.equal(BASE_CURRENCY[location.market], 'USD', country);
        assert.equal(location.currency, currency, country);
    }
});

test('local conversion uses the selected list, even for euros in Africa', () => {
    // Deliberately different price lists and synthetic rates, not market quotes.
    const amounts = { GHS: 2500, USD: 3000 };
    const rates = { GHS: 10, NGN: 1500, EUR: 0.9 };
    const priceFor = country => {
        const location = resolvePricingLocation(new Headers({ 'cf-ipcountry': country }));
        const base = BASE_CURRENCY[location.market];
        return convert(amounts[base], base, location.currency, rates);
    };
    assert.equal(priceFor('GH'), 2500);
    assert.equal(priceFor('US'), 3000);
    assert.equal(priceFor('NG'), 390000);
    assert.equal(priceFor('RE'), 250);
    assert.equal(priceFor('FR'), 2900);
});
