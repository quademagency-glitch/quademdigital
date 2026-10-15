import { defineMiddleware } from "astro:middleware";
import { PREVIEW_COOKIE } from "./lib/preview";
import { getRedirectRules, resolveRedirect } from "./lib/redirects";
import { EDGE_CACHE_HEADER, PAGE_EDGE_TTL } from "./lib/edgeCache";

// Route prefixes that must never be served from a shared/edge cache: they are
// authenticated (portal), admin-only, mutate state (api), or are per-recipient
// documents (invoice, pitch, sign, quote). A pitch is edited minutes before it is sent and
// can be withdrawn with a tickbox, so a cached copy would outlive both. A
// signing page changes the moment someone signs, and caching one would serve
// one signer's page, document and all, to whoever asked next.
const NO_CACHE_PREFIXES = ["/api", "/admin", "/portal", "/invoice", "/pitch", "/sign", "/quote"];

const isNoCachePath = (pathname: string) =>
  NO_CACHE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Paths a CMS redirect can never apply to. Skipping them keeps the API, the
 * crons, the portal and the invoice pages on exactly the latency they had
 * before redirects moved into the CMS, and stops a mistyped rule from being
 * able to break them. Anything with a file extension is an asset, not a page.
 */
const REDIRECTABLE = (pathname: string) =>
  !isNoCachePath(pathname) &&
  !pathname.startsWith("/_") &&
  !/\.[a-z0-9]+$/i.test(pathname);

/**
 * A file inside a pitch folder: /pitch/accra-metro/images/hero.jpg.
 *
 * `trailingSlash: 'always'` means Astro matches no route at all for a path
 * that does not end in a slash, so every image, stylesheet and font in a
 * dropped folder was a 404 from Astro's own handler before the pitch route
 * ever saw it. The markup asks for these by relative address and cannot be
 * asked to add a slash, so the request is rewritten into the form the router
 * accepts. A pitch slug is lowercase letters, numbers and hyphens with no
 * dots, so an extension here is always a file rather than a pitch.
 *
 * **There is a second copy of this rule in src/worker.ts, and both are needed.**
 * In production the Worker rewrites the request before Astro routes it, so
 * the pitch route is matched properly and its status is its own. (On Vercel a
 * rewrite in here alone produced the right bytes under a forced 404, which is
 * why the rule first had to live outside the app.) This copy is what makes
 * `astro dev` behave the same, since the dev server does not run worker.ts.
 */
const PITCH_ASSET = /^\/pitch\/[^/][^?]*\.[a-z0-9]{1,8}$/i;

export const onRequest = defineMiddleware(async (context, next) => {
  /*
    Rewriting rather than redirecting: a redirect would show the slash form in
    the network panel of anyone who opens developer tools on a pitch, and would
    cost a round trip per file. Rewriting is invisible and free. The pitch route
    strips the slash back off before it looks anything up.
  */
  if (PITCH_ASSET.test(context.url.pathname)) {
    return context.rewrite(`${context.url.pathname}/${context.url.search}`);
  }

  /*
    Redirects come from the CMS `redirects` collection, so Ernest can add one
    without a deploy. This runs before next() because a redirect must not
    render the page it is redirecting away from.

    getRedirectRules() memoises for 60s per warm instance and has its own 2s
    timeout with a fallback, so a slow or missing CMS cannot hold a request
    open. See src/lib/redirects.ts.
  */
  if (context.request.method === "GET" && REDIRECTABLE(context.url.pathname)) {
    const hit = resolveRedirect(context.url.pathname, await getRedirectRules());
    if (hit) {
      // Carry the query string over unless the rule brought its own, so a
      // campaign link like /case-study-1?utm_source=x keeps its attribution.
      const search = context.url.search.slice(1);
      const location =
        search && !hit.to.includes("?") ? `${hit.to}?${search}` : hit.to;
      return new Response(null, {
        status: hit.status,
        headers: {
          Location: location,
          // A 301 is cached hard by browsers and by the edge. Keep the edge
          // window to the same 60s the rest of the site uses, so switching a
          // redirect off in the CMS takes effect as quickly as any other edit.
          "Cache-Control": "public, max-age=0, must-revalidate",
          [EDGE_CACHE_HEADER]: String(PAGE_EDGE_TTL),
        },
      });
    }
  }

  const response = await next();
  const { pathname } = context.url;

  // Only public, safe GET pages that succeeded may be edge-cached. The
  // Set-Cookie check is a safety net: any response that establishes/clears a
  // session (login, portal) is treated as private even if its path slips
  // through the prefix list.
  // A preview response contains unpublished copy. It is a normal page path on a
  // normal GET, so without this check the edge would cache the draft and serve
  // it to the public for the next 60 seconds, which is precisely what a draft
  // is meant to prevent.
  const isPreviewRequest = context.cookies.has(PREVIEW_COOKIE);

  const cacheable =
    context.request.method === "GET" &&
    response.status === 200 &&
    !response.headers.has("set-cookie") &&
    !isPreviewRequest &&
    !isNoCachePath(pathname);

  if (cacheable) {
    // Browser always revalidates (fresh HTML on navigation); the Worker
    // (src/worker.ts) keeps a shared copy at the edge for 60s, so pages do not
    // round-trip to the CMS on every view. CMS edits appear within ~60s. The
    // marker header is read and removed by the Worker; the browser never sees it.
    response.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    response.headers.set(EDGE_CACHE_HEADER, String(PAGE_EDGE_TTL));
    response.headers.delete("CDN-Cache-Control");
  } else {
    // Auth / API / mutating / non-200 responses: never cache anywhere.
    response.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate"
    );
    response.headers.set("CDN-Cache-Control", "no-store");
    response.headers.delete(EDGE_CACHE_HEADER);
  }

  return response;
});
