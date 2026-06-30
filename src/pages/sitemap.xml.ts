import type { APIRoute } from 'astro';
import { payloadFetch } from '../lib/payload';

export const GET: APIRoute = async ({ request }) => {
  const siteUrl = 'https://quademdigital.com';

  // Fetch all dynamic pages from Payload
  const blogPosts = await payloadFetch('blogPosts', { sort: '-publishedAt', limit: 1000 });
  const caseStudies = await payloadFetch('caseStudies', { sort: 'order', limit: 1000 });
  const services = await payloadFetch('services', { sort: 'order', limit: 1000 });
  const offers = await payloadFetch('offers', { sort: 'createdAt', limit: 1000 });

  // Static routes
  const staticRoutes = [
    '/',
    '/about/',
    '/services/',
    '/projects/',
    '/offers/',
    '/blog/',
    '/contact/',
    '/privacy-policy/',
    '/terms-of-service/',
    '/services/brand-identity/',
    '/services/web-design/',
    '/services/seo/',
    '/services/video-production/',
    '/calculator/',
  ];

  const dynamicRoutes = [
    ...(blogPosts || []).map((post: any) => `/blog/${post.slug}/`),
    ...(caseStudies || []).map((study: any) => `/projects/${study.slug}/`),
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
