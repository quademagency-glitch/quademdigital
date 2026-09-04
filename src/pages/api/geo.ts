import type { APIRoute } from 'astro';
import { marketFor, currencyFor } from '../../lib/markets.js';

/**
 * Who is asking, and therefore which price list and which money.
 *
 * Replaces a client-side call to ipapi.co, whose free tier caps at roughly
 * 1,000 requests/day and which the pricing code treated as fail-open: any
 * non-OK response simply returned, leaving prices in USD. Past the quota,
 * every Ghanaian visitor silently saw dollar prices.
 *
 * This is same-origin, has no quota, no rate limit and no third-party
 * dependency. It is deliberately a tiny endpoint rather than server-rendered
 * into the page: the middleware edge-caches public GET pages for 60s, so
 * country-varying HTML would be cached and served to the wrong country.
 *
 * THE MARKET IS DECIDED HERE, NOT IN THE BROWSER
 *
 * `market` and `currency` come back already resolved, from src/lib/markets.js,
 * so the rule lives in exactly one place. The browser is told which list to
 * reveal; it does not work it out. That is what stops a second copy of the
 * continent table appearing in a page script one day and drifting.
 *
 * `country` is still returned because initGhanaOnlyLinks and the enquiry forms
 * key off Ghana specifically rather than off the market.
 */
export const GET: APIRoute = async ({ request }) => {
  const country = (
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('cf-ipcountry') ||
    ''
  ).toUpperCase();

  return new Response(
    JSON.stringify({
      country,
      market: marketFor(country),
      currency: currencyFor(country),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Per-visitor and cheap to recompute; never share across users.
        // Sharing this one response is the entire bug this endpoint exists to
        // avoid, so it is no-store at the browser and the edge both.
        'Cache-Control': 'private, no-store',
        'CDN-Cache-Control': 'no-store',
      },
    },
  );
};
