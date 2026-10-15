/**
 * Cloudflare Worker entry for quademdigital.com.
 *
 * Astro renders every page and route through `handle()`. This file wraps it
 * with what Vercel used to do outside the app, from vercel.json and its edge:
 *
 *   1. www -> apex 301.
 *   2. The pitch-asset rewrite, so /pitch/x/hero.jpg reaches the pitch route.
 *   3. Security headers and CSP on every response, assets included.
 *   4. A 60-second shared edge cache for public pages (Vercel-CDN-Cache-Control
 *      used to do this). src/middleware.ts decides what is cacheable and marks
 *      it with EDGE_CACHE_HEADER; nothing else is ever stored.
 *   5. The three crons, as Cloudflare Cron Triggers (see wrangler.jsonc).
 */
import { handle } from '@astrojs/cloudflare/handler';
import security from './lib/securityHeaders.json';
import { EDGE_CACHE_HEADER } from './lib/edgeCache';
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
      const res = new Response(hit.body, hit);
      res.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
      res.headers.set('X-Edge-Cache', 'HIT');
      return res;
    }
  }

  const response = await handle(request, env, ctx);
  const edgeTtl = Number(response.headers.get(EDGE_CACHE_HEADER) || 0);
  if (!edgeTtl) return response;

  const res = new Response(response.body, response);
  res.headers.delete(EDGE_CACHE_HEADER);
  if (mayUseCache && !res.headers.has('set-cookie')) {
    const stored = res.clone();
    stored.headers.set('Cache-Control', `public, s-maxage=${edgeTtl}`);
    ctx.waitUntil(cache.put(cacheKey, stored));
    res.headers.set('X-Edge-Cache', 'MISS');
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
