/*
  THE PRICE ENGINE.

  Split out of main.js on 4 September 2026 because /global/ needs it and does
  not use main.js: GlobalLayout.astro is a standalone landing page with its own
  stylesheet and its own scripts, and it imported none of the site's shared
  JavaScript. The result was that /global/ quoted three dollar prices which
  never switched market and never converted, on the one page whose own opening
  paragraph explains that Africa is priced differently.

  Anything that needs prices imports this. Nothing else in here touches the
  navbar, the carousel or the forms, so a page can take the pricing without
  taking the rest of the site's behaviour with it.
*/
import * as Q_MARKETS from '../lib/markets.js';

//
// Was: a client call to ipapi.co (free tier ~1k/day) that returned early on any
// non-OK response, so once the quota was hit every Ghanaian visitor silently
// saw dollar prices; followed by a SECOND third-party call to an FX API, so the
// price visibly changed twice while the buyer was reading it. The cedi rate was
// also pinned at 11.49 in the source and went stale on its own.
//
// Now: two same-origin calls. /api/geo/ says which list and which money, and
// /api/rates/ (edge-cached twelve hours, identical for everyone) supplies the
// conversion. The rule both of them answer to is written once, in
// src/lib/markets.js, and enforced by scripts/check-markets.mjs.
/*
  23. /offers is the Ghana path, and only the Ghana path.

  The discounts there read as value to a buyer in Accra and as risk to one in
  London or Dallas, which is the reason /global exists at all. Rather than
  deleting them, links into /offers are marked data-ghana-only in BaseLayout and
  removed here for a visitor outside Ghana.

  Removed after the lookup rather than hidden before it, because public pages are
  edge-cached for 60 seconds: HTML that varies by country would be cached and
  served to the wrong one. Ghana is the main site's primary audience, so that is
  the reading that never flickers.

  Fails open to showing them, which is the safe direction: a Ghanaian visitor
  with a blocked geo call still sees the offers they are meant to see.
*/
async function initGhanaOnlyLinks() {
    const marked = document.querySelectorAll('[data-ghana-only]');
    if (marked.length === 0) return;

    let country = '';
    try {
        const res = await fetch('/api/geo/', { headers: { Accept: 'application/json' } });
        if (res.ok) country = (await res.json()).country || '';
    } catch (err) {
        return;
    }
    if (!country || country === 'GH') return;

    marked.forEach((el) => el.remove());
}

/*
  24. The price engine.

  Three steps, in this order, and the order is the whole design:

    1. Ask who is asking. /api/geo/ returns the market and the currency, both
       already resolved from src/lib/markets.js, so this file never decides
       which countries are African.
    2. Reveal that market's price list and hide the other one. Both are in the
       HTML because the page is edge-cached and the server cannot choose.
    3. Convert every number on the revealed list into the visitor's own money.

  Step 3 is allowed to fail. Steps 1 and 2 are not allowed to be skipped, and
  scripts/check-markets.mjs fails the build if a page carrying a price does not
  take part. When conversion cannot be done honestly the base price stays on the
  page: an unconverted GH₵ 2,500 is a true statement, a naira figure worked out
  from a rate we could not fetch is not.
*/
async function initDynamicPricing() {
    /*
      Every way a price reaches the page. A page with none of these does not
      need the country and must not pay for the lookup.

      [data-price]      a price card, from PricingCards or the homepage carousel
      [data-market]     a list, a budget ladder or a Ghana-only block to reveal
      #calcTotal        the homepage calculator
      #servicesList     the calculator page
    */
    const priceEls = document.querySelectorAll('[data-price]');
    const marketBlocks = document.querySelectorAll('[data-market]');
    const hasCalc = document.getElementById('calcTotal') || document.getElementById('servicesList');
    if (!priceEls.length && !marketBlocks.length && !hasCalc) return;

    /*
      What every other piece of pricing code on the page reads, and what it
      holds before the network answers: the international list, in dollars,
      unconverted. That is the same thing the edge cache is holding, so nothing
      moves on the screen unless the visitor is actually somewhere else.
    */
    window.pricingConfig = {
        country: '',
        market: 'international',
        currency: 'USD',
        base: 'USD',
        rates: null,
        ratesSource: 'none',
        format: (value) => Q_MARKETS.formatMoney(value, 'USD'),
        /* Convert an amount held in a market's base currency into what this
           visitor spends. Returns null when it cannot be done, and every caller
           treats null as "leave the base figure alone". */
        convert: () => null,
    };

    const done = () => window.dispatchEvent(new Event('pricingReady'));

    /* ── 1. Who is asking ────────────────────────────────────────────────── */
    let country = '';
    let market = 'international';
    let currency = 'USD';
    try {
        const res = await fetch('/api/geo/', { headers: { Accept: 'application/json' } });
        if (res.ok) {
            const geo = await res.json();
            country = geo.country || '';
            /* Trusted only when it is one of the two values that exist. A
               malformed answer falls back to international, which is the copy
               already on the screen. */
            market = geo.market === 'africa' ? 'africa' : 'international';
            currency = String(geo.currency || '').toUpperCase() || Q_MARKETS.BASE_CURRENCY[market];
        }
    } catch (err) {
        console.error('Geo lookup failed; showing international prices in USD.', err);
    }

    const base = Q_MARKETS.BASE_CURRENCY[market];

    /* ── 2. Reveal that market's list ────────────────────────────────────────
       Hides every block belonging to the other market and shows every block
       belonging to this one. If the page has no block for this market it
       changes nothing, rather than hiding the only list on the page and showing
       a stranger an empty pricing section. */
    const showMarket = (which) => {
        if (!document.querySelector(`[data-market="${which}"]`)) return;
        document.querySelectorAll('[data-market]').forEach((el) => {
            if (el.getAttribute('data-market') === which) el.removeAttribute('hidden');
            else el.setAttribute('hidden', '');
        });
    };
    showMarket(market);

    /* ── 3. Convert ──────────────────────────────────────────────────────────
       Only when there is something to convert. A Ghanaian reading the cedi list
       and an American reading the dollar list are both already in the base
       currency, so neither pays for a rates request. */
    let rates = null;
    let ratesSource = 'none';
    if (currency !== base) {
        try {
            const res = await fetch('/api/rates/', { headers: { Accept: 'application/json' } });
            if (res.ok) {
                const body = await res.json();
                rates = body.rates || null;
                ratesSource = body.source || 'unknown';
            }
        } catch (err) {
            console.error('Rate lookup failed; showing prices in the base currency.', err);
        }
        /* No usable rate for this particular currency is the same as no rates
           at all: fall back to the base rather than print a wrong number. */
        if (rates && !Number.isFinite(Number(rates[currency]))) {
            console.warn(`No rate published for ${currency}; showing ${base}.`);
            rates = null;
        }
        if (!rates) currency = base;
    }

    const convert = (amount, from) => Q_MARKETS.convert(amount, from || base, currency, rates);

    window.pricingConfig = {
        country,
        market,
        currency,
        base,
        rates,
        ratesSource,
        format: (value) => Q_MARKETS.formatMoney(value, currency),
        convert,
    };

    /*
      Rewrite every price on the revealed list.

      The amount and the qualifier are separate attributes rather than a string
      to be re-parsed, because "from $3,000" has to become "from ₦ 4,180,000"
      and the word "from" is the copy's, not the currency's. A card with no
      data-amount (a Custom tier) is skipped entirely and keeps whatever the CMS
      said.
    */
    document.querySelectorAll('[data-price]').forEach((el) => {
        const amount = Number(el.getAttribute('data-amount'));
        if (!Number.isFinite(amount) || amount <= 0) return;
        const from = (el.getAttribute('data-base') || base).toUpperCase();
        const prefix = el.getAttribute('data-prefix') || '';
        /* An element on the list we are NOT showing is left alone. It is hidden
           anyway, and converting it would spend work on something nobody sees. */
        const owner = el.closest('[data-market]');
        if (owner && owner.getAttribute('data-market') !== market) return;

        const value = currency === from ? amount : convert(amount, from);
        if (value === null) return;
        el.textContent = `${prefix ? prefix + ' ' : ''}${Q_MARKETS.formatMoney(value, currency)}`;
    });

    /*
      Say what money this is, once it is known.

      Never server-rendered, for the edge-cache reason at the top of
      src/lib/markets.js. When a price has been converted the note says so and
      names the currency the invoice will arrive in, so nobody agrees to a naira
      figure and is surprised by a cedi invoice a week later.
    */
    /* The third argument is what the INVOICE will say, which is not always the
       currency on screen: Paystack cannot take Ugandan shillings, so a visitor
       in Kampala is quoted in shillings and told, here, that the invoice comes
       in cedis. The CMS raises that invoice from the same function. */
    const note = Q_MARKETS.currencyNote(currency, market, Q_MARKETS.invoiceCurrencyFor(country));
    document.querySelectorAll('[data-currency-note]').forEach((el) => {
        el.textContent = note;
        el.removeAttribute('hidden');
    });

    done();
}

/**
 * Everything a page needs to price itself. Safe to call on a page with no
 * prices on it: both halves return immediately when there is nothing to do.
 */
export function initPricing() {
    initDynamicPricing();
    initGhanaOnlyLinks();
}
