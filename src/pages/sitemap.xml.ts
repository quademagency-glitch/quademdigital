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
  const blogPosts = await payloadFetch('blogPosts', { sort: '-publishedAt', limit: 1000 });
  const caseStudies = await payloadFetch('caseStudies', { sort: 'order', limit: 1000 });
  const services = await payloadFetch('services', { sort: 'order', limit: 1000 });
  const offers = await payloadFetch('offers', { sort: 'createdAt', limit: 1000 });

  const staticRoutes = routesFromFilesystem();

  const dynamicRoutes = [
    ...(blogPosts || []).map((post: any) => `/blog/${post.slug}/`),
    ...(caseStudies || [])
        .filter((study: any) => study.published === true)
        .map((study: any) => `/projects/${study.slug}/`),
    ...(services || [])
        .filter((service: any) => !service.slug.includes('--'))
        .map((service: any) => `/services/${service.slug}/`),
    ...(offers || []).map((offer: any) => `/offers/${offer.slug}/`),
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
