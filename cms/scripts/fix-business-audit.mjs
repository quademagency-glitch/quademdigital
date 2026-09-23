#!/usr/bin/env node
// Public content changes from the September business audit. Dry-run by default.
// Apply: node --env-file=.env cms/scripts/fix-business-audit.mjs --apply
// Each apply writes a timestamped backup before any request that changes data.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.PUBLIC_PAYLOAD_URL;
const key = process.env.PAYLOAD_API_KEY;
const apply = process.argv.includes('--apply');
const fixture = process.argv.find((arg) => arg.startsWith('--fixture='))?.slice(10);
if (!fixture && !base) throw new Error('PUBLIC_PAYLOAD_URL is required. Run with --env-file=.env.');
if (apply && (fixture || !key)) throw new Error('Apply requires the real CMS and PAYLOAD_API_KEY.');
const headers = { 'Content-Type': 'application/json', ...(key ? { Authorization: `users API-Key ${key}` } : {}) };
const paths = ['globals/homepage', 'globals/about', 'globals/contactPage', 'globals/siteSettings', 'globals/servicesPage', 'globals/videoProductionPage', 'pricingPlans', 'faqs', 'services', 'offers'];
const snapshot = fixture ? JSON.parse(await readFile(fixture, 'utf8')) : {};
async function read(path) {
    const res = await fetch(`${base}/api/${path}?depth=0&limit=100`, { headers, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`Read ${path}: HTTP ${res.status}`);
    return res.json();
}
if (!fixture) for (const path of paths) snapshot[path] = await read(path);
const changes = [];
function change(path, before, patch) {
    if (!before) throw new Error(`Missing content: ${path}`);
    const changed = Object.fromEntries(Object.entries(patch).filter(([field, value]) => JSON.stringify(before[field]) !== JSON.stringify(value)));
    if (Object.keys(changed).length) changes.push({ path, before, patch: changed });
}
const home = snapshot['globals/homepage'];
change('globals/homepage', home, {
    heroHeadline: '| built for enquiries and sales.',
    heroTagline: 'For small businesses that need their website to explain the offer, earn trust and make it easy to enquire or buy. I design, build and improve it, and you work directly with me.',
    heroSubheadline: 'A clear scope, a fixed quote and progress you can review before launch.',
    heroServices: [{ ...home.heroServices[0], service: 'Websites', prefix: null, suffix: null }],
    primaryCta: { label: 'Book a 15-minute call', link: '/contact/#book' },
    secondaryCta: { label: 'See the client work', link: '#work' },
    riskReversal: { ...home.riskReversal, heading: 'Know what you are buying.', body: 'Scope, price, timeline and included revisions agreed before work starts. You see progress each week, and any extra work is quoted before it begins.' },
    trustHighlights: [
        { icon: '👤', title: 'Work directly with Ernest', description: 'The person on your call is the person designing and building your website.' },
        { icon: '📋', title: 'Know the scope and price', description: 'Pages, features, revisions and ongoing costs are set out in your proposal.' },
        { icon: '📈', title: 'Agree what to measure', description: 'We choose the enquiries, sales or site problems to track before work begins.' },
    ],
    meta: { ...home.meta, title: 'Web Design for Small Businesses | Quadem Digital', description: 'Websites built for enquiries and sales. Work directly with Ernest in Accra on web design, online shops and website improvements, with a clear scope and fixed quote.' },
});
const about = snapshot['globals/about'];
change('globals/about', about, {
    headline: "I'm Ernest. I build the website with you.",
    subheadline: 'Direct communication, a written scope and work you can review as it develops.',
    bio: 'I run Quadem Digital from Accra, helping small businesses build and improve the websites their customers use to enquire, book and buy.\n\nYou work with me from the first conversation to handover. I start with your offer and the problems customers meet, then agree the pages, features, price and timeline before I build. You see progress each week.\n\nMy work includes storefronts, payment integrations and the practical fixes that make a site easier to use. The project pages show what I built, what was measured and what is still in progress.\n\nAfter launch, I show you how to update your content. Any ongoing support or extra work is scoped and priced before it begins.',
});
const contact = snapshot['globals/contactPage'];
change('globals/contactPage', contact, {
    bookingHeading: 'Book a free 15-minute call',
    bookingSubtitle: 'We will look at what you need the project to achieve, what is getting in the way and the next practical step. Bring your website address if you have one. No obligation.',
    showBookingSection: true,
});
const settings = snapshot['globals/siteSettings'];
change('globals/siteSettings', settings, { navLinks: settings.navLinks.filter((link) => !/quaderp\.app/i.test(link.url || '')) });
const servicesPage = snapshot['globals/servicesPage'];
change('globals/servicesPage', servicesPage, { subheading: 'Start with the website your customers need. Add search, content or automation where it supports the job.' });
const video = snapshot['globals/videoProductionPage'];
change('globals/videoProductionPage', video, {
    ctaSection: { ...video.ctaSection, subtitle: 'Book a free 15-minute call to discuss your products, audience and first batch of videos. I will explain what assets I need and confirm the scope and price before production starts.' },
});
for (const plan of snapshot.pricingPlans.docs) {
    const features = plan.features.map((item) => ({ ...item, feature: item.feature === 'You film a few clips on your phone once a month'
        ? 'Send your logo and product photos; filming is optional'
        : item.feature === 'Ongoing changes to the site'
            ? 'A monthly website task list agreed in your proposal'
            : item.feature }));
    change(`pricingPlans/${plan.id}`, plan, { features });
}
for (const faq of snapshot.faqs.docs) {
    if (faq.question === 'What if I do not like the design?') change(`faqs/${faq.id}`, faq, {
        answer: 'You review the design before the site is built. Your proposal states the included revision rounds and what each covers. I work through your feedback within that scope; a new direction or extra rounds are quoted for approval before any extra work starts.',
    });
}
for (const service of snapshot.services.docs) {
    if (service.slug === 'seo-paid-ads') change(`services/${service.id}`, service, {
        tags: [{ tag: 'Technical SEO' }, { tag: 'Local Search' }, { tag: 'Search Content' }],
        description: 'Technical fixes, local search and useful content that help customers find your business. Paid advertising is scoped separately.',
    });
}
for (const offer of snapshot.offers.docs) {
    if (offer.slug === 'social-media-bonus') change(`offers/${offer.id}`, offer, {
        description: 'Choose one month of launch support on one social platform with a Corporate Site or E-Commerce project. The bonus covers a launch calendar and scheduling of up to 12 approved posts using content you supply. Custom video production, paid advertising, ad spend and inbox management are excluded. The month starts when your website launches. The bonus must be included in your written proposal before the deposit is paid and cannot be combined with another discount. Existing signed agreements keep their agreed terms.',
    });
    if (offer.slug === 'web-dev-discount') change(`offers/${offer.id}`, offer, {
        description: 'New clients can choose 15% off the quoted design and development fee for their first custom website or app project. Hosting, domains, software licences, advertising spend and ongoing retainers are excluded. Ask for the discount before accepting the proposal; the revised total will be confirmed in writing. This offer cannot be combined with the social media bonus or another discount. Existing signed agreements keep their agreed terms.',
    });
}
for (const item of changes) console.log(JSON.stringify({ path: item.path, changes: item.patch }, null, 2));
console.log(`${changes.length} document(s) ${apply ? 'to update' : 'in dry run'}. Prices are unchanged.`);
if (!apply || !changes.length) process.exit(0);
const backup = resolve('cms/scripts', `business-audit-${new Date().toISOString().replace(/[:.]/g, '-')}-backup.json`);
await writeFile(backup, JSON.stringify(changes, null, 2), { mode: 0o600, flag: 'wx' });
console.log(`Backup: ${backup}`);
for (const { path, before, patch } of changes) {
    const current = await read(path);
    if (current.updatedAt !== before.updatedAt) throw new Error(`Concurrent edit on ${path}; stopped before overwriting it.`);
    // Retain current field values, including defaulted fields such as market.
    const { id, createdAt, updatedAt, globalType, ...editable } = current;
    const res = await fetch(`${base}/api/${path}`, {
        method: path.startsWith('globals/') ? 'POST' : 'PATCH', headers,
        body: JSON.stringify({ ...editable, ...patch }), signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Write ${path}: HTTP ${res.status}`);
    const saved = await read(path);
    const normalise = (value) => Array.isArray(value) ? value.map(normalise) : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'id').sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => [key, normalise(val)])) : value;
    for (const [field, value] of Object.entries(patch)) {
        if (JSON.stringify(normalise(saved[field])) !== JSON.stringify(normalise(value))) throw new Error(`Readback mismatch: ${path}.${field}`);
    }
    console.log(`Verified ${path}`);
}
