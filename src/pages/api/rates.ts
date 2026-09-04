import type { APIRoute } from 'astro';

/**
 * Today's exchange rates, against the US dollar.
 *
 * WHY THE SERVER FETCHES THIS AND NOT THE BROWSER
 *
 * vercel.json's Content-Security-Policy allows `connect-src` to 'self' and a
 * short list of named hosts. A rate provider is not on that list and adding one
 * would widen the policy for every page on the site. The browser calls this
 * endpoint, which is same-origin; this endpoint calls the provider from the
 * server, where no CSP applies. Nothing needs to change in the policy.
 *
 * WHY IT IS EDGE-CACHED WHEN /api/geo/ MUST NOT BE
 *
 * A rate is identical for every visitor on earth, so sharing one response is
 * correct rather than dangerous, and it keeps a burst of traffic from becoming
 * a burst of provider calls. Twelve hours is the agreed staleness: long enough
 * that the provider is called twice a day, short enough that a price never
 * drifts far from the rate it was quoted at. `stale-while-revalidate` means a
 * visitor arriving at hour thirteen is served instantly from the old table
 * while the new one is fetched behind them.
 *
 * WHY THERE IS A HARDCODED TABLE UNDERNEATH
 *
 * If the provider is down and this returns nothing, every converted price on
 * the site falls back to cedis or dollars, which is correct but loses the whole
 * point on the day it happens. The table below is a floor, not a source of
 * truth: it is stamped with the date it was taken, `source` says plainly which
 * one answered, and the browser is free to treat a fallback differently.
 *
 * Rates move. This table will go stale and that is expected: it exists to keep
 * the site sane during an outage, not to be right to the pesewa. Refresh it
 * when it is more than a few months old.
 */

/** Against USD, taken 4 September 2026. Used only when the provider fails. */
const FALLBACK: Record<string, number> = {
  GHS: 10.85, NGN: 1512, ZAR: 17.6, KES: 129, UGX: 3680, TZS: 2610,
  RWF: 1355, XOF: 573, XAF: 573, EGP: 48.2, MAD: 9.65, ETB: 128,
  ZMW: 25.4, BWP: 13.4, MUR: 45.8, NAD: 17.6, GMD: 71, SLE: 22.8,
  MWK: 1735, MZN: 63.9, AOA: 912, CDF: 2870, DZD: 132, TND: 3.02,
  LYD: 4.82, SDG: 601, SOS: 571, LRD: 195, GNF: 8620, MGA: 4520,
  SCR: 14.2, SZL: 17.6, LSL: 17.6, BIF: 2950, DJF: 178, KMF: 429,
  CVE: 96.2, STN: 21.4, ERN: 15, SSP: 4100, MRU: 39.8, SHP: 0.74,
  ZWG: 26.4,
  EUR: 0.873, GBP: 0.741, CAD: 1.36, AUD: 1.49, NZD: 1.63, CHF: 0.795,
  SEK: 9.62, NOK: 10.2, DKK: 6.51, ISK: 128, PLN: 3.71, CZK: 21.4,
  HUF: 345, RON: 4.34, BGN: 1.71, RSD: 102, TRY: 41.2, UAH: 41.5,
  RUB: 84, GEL: 2.71, AMD: 383, AZN: 1.7, KZT: 512,
  INR: 87.4, PKR: 279, BDT: 121, LKR: 296, NPR: 140,
  CNY: 7.11, JPY: 148, KRW: 1352, HKD: 7.79, TWD: 30.6, MOP: 8.02,
  SGD: 1.28, MYR: 4.21, THB: 32.4, VND: 25400, IDR: 16150, PHP: 56.8,
  AED: 3.67, SAR: 3.75, QAR: 3.64, KWD: 0.306, BHD: 0.376, OMR: 0.385,
  JOD: 0.709, LBP: 89500, ILS: 3.38, IQD: 1310, YER: 250,
  MXN: 18.6, BRL: 5.42, ARS: 1290, CLP: 950, COP: 3980, PEN: 3.56,
  UYU: 40.1, PYG: 7450, BOB: 6.91, CRC: 505, GTQ: 7.67, DOP: 61.4,
  JMD: 158, TTD: 6.78, BBD: 2, BSD: 1, FJD: 2.25, PGK: 4.05,
};

const FALLBACK_TAKEN = '2026-09-04';
const TTL_MS = 12 * 60 * 60 * 1000;

/* Warm serverless instances reuse module scope, so this saves a provider call
   even before the edge cache is warm. It is a nicety, not the cache. */
let memo: { at: number; body: string } | null = null;

export const GET: APIRoute = async () => {
  const headers = {
    'Content-Type': 'application/json',
    /* Identical for everybody, so the edge holds it for twelve hours and serves
       the old table for a day beyond that while fetching a new one. */
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'CDN-Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400',
  };

  if (memo && Date.now() - memo.at < TTL_MS) {
    return new Response(memo.body, { status: 200, headers });
  }

  let rates: Record<string, number> = FALLBACK;
  let source: 'live' | 'fallback' = 'fallback';
  let asOf = FALLBACK_TAKEN;

  try {
    /* open.er-api.com: no key, no attribution requirement, ~160 currencies,
       and it publishes against USD, which is the base src/lib/markets.js
       converts through. AbortSignal because a hanging provider must not hold a
       page's prices hostage; the fallback below is right there. */
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        result?: string;
        rates?: Record<string, number>;
        time_last_update_utc?: string;
      };
      /* Both checks matter. The provider answers 200 with result:"error" on a
         bad request, and a rates object missing GHS would convert the entire
         African price list to null. */
      if (data?.result === 'success' && data.rates && Number.isFinite(data.rates.GHS)) {
        rates = data.rates;
        source = 'live';
        asOf = data.time_last_update_utc
          ? new Date(data.time_last_update_utc).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);
      }
    }
  } catch {
    /* Deliberately silent to the visitor and loud in the log. A rate outage
       shows base-currency prices, which is rule 3 in src/lib/markets.js and not
       something to interrupt anybody's afternoon over. */
    console.warn('[rates] provider unreachable; serving the fallback table.');
  }

  const body = JSON.stringify({ base: 'USD', source, asOf, rates });
  memo = { at: Date.now(), body };
  return new Response(body, { status: 200, headers });
};
