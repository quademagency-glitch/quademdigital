/**
 * WHICH PRICES YOU SEE, AND IN WHAT MONEY.
 *
 * THE RULE. Set 4 September 2026. It is not negotiable and it is enforced by
 * scripts/check-markets.mjs, which fails the build if any page breaks it.
 *
 *   1. WHICH LIST.  A visitor in Africa is priced from the cedi list.
 *                   Everyone else is priced from the dollar list.
 *                   These are two different price lists, not one list at two
 *                   exchange rates: the homepage sells packages in Africa and
 *                   service lines everywhere else, with different names,
 *                   contents and counts.
 *
 *   2. WHICH MONEY. Whatever that visitor's own country spends. A Nigerian
 *                   sees the cedi list in naira. A Kenyan sees it in shillings.
 *                   A Ghanaian sees it in cedis, because cedis already are the
 *                   base. Someone in London sees the dollar list in pounds; in
 *                   New York, in dollars, for the same reason.
 *
 *   3. NEVER GUESS. If the country is unknown, or its currency has no rate
 *                   today, the visitor sees the base currency of their list
 *                   rather than a number invented from a stale rate. An
 *                   unconverted GH₵ 2,500 is honest. A wrong ₦ is not.
 *
 * WHY THE SERVER CANNOT DO ANY OF THIS
 *
 * src/middleware.ts edge-caches public pages for 60 seconds. Whatever country
 * the first visitor of that minute came from would be served to everyone else
 * for the rest of it. So every page ships BOTH lists, one carrying `hidden`,
 * and the browser reveals the right one after asking /api/geo/ (uncached, per
 * visitor) and converts the numbers with /api/rates/ (cached, identical for
 * everyone). International is the visible default, so the copy sitting in the
 * edge cache is the one a stranger should see and a failed lookup degrades to
 * dollars rather than showing cedis to someone who does not pay in them.
 *
 * WHY THIS FILE IS PLAIN JAVASCRIPT
 *
 * Three very different things import it and all three must agree, because the
 * moment they disagree somebody is quoted a price nobody set:
 *
 *   src/scripts/main.js      the browser, converting prices on the page
 *   src/pages/api/*.ts       the server, answering geo and rates
 *   scripts/check-markets.mjs  node, failing the build when a page breaks rule 1
 *   cms/src/lib/markets.js   the CMS, choosing an invoice currency (a copy,
 *                            kept in step by scripts/check-markets.mjs)
 *
 * A .ts file cannot be imported by the node guard without a build step, and a
 * second copy of the country table is exactly how the site and the invoices
 * would drift apart. One file, no build step, everybody reads it.
 */

/* ── The continent test ──────────────────────────────────────────────────────
   Every country on the continent plus the island states and territories that
   bank in an African currency. This map is the definition of "Africa" for
   pricing: a country in here is priced from the cedi list, and a country not in
   here is priced from the dollar list. There is no third case.

   Currencies are the ISO-4217 code actually spent on the ground, which is not
   always the country's own: the CFA franc zones share XOF and XAF, and Réunion
   and Mayotte spend euros while sitting in Africa. They still get the cedi
   list, because rule 1 is about where the buyer is, not what they carry. */
export const AFRICA = {
    DZ: 'DZD', AO: 'AOA', BJ: 'XOF', BW: 'BWP', BF: 'XOF', BI: 'BIF',
    CV: 'CVE', CM: 'XAF', CF: 'XAF', TD: 'XAF', KM: 'KMF', CG: 'XAF',
    CD: 'CDF', CI: 'XOF', DJ: 'DJF', EG: 'EGP', GQ: 'XAF', ER: 'ERN',
    SZ: 'SZL', ET: 'ETB', GA: 'XAF', GM: 'GMD', GH: 'GHS', GN: 'GNF',
    GW: 'XOF', KE: 'KES', LS: 'LSL', LR: 'LRD', LY: 'LYD', MG: 'MGA',
    MW: 'MWK', ML: 'XOF', MR: 'MRU', MU: 'MUR', YT: 'EUR', MA: 'MAD',
    MZ: 'MZN', NA: 'NAD', NE: 'XOF', NG: 'NGN', RE: 'EUR', RW: 'RWF',
    SH: 'SHP', ST: 'STN', SN: 'XOF', SC: 'SCR', SL: 'SLE', SO: 'SOS',
    ZA: 'ZAR', SS: 'SSP', SD: 'SDG', TZ: 'TZS', TG: 'XOF', TN: 'TND',
    UG: 'UGX', EH: 'MAD', ZM: 'ZMW', ZW: 'ZWG',
};

/* ── Everyone else ───────────────────────────────────────────────────────────
   Countries whose money we are willing to name. A country absent from here
   still gets the dollar list; it simply sees it in dollars, which is rule 3.
   Adding a row here is safe. Guessing at one is not. */
export const REST_OF_WORLD = {
    US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', CH: 'CHF',
    SE: 'SEK', NO: 'NOK', DK: 'DKK', IS: 'ISK', PL: 'PLN', CZ: 'CZK',
    HU: 'HUF', RO: 'RON', BG: 'BGN', RS: 'RSD', TR: 'TRY', UA: 'UAH',
    RU: 'RUB', GE: 'GEL', AM: 'AMD', AZ: 'AZN', KZ: 'KZT',
    IN: 'INR', PK: 'PKR', BD: 'BDT', LK: 'LKR', NP: 'NPR',
    CN: 'CNY', JP: 'JPY', KR: 'KRW', HK: 'HKD', TW: 'TWD', MO: 'MOP',
    SG: 'SGD', MY: 'MYR', TH: 'THB', VN: 'VND', ID: 'IDR', PH: 'PHP',
    AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR',
    JO: 'JOD', LB: 'LBP', IL: 'ILS', IQ: 'IQD', YE: 'YER',
    MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN',
    UY: 'UYU', PY: 'PYG', BO: 'BOB', CR: 'CRC', GT: 'GTQ', DO: 'DOP',
    JM: 'JMD', TT: 'TTD', BB: 'BBD', BS: 'BSD', PA: 'USD',
    FJ: 'FJD', PG: 'PGK',
    /* The euro, country by country, because the visitor header gives a country
       and never a currency union. */
    AT: 'EUR', BE: 'EUR', CY: 'EUR', DE: 'EUR', EE: 'EUR', ES: 'EUR',
    FI: 'EUR', FR: 'EUR', GR: 'EUR', HR: 'EUR', IE: 'EUR', IT: 'EUR',
    LT: 'EUR', LU: 'EUR', LV: 'EUR', MC: 'EUR', MT: 'EUR', NL: 'EUR',
    PT: 'EUR', SI: 'EUR', SK: 'EUR', AD: 'EUR', SM: 'EUR', VA: 'EUR',
    ME: 'EUR', XK: 'EUR',
};

/** The currency each price list is written in. Everything else is converted. */
export const BASE_CURRENCY = { africa: 'GHS', international: 'USD' };

/*
  What the CMS calls the cedi list.

  The Pricing Plans collection stored `market: 'ghana'` before this list was
  shown across the continent, and renaming the stored value would need a
  migration and would orphan every plan an editor has already filed. So the
  database says 'ghana', the page says 'africa', and the translation happens in
  exactly one place: here, read by src/components/home/PricingSection.astro.

  scripts/check-markets.mjs bans the string 'ghana' as a market anywhere else,
  which is what stops this becoming two names for one thing again.
*/
export const CMS_AFRICA_MARKET = 'ghana';

/**
 * The card fee folded into a converted price.
 *
 * A cross-border card payment is not free and the difference has always come
 * out of the job. Paystack charges 3.9% on an international card, so a price
 * converted into a currency we do not hold carries it, and the two base
 * currencies do not: a Ghanaian paying cedis into a cedi account and an
 * American paying dollars into a dollar account are both already local.
 *
 * Change this in one place and every converted price on the site moves with it.
 */
export const CARD_FEE = 0.039;

/* ── How each currency is written ────────────────────────────────────────────
   Only the ones that need a symbol or a decimal rule of their own. Anything
   absent is written as "CODE 1,234", which is unambiguous and never wrong. The
   zero-decimal list is the point of this table: ₦4,180,000.00 is not a price,
   it is a bank statement. */
const SYMBOL = {
    GHS: 'GH₵ ', USD: '$', EUR: '€', GBP: '£', NGN: '₦', ZAR: 'R ',
    KES: 'KSh ', UGX: 'USh ', TZS: 'TSh ', RWF: 'FRw ', ETB: 'Br ',
    EGP: 'E£', MAD: 'MAD ', XOF: 'CFA ', XAF: 'FCFA ', ZMW: 'ZK ',
    BWP: 'P ', MUR: 'Rs ', NAD: 'N$', INR: '₹', JPY: '¥', CNY: '¥',
    KRW: '₩', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$', CHF: 'CHF ',
    BRL: 'R$', MXN: 'MX$', PHP: '₱', THB: '฿', VND: '₫', TRY: '₺',
    ILS: '₪', AED: 'AED ', SAR: 'SAR ', SGD: 'S$', HKD: 'HK$',
};

/** Currencies with no minor unit, where a decimal point is simply wrong. */
const ZERO_DECIMAL = new Set([
    'NGN', 'UGX', 'TZS', 'RWF', 'XOF', 'XAF', 'GNF', 'MGA', 'BIF', 'KMF',
    'DJF', 'VUV', 'CLP', 'PYG', 'JPY', 'KRW', 'VND', 'IDR', 'LAK', 'MMK',
    'IQD', 'LBP', 'SOS', 'SDG', 'SSP', 'UZS', 'KHR', 'COP', 'ISK', 'HUF',
]);

/** Which market a country buys in. Unknown country falls to international. */
export function marketFor(country) {
    const cc = String(country || '').toUpperCase();
    return Object.prototype.hasOwnProperty.call(AFRICA, cc) ? 'africa' : 'international';
}

/**
 * What money that country spends, or the base currency of its list when we do
 * not know. Never returns an empty string: something always has to be printed.
 */
export function currencyFor(country) {
    const cc = String(country || '').toUpperCase();
    if (AFRICA[cc]) return AFRICA[cc];
    if (REST_OF_WORLD[cc]) return REST_OF_WORLD[cc];
    return BASE_CURRENCY[marketFor(cc)];
}

/**
 * Round a converted figure to something that reads as a price.
 *
 * A raw conversion produces ₦4,178,342, which tells the reader the exact hour
 * the rate was pulled and reads as a machine's output rather than a price
 * somebody set. Rounding UP to a step scaled to the size of the number gives
 * ₦4,180,000 and never quotes under the cedi or dollar it came from.
 */
export function roundForDisplay(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const step =
        amount < 100 ? 5 :
        amount < 1_000 ? 50 :
        amount < 10_000 ? 100 :
        amount < 100_000 ? 1_000 :
        amount < 1_000_000 ? 10_000 :
        amount < 10_000_000 ? 100_000 : 1_000_000;
    return Math.ceil(amount / step) * step;
}

/**
 * Convert one price and write it out.
 *
 * `rates` is the table from /api/rates/, keyed by currency against USD.
 * Returns null when it cannot be done honestly, and every caller treats null as
 * "leave the base price on the page" rather than as an error. That is rule 3,
 * and it is the whole reason this returns null instead of throwing or guessing.
 */
export function convert(amount, fromCurrency, toCurrency, rates) {
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const from = String(fromCurrency || '').toUpperCase();
    const to = String(toCurrency || '').toUpperCase();
    if (!from || !to) return null;
    if (from === to) return roundForDisplay(amount);

    const rFrom = from === 'USD' ? 1 : Number(rates?.[from]);
    const rTo = to === 'USD' ? 1 : Number(rates?.[to]);
    if (!Number.isFinite(rFrom) || !Number.isFinite(rTo) || rFrom <= 0 || rTo <= 0) return null;

    /* Both legs go through USD because that is the base the rate table is
       published in. Doing it in one step would need a GHS->NGN pair nobody
       quotes. The card fee lands here, on the converted leg only. */
    const inUsd = amount / rFrom;
    return roundForDisplay(inUsd * rTo * (1 + CARD_FEE));
}

/** "GH₵ 2,500", "₦ 4,180,000", "SEK 32,000". */
export function formatMoney(amount, currency) {
    const code = String(currency || '').toUpperCase();
    const decimals = ZERO_DECIMAL.has(code) ? 0 : (amount % 1 === 0 ? 0 : 2);
    const digits = amount.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
    const symbol = SYMBOL[code];
    return symbol ? `${symbol}${digits}` : `${code} ${digits}`;
}

/*
  What Paystack can actually take money in.

  Everything else has to be billed in one of the two base currencies, so a
  Ugandan client is quoted in shillings on the site and invoiced in cedis, and
  the note under the price grid says exactly that rather than leaving them to
  find out when the invoice arrives.
*/
export const PAYSTACK_CURRENCIES = new Set(['GHS', 'NGN', 'ZAR', 'KES', 'USD']);

/**
 * The currency an invoice to this country will actually be raised in.
 *
 * Used in two places that must never disagree: the note under every price grid
 * on the site, which promises the client what the invoice will say, and the
 * Invoices collection in the CMS, which decides what it says. They import the
 * same function for that reason.
 */
export function invoiceCurrencyFor(country) {
    const local = currencyFor(country);
    if (PAYSTACK_CURRENCIES.has(local)) return local;
    return BASE_CURRENCY[marketFor(country)];
}

/**
 * The line under a price grid saying what money this is.
 *
 * Revealed by the browser, never server-rendered, for the edge-cache reason at
 * the top of this file. Names the currency rather than the country, because
 * "All prices in Nigerian naira" is what the reader needs to check against
 * their own bank, and says plainly when a figure has been converted so nobody
 * is surprised by a cedi invoice later.
 */
export function currencyNote(currency, market, invoiceCurrency) {
    const code = String(currency || '').toUpperCase();
    const base = String(invoiceCurrency || BASE_CURRENCY[market] || 'USD').toUpperCase();
    const NAME = {
        GHS: 'Ghana cedis', USD: 'US dollars', EUR: 'euros', GBP: 'pounds',
        NGN: 'Nigerian naira', ZAR: 'South African rand', KES: 'Kenyan shillings',
        UGX: 'Ugandan shillings', TZS: 'Tanzanian shillings', RWF: 'Rwandan francs',
        EGP: 'Egyptian pounds', MAD: 'Moroccan dirhams', XOF: 'CFA francs',
        XAF: 'CFA francs', ZMW: 'Zambian kwacha', ETB: 'Ethiopian birr',
        CAD: 'Canadian dollars', AUD: 'Australian dollars', INR: 'Indian rupees',
    };
    const name = NAME[code] || code;
    if (code === base) return `All prices in ${name}.`;
    const baseName = NAME[base] || base;
    return `All prices in ${name}, at today's rate. Invoiced in ${baseName}.`;
}

/**
 * Read a price the CMS wrote and pull the number out of it.
 *
 * The CMS holds display strings, and an editor is allowed to type "from
 * $3,000", "GH₵ 2,500", "Custom" or "$1,250". Conversion needs the number, the
 * word in front of it, and nothing else. "Custom" and anything else with no
 * digits comes back as text with no amount, which is how a Custom tier survives
 * every conversion on the site untouched.
 */
export function parsePrice(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return { text: '', prefix: '', amount: null };
    const m = text.match(/^(.*?)(?:GH₵|GHS|US\$|\$|₦|R|€|£)?\s*([\d][\d,\s]*(?:\.\d+)?)\s*$/);
    if (!m) return { text, prefix: '', amount: null };
    const amount = Number(m[2].replace(/[,\s]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) return { text, prefix: '', amount: null };
    /* "from " survives, the currency symbol does not: the symbol is about to be
       replaced and the qualifier is the copy's own. */
    const prefix = m[1].replace(/(?:GH₵|GHS|US\$|\$|₦|€|£)\s*$/, '').trim();
    return { text, prefix, amount };
}
