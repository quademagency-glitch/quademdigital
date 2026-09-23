// Isolated, read-only CMS fixture. No production credentials or network calls.
import { createServer } from 'node:http';
const port = Number(process.env.CMS_FIXTURE_PORT || 4499);
const site = process.env.CMS_FIXTURE_SITE || 'http://127.0.0.1:4325';
const homepage = {
  heroEyebrow: 'Editorial fixture / From the CMS',
  heroMetaLabels: 'CMS studio label,CMS location label',
  heroPresentation: {
    heading: 'Your CMS headline', accent: 'edited and visible.',
    body: 'This supporting copy comes from the saved homepage fields.',
    note: 'This is the editable founder note.',
    image: { url: `${site}/images/work-based/home-cinematic-studio-v1-1536.webp`, width: 1536, height: 1024, alt: 'CMS selected studio image' },
    caption: 'CMS image caption', credit: 'CMS image credit',
  },
  heroHeadline: '| shaped by the CMS.', heroServices: [{ service: 'Websites' }, { service: 'Brands' }],
  heroSubheadline: 'The lower introduction also reflects its own CMS field.',
  primaryCta: { label: 'Discuss a project', link: '/contact?ref=cms#enquiry' },
  secondaryCta: { label: 'Browse our projects', link: '/projects?ref=cms#work' },
  promoSections: [
    { visual: 'brandIdentity', heading: 'Brand story first', headingAccent: 'from the CMS', body: 'Edited brand service description.', badge: 'Editorial badge', ctaLabel: 'See brand services', ctaUrl: '/services/brand-identity?ref=cms' },
    { visual: 'webDesign', heading: 'Website story second', body: 'This card deliberately has no call to action.', ctaLabel: '', ctaUrl: '/services/web-design/' },
  ],
};
const services = [
  { slug: 'web-design-development', title: 'Website fixture', description: 'CMS website service.', tags: [{ tag: 'Custom web tag' }] },
  { slug: 'branding-graphic-design', title: 'Brand fixture', description: 'CMS brand service.', tags: [{ tag: 'Custom brand tag' }] },
];
createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  const path = new URL(req.url, 'http://localhost').pathname;
  const data = path === '/api/globals/homepage' ? homepage
    : path === '/api/services' ? { docs: services }
    : path.startsWith('/api/globals/') ? {} : { docs: [] };
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}).listen(port, '127.0.0.1', () => console.log(`Read-only CMS fixture on ${port}`));
