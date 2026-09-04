import { defineMiddleware } from "astro:middleware";
import { PREVIEW_COOKIE } from "./lib/preview";
import { getRedirectRules, resolveRedirect } from "./lib/redirects";

// Route prefixes that must never be served from a shared/edge cache: they are
// authenticated (portal), admin-only, mutate state (api), or are per-recipient
// documents (invoice, pitch). A pitch is edited minutes before it is sent and
// can be withdrawn with a tickbox, so a cached copy would outlive both.
const NO_CACHE_PREFIXES = ["/api", "/admin", "/portal", "/invoice", "/pitch"];

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

export const onRequest = defineMiddleware(async (context, next) => {
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
          "Vercel-CDN-Cache-Control": "max-age=60",
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
    // Browser always revalidates (fresh HTML on navigation); Vercel's edge
    // serves a cached copy for 60s, then serves stale instantly for up to a
    // day while it refreshes in the background. This is what makes pages fast
    // worldwide instead of round-tripping to the origin + CMS on every view.
    // CMS edits appear within ~60s. Vercel-CDN-Cache-Control governs the edge
    // and is not forwarded to the browser.
    response.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    response.headers.set(
      "Vercel-CDN-Cache-Control",
      "max-age=60, stale-while-revalidate=86400"
    );
    response.headers.delete("CDN-Cache-Control");
  } else {
    // Auth / API / mutating / non-200 responses: never cache anywhere.
    response.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate"
    );
    response.headers.set("CDN-Cache-Control", "no-store");
    response.headers.set("Vercel-CDN-Cache-Control", "no-store");
  }

  return response;
});
