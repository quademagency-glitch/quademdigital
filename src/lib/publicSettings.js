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
  'branding-graphic-design': '/services/brand-identity/',
  'seo-paid-ads': '/services/seo/',
};
export const serviceHref = slug => serviceRoutes[slug] || `/services/${slug}/`;

const promoSlugs = {
  webDesign: 'web-design-development', brandIdentity: 'branding-graphic-design',
  seo: 'seo-paid-ads', video: 'video-production', aiAutomation: 'ai-automation',
  fieldwork: 'fieldwork', digitalMarketing: 'digital-marketing-social-media',
};
const promoKeys = { webDesign: 'web', brandIdentity: 'brand', seo: 'search', video: 'content', aiAutomation: 'automation', fieldwork: 'fieldwork', digitalMarketing: 'marketing' };
export function homepageServices(homepage, services) {
  const promos = (homepage?.promoSections || []).filter(p => promoSlugs[p.visual] && p.heading && p.body);
  if (promos.length) return promos.map(p => {
    const service = services.find(s => s.slug === promoSlugs[p.visual]);
    return { key: promoKeys[p.visual], serviceTitle: service?.title, title: [p.heading, p.headingAccent].filter(Boolean).join(' '), badge: p.badge,
      text: p.body, href: normaliseLocalHref(p.ctaUrl || serviceHref(promoSlugs[p.visual])),
      ctaLabel: p.ctaLabel, image: service?.featuredImage || service?.rawMedia,
      capabilities: (service?.tags || []).map(t => t.tag).filter(Boolean).slice(0, 3) };
  });
  return services.map(s => ({ key: promoKeys[Object.keys(promoSlugs).find(k => promoSlugs[k] === s.slug)], serviceTitle: s.title, title: s.title, text: s.description, href: serviceHref(s.slug),
    ctaLabel: 'Explore this service', image: s.featuredImage || s.rawMedia,
    capabilities: (s.tags || []).map(t => t.tag).filter(Boolean).slice(0, 3) }));
}
