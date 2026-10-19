// Preserve editor-owned paths, including query strings and section anchors.
export function normaliseLocalHref(value) {
  const href = typeof value === 'string' ? value.trim() : '';
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const url = new URL(href, 'https://quademdigital.com');
  if (!url.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(url.pathname)) url.pathname += '/';
  return `${url.pathname}${url.search}${url.hash}`;
}

const serviceRoutes = {
  'web-design-development': '/services/web-design/',
  'seo-paid-ads': '/services/seo/',
};
export const serviceHref = slug => serviceRoutes[slug] || `/services/${slug}/`;

/*
  Services Quadem no longer sells. Ernest stopped selling branding (logo, brand
  kit, visual identity) on 19 October 2026. Its CMS row stays, retitled
  "(retired)", because switched-off price list packages still point at it and
  past deals point at those; the site leaves it out everywhere a service is
  listed, and /services/brand-identity/ forwards to web design.
*/
export const RETIRED_SERVICE_SLUGS = new Set(['branding-graphic-design']);
export const isRetiredService = slug => RETIRED_SERVICE_SLUGS.has(slug);

/*
  The two steps every service belongs to (19 October 2026): Build it is work
  paid for once, Grow it is work that runs every month. The services page and
  the homepage group by this. Fieldwork has a one-off setup but is bought for
  the monthly list, so it is Grow. A service missing from here is Build, the
  safer default for a new one-off offer.
*/
const GROW_SERVICE_SLUGS = new Set(['video-production', 'seo-paid-ads', 'digital-marketing-social-media', 'fieldwork']);
export const serviceStage = slug => (GROW_SERVICE_SLUGS.has(slug) ? 'grow' : 'build');
export const SERVICE_STAGES = [
  { key: 'build', title: 'Build it', kicker: 'Pay once' },
  { key: 'grow', title: 'Grow it', kicker: 'Every month' },
];

// brandIdentity is gone (branding retired 19 October 2026), so a promo still
// carrying that visual is dropped by the filter below rather than linking to a
// page that now forwards elsewhere.
const promoSlugs = {
  webDesign: 'web-design-development',
  seo: 'seo-paid-ads', video: 'video-production', aiAutomation: 'ai-automation',
  fieldwork: 'fieldwork', digitalMarketing: 'digital-marketing-social-media',
};
const promoKeys = { webDesign: 'web', seo: 'search', video: 'content', aiAutomation: 'automation', fieldwork: 'fieldwork', digitalMarketing: 'marketing' };
export function homepageServices(homepage, services) {
  const promos = (homepage?.promoSections || []).filter(p => promoSlugs[p.visual] && p.heading && p.body);
  if (promos.length) return promos.map(p => {
    const service = services.find(s => s.slug === promoSlugs[p.visual]);
    return { key: promoKeys[p.visual], stage: serviceStage(promoSlugs[p.visual]), serviceTitle: service?.title, title: [p.heading, p.headingAccent].filter(Boolean).join(' '), badge: p.badge,
      text: p.body, href: normaliseLocalHref(p.ctaUrl || serviceHref(promoSlugs[p.visual])),
      ctaLabel: p.ctaLabel, image: service?.featuredImage || service?.rawMedia,
      capabilities: (service?.tags || []).map(t => t.tag).filter(Boolean).slice(0, 3) };
  });
  return services.filter(s => !isRetiredService(s.slug)).map(s => ({ key: promoKeys[Object.keys(promoSlugs).find(k => promoSlugs[k] === s.slug)], stage: serviceStage(s.slug), serviceTitle: s.title, title: s.title, text: s.description, href: serviceHref(s.slug),
    ctaLabel: 'Explore this service', image: s.featuredImage || s.rawMedia,
    capabilities: (s.tags || []).map(t => t.tag).filter(Boolean).slice(0, 3) }));
}
