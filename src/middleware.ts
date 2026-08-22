import { defineMiddleware } from "astro:middleware";
import { PREVIEW_COOKIE } from "./lib/preview";

// Route prefixes that must never be served from a shared/edge cache: they are
// authenticated (portal), admin-only, mutate state (api), or are per-recipient
// documents (invoice).
const NO_CACHE_PREFIXES = ["/api", "/admin", "/portal", "/invoice"];

const isNoCachePath = (pathname: string) =>
  NO_CACHE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export const onRequest = defineMiddleware(async (context, next) => {
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
