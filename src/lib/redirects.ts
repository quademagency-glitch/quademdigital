/**
 * Redirect rules, read from the CMS.
 *
 * Until 2026-08-24 these were hand-copied across three files: `redirects` in
 * `astro.config.mjs`, the `redirects` array in `vercel.json`, and
 * `REDIRECTED_SERVICE_SLUGS` in `src/pages/sitemap.xml.ts`. Adding one meant
 * editing all three and shipping a deploy. They now live in the CMS
 * `redirects` collection, `src/middleware.ts` serves them, and the sitemap
 * derives its exclusions from this same list.
 *
 * The www to apex rule stays in `vercel.json` on purpose: it is infrastructure
 * rather than content, and it has to keep working when everything downstream
 * of it, this file included, is broken.
 */

export type RedirectRule = {
  from: string;
  to: string;
  status: 301 | 302;
};

/**
 * The rules as they stood when this moved into the CMS, verified live against
 * production on 2026-08-24.
 *
 * This is NOT a second place to edit. It is the last-resort copy used only
 * when the CMS read fails outright: a cold serverless instance during a CMS
 * restart, or the window between the site deploying and the CMS running its
 * migration. Without it, a CMS blip would turn every one of these indexed 301s
 * into a 404, which is a worse failure than serving a slightly stale rule.
 * An empty but successful read means "no redirects" and is honoured as such.
 */
const LAST_RESORT: RedirectRule[] = [
  { from: '/blog/nigerian-business-social-media-marketing', to: '/blog/ghanaian-business-social-media-marketing/', status: 301 },
  { from: '/case-study-1', to: '/projects/revamping-online-store/', status: 301 },
  { from: '/case-study-2', to: '/projects/scaling-user-acquisition/', status: 301 },
  { from: '/case-study-3', to: '/projects/brand-identity-local-seo/', status: 301 },
  { from: '/store-manager', to: 'https://www.quaderp.app/', status: 301 },
  { from: '/services/web-design-development', to: '/services/web-design/', status: 301 },
  { from: '/services/branding-graphic-design', to: '/services/brand-identity/', status: 301 },
  { from: '/services/seo-paid-ads', to: '/services/seo/', status: 301 },
  { from: '/brand-studio', to: '/services/video-production/', status: 301 },
  { from: '/services/branding--graphic-design', to: '/services/brand-identity/', status: 301 },
  { from: '/services/web-design--development', to: '/services/web-design/', status: 301 },
  { from: '/services/digital-marketing--social-media', to: '/services/seo/', status: 301 },
  { from: '/services/seo--paid-ads', to: '/services/seo/', status: 301 },
];

/**
 * Real pages, discovered from the filesystem at build time. A redirect whose
 * old address is one of these would make that page unreachable, and the CMS
 * has no way to know the site's routes, so the guard belongs here. Dynamic
 * routes are deliberately excluded from the guard: redirecting one blog slug
 * to another is a legitimate and already-used case.
 */
const PAGE_MODULES = import.meta.glob('../pages/**/*.astro', { eager: false });

const STATIC_ROUTES: Set<string> = new Set(
  Object.keys(PAGE_MODULES)
    .filter((f) => !f.split('/').some((seg) => seg.startsWith('._')))
    .filter((f) => !f.includes('['))
    .map((f) =>
      f
        .replace(/^\.\.\/pages/, '')
        .replace(/\.astro$/, '')
        .replace(/\/index$/, '')
    )
    .map((r) => (r === '' ? '/' : r))
);

/** Strip the trailing slash so `/x` and `/x/` are the same key. Root stays `/`. */
export const redirectKey = (pathname: string) => {
  const p = pathname.replace(/\/{2,}/g, '/');
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
};

const CACHE_TTL_MS = 60_000;
let cachedAt = 0;
let cached: RedirectRule[] | null = null;
/** Survives a failed read, so a CMS blip serves the previous answer, not none. */
let lastGood: RedirectRule[] = LAST_RESORT;

/**
 * The CMS read is on the critical path of every page request, so it gets its
 * own short timeout rather than `payloadFetch`'s unbounded one. A hanging CMS
 * must not be able to hang the whole site; it falls back instead.
 */
const FETCH_TIMEOUT_MS = 2_000;

async function fetchRules(): Promise<RedirectRule[] | null> {
  const baseUrl =
    import.meta.env.PUBLIC_PAYLOAD_URL ||
    process.env.PUBLIC_PAYLOAD_URL ||
    'http://localhost:3000';

  const headers: Record<string, string> = {};
  if (import.meta.env.PAYLOAD_API_KEY) {
    headers['Authorization'] = `users API-Key ${import.meta.env.PAYLOAD_API_KEY}`;
  }

  try {
    const res = await fetch(
      `${baseUrl}/api/redirects?limit=500&depth=0&where[enabled][not_equals]=false`,
      { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
    );
    // A 404 here means the collection does not exist yet, which is a failed
    // read, not an empty one. Both land in the same branch on purpose.
    if (!res.ok) return null;
    const data = await res.json();
    const docs: any[] = data.docs || [];
    return docs
      .filter((d) => typeof d?.fromPath === 'string' && typeof d?.toPath === 'string')
      .map((d) => ({
        from: redirectKey(d.fromPath.trim()),
        to: d.toPath.trim(),
        status: (d.type === 'temporary' ? 302 : 301) as 301 | 302,
      }))
      .filter((r) => r.from.startsWith('/') && r.from !== '/' && r.to.length > 0);
  } catch {
    return null;
  }
}

export async function getRedirectRules(): Promise<RedirectRule[]> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
  const fetched = await fetchRules();
  if (fetched) {
    lastGood = fetched;
    cached = fetched;
    cachedAt = Date.now();
    return fetched;
  }
  // Do not cache a fallback: the next request should try the CMS again.
  return lastGood;
}

/**
 * Resolve a path to its final destination, following chains so a visitor gets
 * one hop instead of several.
 *
 * A cycle means the rules are wrong, and the honest response is to serve the
 * page rather than hand the browser a loop. Redirecting to the last
 * pre-cycle destination would look like it worked and then bounce the visitor
 * back and forth until the browser gave up, which is harder to diagnose than
 * the page simply not redirecting.
 */
export function resolveRedirect(
  pathname: string,
  rules: RedirectRule[]
): { to: string; status: 301 | 302 } | null {
  const byFrom = new Map<string, RedirectRule>();
  for (const rule of rules) {
    // A rule that shadows a real page would make that page unreachable.
    if (STATIC_ROUTES.has(rule.from)) {
      console.warn(
        `[redirects] ignoring "${rule.from}": that is a real page on the site, and redirecting it would make it unreachable.`
      );
      continue;
    }
    byFrom.set(rule.from, rule);
  }

  let current = redirectKey(pathname);
  const visited = new Set<string>([current]);
  let status: 301 | 302 = 301;
  let destination: string | null = null;

  // Bounded as well as cycle-checked, so a pathological list cannot stall.
  for (let hop = 0; hop < 10; hop += 1) {
    const rule = byFrom.get(current);
    if (!rule) break;
    // A temporary anywhere in the chain makes the whole hop temporary: it is
    // the weaker claim, and caching the chain as permanent would outlive it.
    if (rule.status === 302) status = 302;
    destination = rule.to;
    // Off-site: nothing further to follow.
    if (/^https?:\/\//i.test(rule.to)) break;
    const next = redirectKey(rule.to.split(/[?#]/)[0] || '/');
    if (visited.has(next)) {
      console.warn(
        `[redirects] "${rule.from}" leads back to "${next}", so it would loop. Serving the page instead.`
      );
      return null;
    }
    visited.add(next);
    current = next;
  }

  if (!destination) return null;
  return { to: destination, status };
}

/** The set of paths that redirect, so the sitemap never advertises one. */
export async function getRedirectSources(): Promise<Set<string>> {
  const rules = await getRedirectRules();
  return new Set(rules.map((r) => r.from));
}
