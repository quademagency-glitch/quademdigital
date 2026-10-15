/**
 * Marker the middleware sets on a response that may be stored in the shared
 * edge cache, with the number of seconds to keep it. src/worker.ts reads it,
 * stores the response, and strips the header before it reaches the browser.
 *
 * Kept in its own module so the middleware and the Worker entry agree on the
 * name without either importing the other.
 */
export const EDGE_CACHE_HEADER = 'x-quadem-edge-cache';

/** Public pages: CMS edits show up within this many seconds. */
export const PAGE_EDGE_TTL = 60;
