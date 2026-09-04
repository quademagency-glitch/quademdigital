import type { APIRoute } from 'astro';
import { liveOffers } from '../lib/offers';
import { payloadFetch } from '../lib/payload';
import { getRedirectSources, redirectKey } from '../lib/redirects';

/**
 * Static routes are discovered from the filesystem rather than hand-listed.
 * The hand-maintained array had already drifted: /brand-studio/, the newest
 * revenue page, was missing entirely. A list you have to remember to update
 * will be wrong again.
 *
 * import.meta.glob is resolved at build time, so this costs nothing at runtime.
 */
const PAGE_MODULES = import.meta.glob('./**/*.astro', { eager: false });

// Never in a public sitemap: API routes, admin, authenticated portal,
// per-recipient invoices, per-prospect pitch sites, error pages, and dynamic
// segments (expanded from CMS data below instead).
const EXCLUDE = /(^\.\/(404|500)\.astro$)|(\/api\/)|(\/admin\/)|(\/portal\/)|(\/invoice\/)|(\/pitch\/)|(\[)/;

/*
  Routes that exist and are deliberately not advertised. Kept as a named set
  rather than folded into EXCLUDE above, which is built from directory prefixes:
  a single-file exception buried in that regex is unreadable and easy to break.

  Every entry here needs two other things or the page leaks anyway: a matching
  Disallow in public/robots.txt, and noindex on the page itself. Leaving a route
  out of the sitemap is the absence of a signal, not a signal.
*/
/*
  Routes that exist and are deliberately kept out of the sitemap.

  Empty since 28 August 2026, when Fieldwork became a listed service. Kept
  rather than deleted because the filter below is the mechanism, and the next
  page that needs hiding should be added here rather than reinventing it.
*/
const UNLISTED = new Set<string>([]);

function routesFromFilesystem(): string[] {
  return Object.keys(PAGE_MODULES)
    // The external drive scatters AppleDouble sidecars; they are not routes.
    .filter((f) => !f.split('/').some((seg) => seg.startsWith('._')))
    .filter((f) => !EXCLUDE.test(f))
    .filter((f) => !UNLISTED.has(f))
    .map((f) =>
      f
        .replace(/^\.\//, '/')
        .replace(/\.astro$/, '')
        .replace(/\/index$/, '/')
    )
    .map((r) => (r === '/' || r.endsWith('/') ? r : `${r}/`))
    .sort();
}

export const GET: APIRoute = async ({ request }) => {
  const siteUrl = 'https://quademdigital.com';

  // Fetch all dynamic pages from Payload
  const blogPosts = await payloadFetch('blogPosts', { sort: '-publishedAt', limit: '1000' });
  const caseStudies = await payloadFetch('caseStudies', { sort: 'order', limit: '1000' });
  const services = await payloadFetch('services', { sort: 'order', limit: '1000' });
  /* An expired offer 404s, and a 404 in the sitemap is a crawl error reported
   back in Search Console. See src/lib/offers.ts. */
  const offers = liveOffers(await payloadFetch('offers', { sort: 'createdAt', limit: '1000' }));
  /*
    Page builder pages. Left out until now because the builder rendered
    nothing, so there was no page to list; both halves are fixed together.
    payloadFetch already filters this collection to published documents, so a
    draft cannot leak into the sitemap.
  */
  const pages = await payloadFetch('pages', { sort: 'title', limit: '1000' });

  const staticRoutes = routesFromFilesystem();

  /*
    Every address that redirects, taken from the same CMS collection the
    middleware serves. Listing a redirect in the sitemap asks Google to index a
    URL that immediately sends it somewhere else, which is what let the Services
    collection slugs compete with the hand-built service pages.

    This used to be a hardcoded REDIRECTED_SERVICE_SLUGS set that had to be kept
    in step with vercel.json by hand, and only ever covered the three /services/
    ones. Deriving it means a redirect added in the admin leaves the sitemap
    correct on its own.
  */
  const redirectSources = await getRedirectSources();
  const redirects = (route: string) => redirectSources.has(redirectKey(route));

  const dynamicRoutes = [
    ...(blogPosts || []).map((post: any) => `/blog/${post.slug}/`),
    ...(caseStudies || [])
        .filter((study: any) => study.published === true)
        .map((study: any) => `/projects/${study.slug}/`),
    ...(services || [])
        .map((service: any) => `/services/${service.slug}/`),
    ...(offers || []).map((offer: any) => `/offers/${offer.slug}/`),
    ...(pages || [])
        .filter((page: any) => page.slug)
        // A CMS page whose slug collides with a real route never renders:
        // Astro matches the file first. Listing it would advertise a URL that
        // serves different content than the sitemap implies.
        .map((page: any) => `/${page.slug}/`)
        .filter((route: string) => !staticRoutes.includes(route)),
  ];

  const allUrls = [...new Set([...staticRoutes, ...dynamicRoutes])]
      .filter((route) => !redirects(route));

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${allUrls
    .map(
      (url) => `
  <url>
    <loc>${siteUrl}${url}</loc>
    <changefreq>weekly</changefreq>
    <priority>${url === '/' ? '1.0' : '0.8'}</priority>
  </url>`
    )
    .join('')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
