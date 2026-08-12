import type { APIRoute } from 'astro';

/**
 * Visitor country, from Vercel's edge header.
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
 */
export const GET: APIRoute = async ({ request }) => {
  const country =
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('cf-ipcountry') ||
    '';

  return new Response(JSON.stringify({ country: country.toUpperCase() }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Per-visitor and cheap to recompute; never share across users.
      'Cache-Control': 'private, no-store',
    },
  });
};
