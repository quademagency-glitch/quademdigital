/**
 * Cloudflare Worker entry for quademdigital.com.
 *
 * Astro renders every page and route through `handle()`. This file wraps it
 * with what Vercel used to do outside the app, from vercel.json and its edge:
 *
 *   1. www -> apex 301.
 *   2. The pitch-asset rewrite, so /pitch/x/hero.jpg reaches the pitch route.
 *   3. Security headers and CSP on every response, assets included.
 *   4. A shared edge cache for public pages: fresh for 60 seconds, then served
 *      stale for up to a day while a new copy renders in the background (what
 *      Vercel-CDN-Cache-Control with stale-while-revalidate used to do).
 *      src/middleware.ts decides what is cacheable and marks it with
 *      EDGE_CACHE_HEADER; nothing else is ever stored.
 *   5. The three crons, as Cloudflare Cron Triggers (see wrangler.jsonc).
 */
import { handle } from '@astrojs/cloudflare/handler';
import security from './lib/securityHeaders.json';
import { EDGE_CACHE_HEADER, PAGE_STALE_TTL } from './lib/edgeCache';
import { PREVIEW_COOKIE } from './lib/preview';

const APEX = 'quademdigital.com';

/** Same pattern as src/middleware.ts. See the comment there. */
const PITCH_ASSET = /^\/pitch\/[^/][^?]*\.[a-z0-9]{1,8}$/i;

/** Cron expression (must match wrangler.jsonc exactly) -> route it runs. */
const CRONS: Record<string, string> = {
  '0 9 * * *': '/api/cron/chase-invoices/',
  '0 7 * * 1': '/api/cron/weekly-report/',
  '0 8 * * *': '/api/cron/health-check/',
};

function withSecurityHeaders(response: Response, pathname: string): Response {
  // Responses from the assets binding and from fetch() have immutable headers.
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries(security.global)) out.headers.set(k, v);
  const isPitch = pathname === '/pitch' || pathname.startsWith('/pitch/');
  out.headers.set('Content-Security-Policy', isPitch ? security.pitchPolicy : security.sitePolicy);
  return out;
}

function hasPreviewCookie(request: Request): boolean {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').some((c) => c.trim().startsWith(`${PREVIEW_COOKIE}=`));
}

async function serve(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  if (url.hostname === `www.${APEX}`) {
    url.hostname = APEX;
    return Response.redirect(url.toString(), 301);
  }

  if (PITCH_ASSET.test(url.pathname)) {
    url.pathname = `${url.pathname}/`;
    request = new Request(url.toString(), request);
  }

  // Only plain public GETs can come from the shared cache. The middleware has
  // the final say on what gets stored; this only avoids a pointless lookup and
  // keeps a preview session from ever being answered with the public copy.
  const cache = (caches as unknown as { default: Cache }).default;
  const mayUseCache = request.method === 'GET' && !hasPreviewCookie(request);
  const cacheKey = new Request(url.toString(), { method: 'GET' });

  if (mayUseCache) {
    const hit = await cache.match(cacheKey);
    if (hit) {
      const storedAt = Number(hit.headers.get(STORED_AT) || 0);
      const freshFor = Number(hit.headers.get(FRESH_FOR) || 0);
      const stale = Date.now() - storedAt > freshFor * 1000;
      // Stale: answer now with the copy we have, and render a fresh one for
      // the next visitor. If that render is not cacheable (an error, a
      // redirect switched on in the CMS), the old copy is dropped instead.
      if (stale) ctx.waitUntil(render(request, env, ctx, cache, cacheKey).then(() => undefined));
      const res = new Response(hit.body, hit);
      res.headers.delete(STORED_AT);
      res.headers.delete(FRESH_FOR);
      res.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
      res.headers.set('X-Edge-Cache', stale ? 'STALE' : 'HIT');
      return res;
    }
  }

  const res = await render(request, env, ctx, mayUseCache ? cache : null, cacheKey);
  if (res.headers.has('X-Edge-Cache')) res.headers.set('X-Edge-Cache', 'MISS');
  return res;
}

/** Headers kept only on the stored copy, so a hit knows how old it is. */
const STORED_AT = 'x-quadem-stored-at';
const FRESH_FOR = 'x-quadem-fresh-for';

/**
 * Renders through Astro and, when the middleware marked the response
 * cacheable and a cache is given, stores it for PAGE_EDGE_TTL fresh plus
 * PAGE_STALE_TTL stale. Marks the returned response with X-Edge-Cache when it
 * was stored. A response that is not cacheable removes any stored copy.
 */
async function render(request: Request, env: Env, ctx: ExecutionContext, cache: Cache | null, cacheKey: Request): Promise<Response> {
  const response = await handle(request, env, ctx);
  const edgeTtl = Number(response.headers.get(EDGE_CACHE_HEADER) || 0);
  if (!edgeTtl) {
    if (cache) ctx.waitUntil(cache.delete(cacheKey));
    return response;
  }

  const res = new Response(response.body, response);
  res.headers.delete(EDGE_CACHE_HEADER);
  if (cache && !res.headers.has('set-cookie')) {
    const stored = res.clone();
    stored.headers.set('Cache-Control', `public, s-maxage=${edgeTtl + PAGE_STALE_TTL}`);
    stored.headers.set(STORED_AT, String(Date.now()));
    stored.headers.set(FRESH_FOR, String(edgeTtl));
    ctx.waitUntil(cache.put(cacheKey, stored));
    res.headers.set('X-Edge-Cache', 'STORED');
  }
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const response = await serve(request, env, ctx);
    return withSecurityHeaders(response, new URL(request.url).pathname);
  },

  /**
   * Runs the existing cron routes exactly as Vercel Cron did: a GET with
   * `Authorization: Bearer CRON_SECRET`. The routes are unchanged and still
   * refuse anything without the secret.
   */
  async scheduled(controller, env, ctx) {
    const path = CRONS[controller.cron];
    if (!path) {
      console.error(`No route for cron "${controller.cron}"`);
      return;
    }
    const secret = (import.meta.env.CRON_SECRET || (env as unknown as Record<string, string>).CRON_SECRET || '').trim();
    const request = new Request(`https://${APEX}${path}`, {
      headers: { Authorization: `Bearer ${secret}`, 'User-Agent': 'cloudflare-cron' },
    });
    const response = await handle(request, env, ctx);
    const body = await response.text();
    const log = `cron ${controller.cron} ${path} -> ${response.status} ${body.slice(0, 500)}`;
    if (response.ok) console.log(log);
    else console.error(log);
  },
} satisfies ExportedHandler<Env>;
