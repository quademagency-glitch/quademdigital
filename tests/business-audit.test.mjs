import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { billingCadence, billingKicker } from '../src/lib/billing.js';
import { recordLeadSuccess } from '../src/scripts/leadTracking.js';

// Run the actual browser handlers with a small DOM double. No requests leave
// this process and no test enquiry is written to the real CMS.
function browserHarness({ form = null, fetch = async () => ({ ok: true }) } = {}) {
    const listeners = {};
    const events = [];
    const frame = { contentWindow: {} };
    const button = { textContent: 'Send', style: {}, disabled: false };
    const window = {
        location: { pathname: '/contact/' },
        addEventListener: (name, fn) => { listeners[name] = fn; },
        gtag: (_kind, name, data) => events.push({ name, data }),
    };
    const document = {
        readyState: 'loading', addEventListener() {},
        querySelector: () => frame,
        getElementById: (id) => id === 'contactForm' ? form : id === 'contactSubmitBtn' ? button : null,
    };
    const source = readFileSync(new URL('../src/scripts/main.js', import.meta.url), 'utf8')
        .replace(/^import .*;$/gm, '').replaceAll('import.meta.env.DEV', 'false');
    const context = vm.createContext({ window, document, fetch, Event, recordLeadSuccess,
        console: { error() {} },
        FormData: class {
            get(key) { return key === 'source' ? 'contact-form' : null; }
            getAll() { return []; }
            entries() { return []; }
        },
    });
    vm.runInContext(source, context);
    return { listeners, events, frame, window, button, context };
}

test('CMS monthly and annual spellings keep their actual payment frequency', () => {
    for (const cycle of ['/mo', 'mo', 'month', 'monthly', 'per month', 'a month', ' /MO ']) {
        assert.equal(billingCadence(cycle), 'a month', cycle);
        assert.equal(billingKicker(cycle), 'Monthly', cycle);
    }
    for (const cycle of ['/yr', 'year', 'yearly', 'annual']) {
        assert.equal(billingCadence(cycle), 'a year', cycle);
    }
});

test('one-off and unrecognised cycles never silently become subscriptions', () => {
    for (const cycle of [undefined, null, '', 'one off', 'one-off · 3 reels', 'per project', 'starting at']) {
        assert.equal(billingCadence(cycle), 'one off', String(cycle));
    }
    assert.equal(billingCadence('per quarter'), 'per quarter');
    assert.equal(billingKicker('per quarter'), '');
});

test('one wizard capture followed by completion creates one lead conversion', () => {
    const state = {};
    const events = [];
    const track = (name, data) => events.push({ name, data });
    recordLeadSuccess(state, track, { source: 'contact-form' }, { partial: true });
    assert.deepEqual(events.map((event) => event.name), ['generate_lead']);
    recordLeadSuccess(state, track, { source: 'contact-form', budget: 'range' }, { wizard: true });
    assert.deepEqual(events.map((event) => event.name), ['generate_lead', 'enquiry_completed', 'wizard_completed']);
    assert.equal(events[0].data.stage, 'partial');
});

test('revisited early steps do not count another lead', () => {
    const state = {};
    const events = [];
    for (let i = 0; i < 3; i++) recordLeadSuccess(state, (name) => events.push(name), {}, { partial: true });
    assert.deepEqual(events, ['generate_lead']);
});

test('completion after failed early capture still records one new lead', () => {
    const events = [];
    recordLeadSuccess({}, (name, data) => events.push({ name, data }), {}, { wizard: true });
    assert.deepEqual(events.map((event) => event.name), ['generate_lead', 'enquiry_completed', 'wizard_completed']);
    assert.equal(events[0].data.stage, 'complete');
});

test('ordinary forms do not emit wizard completion and a new enquiry can be counted', () => {
    const state = {};
    const events = [];
    recordLeadSuccess(state, (name) => events.push(name), {});
    delete state.leadTracked;
    recordLeadSuccess(state, (name) => events.push(name), {});
    assert.deepEqual(events, ['generate_lead', 'enquiry_completed', 'generate_lead', 'enquiry_completed']);
});

test('only the real Calendly iframe can confirm a call, once, without sending invitee details', () => {
    const h = browserHarness();
    const data = { event: 'calendly.event_scheduled', payload: { invitee: { uri: 'private-booking-id' } } };
    const message = { origin: 'https://calendly.com', source: h.frame.contentWindow, data };
    h.listeners.message({ ...message, origin: 'https://other.example' });
    h.listeners.message({ ...message, source: {} });
    h.listeners.message({ ...message, data: { event: 'calendly.date_and_time_selected' } });
    assert.equal(h.events.length, 0);
    h.listeners.message(message);
    h.listeners.message(message);
    assert.deepEqual(h.events.map(({ name }) => name), ['call_booked']);
    assert.ok(!JSON.stringify(h.events).includes('private-booking-id'));
});

test('analytics vendor failures cannot interrupt an enquiry', () => {
    const h = browserHarness();
    h.window.va = h.window.gtag = () => { throw new Error('analytics blocked'); };
    assert.doesNotThrow(() => h.window.trackEvent('generate_lead', {}));
});

test('failed submissions preserve the captured lead and do not count completion; retry enriches it', async () => {
    let submit;
    let ok = false;
    let requests = 0;
    const form = {
        dataset: { leadId: '123', leadToken: 'signed-fixture', leadTracked: 'true' },
        classList: { contains: () => true }, querySelector: () => null,
        getAttribute: () => '/api/submit-form/',
        addEventListener: (_name, fn) => { submit = fn; },
        reset() {}, dispatchEvent() {},
    };
    const h = browserHarness({ form, fetch: async (_url, options) => {
        requests++;
        assert.equal(JSON.parse(options.body).leadId, '123');
        assert.equal(JSON.parse(options.body).leadToken, 'signed-fixture');
        return { ok };
    } });
    vm.runInContext('initContactForm()', h.context);
    await submit({ preventDefault() {} });
    assert.deepEqual(h.events.map(({ name }) => name), ['enquiry_failed']);
    assert.equal(form.dataset.leadId, '123');
    assert.equal(form.dataset.leadToken, 'signed-fixture');
    assert.equal(h.button.disabled, false);
    ok = true;
    const first = submit({ preventDefault() {} });
    await submit({ preventDefault() {} });
    await first;
    assert.equal(requests, 2);
    assert.deepEqual(h.events.map(({ name }) => name), ['enquiry_failed', 'enquiry_completed', 'wizard_completed']);
    assert.equal(form.dataset.leadId, undefined);
    assert.equal(form.dataset.leadToken, undefined);
    assert.equal(form.dataset.leadTracked, undefined);
    assert.equal(h.button.disabled, false);
});
