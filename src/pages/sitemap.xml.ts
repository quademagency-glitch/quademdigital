import type { APIRoute } from 'astro';
import { payloadFetch } from '../lib/payload';

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
// per-recipient invoices, error pages, and dynamic segments (expanded from CMS
// data below instead).
const EXCLUDE = /(^\.\/(404|500)\.astro$)|(\/api\/)|(\/admin\/)|(\/portal\/)|(\/invoice\/)|(\[)/;

/**
 * Services collection slugs that 301 to a hand-built page of the same service.
 * Keep in step with the /services/ redirects in vercel.json.
 * 'video-production' is absent because the static page already wins that route.
 */
const REDIRECTED_SERVICE_SLUGS = new Set([
  'web-design-development',
  'branding-graphic-design',
  'seo-paid-ads',
]);

function routesFromFilesystem(): string[] {
  return Object.keys(PAGE_MODULES)
    // The external drive scatters AppleDouble sidecars; they are not routes.
    .filter((f) => !f.split('/').some((seg) => seg.startsWith('._')))
    .filter((f) => !EXCLUDE.test(f))
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
  const offers = await payloadFetch('offers', { sort: 'createdAt', limit: '1000' });
  /*
    Page builder pages. Left out until now because the builder rendered
    nothing, so there was no page to list; both halves are fixed together.
    payloadFetch already filters this collection to published documents, so a
    draft cannot leak into the sitemap.
  */
  const pages = await payloadFetch('pages', { sort: 'title', limit: '1000' });

  const staticRoutes = routesFromFilesystem();

  const dynamicRoutes = [
    ...(blogPosts || []).map((post: any) => `/blog/${post.slug}/`),
    ...(caseStudies || [])
        .filter((study: any) => study.published === true)
        .map((study: any) => `/projects/${study.slug}/`),
    ...(services || [])
        .filter((service: any) => !service.slug.includes('--'))
        // Services whose slug 301s to a richer hand-built page (see vercel.json).
        // Listing a redirect in the sitemap asks Google to index a URL that
        // immediately sends it elsewhere, which is what made these duplicates
        // compete with the real pages in the first place.
        .filter((service: any) => !REDIRECTED_SERVICE_SLUGS.has(service.slug))
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

  const allUrls = [...new Set([...staticRoutes, ...dynamicRoutes])];

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
