import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseLocalHref, homepageServices } from '../src/lib/publicSettings.js';

test('editor links keep queries and anchors while local page paths gain a trailing slash', () => {
  for (const [input, output] of [
    ['/contact?service=seo#contact', '/contact/?service=seo#contact'],
    ['/services/web-design/', '/services/web-design/'],
    ['/#pricing', '/#pricing'], ['#work', '#work'],
    ['https://quaderp.app', 'https://quaderp.app'],
    ['mailto:ernest@quademdigital.com', 'mailto:ernest@quademdigital.com'],
    ['/files/guide.pdf', '/files/guide.pdf'],
  ]) assert.equal(normaliseLocalHref(input), output);
});

test('homepage promotions follow CMS ordering, copy, CTA settings and original service images', () => {
  const services = [
    { slug: 'web-design-development', title: 'Web design', featuredImage: { id: 1 }, tags: [{ tag: 'Ecommerce' }] },
    { slug: 'seo-paid-ads', title: 'SEO', featuredImage: { id: 2 } },
  ];
  const seo = { visual: 'seo', heading: 'Find', headingAccent: 'customers', body: 'Search copy', ctaLabel: 'Ask about SEO', ctaUrl: '/contact?service=seo#contact' };
  const web = { visual: 'webDesign', heading: 'Build a site', body: 'Website copy', ctaLabel: '' };
  const result = homepageServices({ promoSections: [seo, web] }, services);
  assert.deepEqual(result.map(p => p.title), ['Find customers', 'Build a site']);
  assert.equal(result[0].href, '/contact/?service=seo#contact');
  assert.equal(result[0].ctaLabel, 'Ask about SEO');
  assert.equal(result[0].image.id, 2);
  assert.equal(result[1].href, '/services/web-design/');
  assert.equal(result[1].ctaLabel, ''); // Editors can remove a CTA.
  assert.deepEqual(result[1].capabilities, ['Ecommerce']);
  assert.deepEqual(homepageServices({ promoSections: [web] }, services).map(p => p.title), ['Build a site']);
  assert.deepEqual(homepageServices({ promoSections: [web, seo] }, services).map(p => p.image.id), [1, 2]);
});

test('empty or invalid promotions fall back to real services, including specialized route aliases', () => {
  const services = [
    { slug: 'web-design-development', title: 'Web', description: 'Sites', rawMedia: { id: 9 } },
    // Retired on 19 October 2026: kept in the CMS, never listed on the site.
    { slug: 'branding-graphic-design', title: 'Brand (retired)', description: 'Identity' },
    { slug: 'fieldwork', title: 'Fieldwork', description: 'Research' },
  ];
  const result = homepageServices({ promoSections: [{ visual: 'unknown', heading: 'Invalid', body: 'Invalid' }] }, services);
  assert.deepEqual(result.map(p => p.href), ['/services/web-design/', '/services/fieldwork/']);
  assert.deepEqual(result.map(p => p.stage), ['build', 'grow']);
  assert.equal(result[0].image.id, 9);
});
