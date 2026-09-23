import assets from './workImageManifest.json';

/** Actual work first. Generated presentations are labelled at every service use. */
const visual = (name: keyof typeof assets, alt: string, caption: string, credit: string, evidenceHref: string, evidenceLabel = 'See the work') => ({
  ...assets[name], alt, caption, credit, evidenceHref, evidenceLabel,
});

export const serviceVisuals = {
  web: visual('web-presentation', 'Device mockup showing Quadem’s Omek storefront on a laptop and the QuajoSpeaks homepage on a desktop monitor.', 'Omek · Work in progress / QuajoSpeaks · Internal project', 'AI-assisted device mockup of our website designs.', '/projects/'),
  brand: visual('quadem-identity', 'Quadem Digital’s own blue identity system, with its QD logo, stationery and colour palette.', 'Quadem Digital · Our brand identity', 'Original identity presentation from our portfolio.', '/projects/quadem-brand-identity/'),
  search: { ...visual('search-research', 'Chart from Quadem’s UK aesthetics search analysis, labelled as Semrush UK estimates for June 2024 to July 2026.', 'Quadem search analysis · Published research', 'Independent analysis using Semrush estimates; not client results.', '/blog/uk-aesthetics-search/', 'Read the analysis'), layout: 'research' },
  content: { ...visual('video-story', 'A frame from our video portfolio showing a man at a shop entrance.', 'Story to screen · From our video portfolio', 'Frames from the finished films.', '/services/video-production/#reelbox-heading', 'Watch our video work'), companion: { ...assets['video-fashion'], alt: 'A frame from our clothing advert showing a presenter in an embroidered outfit.' }, layout: 'reels', displayAspectRatio: 1.5 },
  marketing: { ...visual('campaign-opening', 'Opening frame of Quadem’s awareness advert, showing a business owner at a laptop.', 'Quadem awareness advert · Campaign creative', 'Frames from our own awareness film.', '/services/video-production/#reelbox-heading', 'Watch our video work'), companion: { ...assets['campaign-showroom'], alt: 'Later frame of the same awareness advert, showing a presenter in a showroom.' }, layout: 'reels', displayAspectRatio: 1.5 },
  automation: visual('automation-demo', 'Demonstration of Quadem’s WhatsApp intake workflow, collecting a service need, city and website status before handing over to Ernest.', 'Quadem intake workflow · Internal demo', 'AI-generated presentation of our implemented workflow, using sample messages.', '/services/ai-automation/#intake-workflow', 'See how it works'),
  fieldwork: { ...visual('fieldwork-record', 'Actual Fieldwork delivery record, with business name and phone number masked, showing trade, area, reason to call and verification sources.', 'Fieldwork · Actual redacted delivery', 'The original delivered-record exhibit, with identifying details masked.', '/services/fieldwork/#fxGrid', 'Inspect the evidence'), layout: 'document', displayAspectRatio: 1.5 },
};

export function serviceVisualFor(value = '') {
  if (/fieldwork/i.test(value)) return serviceVisuals.fieldwork;
  if (/automation|\bai\b/i.test(value)) return serviceVisuals.automation;
  if (/web/i.test(value)) return serviceVisuals.web;
  if (/brand|graphic/i.test(value)) return serviceVisuals.brand;
  if (/seo|search|paid-ads/i.test(value)) return serviceVisuals.search;
  if (/market|social/i.test(value)) return serviceVisuals.marketing;
  if (/video|reel|content/i.test(value)) return serviceVisuals.content;
  return null;
}

export const serviceStories = [
  { key: 'web', label: 'Web design & development', title: 'Give visitors a reason to enquire.', text: 'A clear offer, a website that works on every screen, and a straightforward way to buy or get in touch.', href: '/services/web-design/', action: 'Explore web design', detail: 'Business websites · Online stores · Web apps' },
  { key: 'brand', label: 'Brand identity & design', title: 'Look like the business you want to be.', text: 'Bring your logo, colours and everyday materials together, so customers recognise you wherever they find you.', href: '/services/brand-identity/', action: 'Explore brand identity', detail: 'Visual identity · Brand guidelines · Print & digital' },
  { key: 'search', label: 'SEO & paid advertising', title: 'Show up when customers are looking.', text: 'Make your services easier to find, connect campaigns to useful landing pages, and understand what brings enquiries.', href: '/services/seo/', action: 'Explore search & ads', detail: 'Search visibility · Local discovery · Paid campaigns' },
  { key: 'content', label: 'Video production', title: 'Give your offer a story people remember.', text: 'Turn your products, services and ideas into focused films that show what you do and why it matters.', href: '/services/video-production/', action: 'Explore video production', detail: 'Brand films · Product stories · Short-form video' },
  { key: 'marketing', label: 'Digital marketing & social media', title: 'Make every post part of a plan.', text: 'Connect your content, campaigns and landing pages around a clear offer, with a useful next step for the people who respond.', href: '/services/digital-marketing-social-media/', action: 'Explore digital marketing', detail: 'Content planning · Social campaigns · Landing pages' },
  { key: 'automation', label: 'AI automation', title: 'Let the routine work happen in the background.', text: 'Collect the basics from new enquiries, organise the information and hand over to a person when it matters. Start with one useful workflow.', href: '/services/ai-automation/', action: 'Explore AI automation', detail: 'WhatsApp intake · Workflow automation · Human handoff' },
  { key: 'fieldwork', label: 'Fieldwork', title: 'Find more of your best customers.', text: 'Describe the businesses you want to reach. Get a list checked against that description, with contact details, evidence and a reason to call.', href: '/services/fieldwork/', action: 'Explore Fieldwork', detail: 'Prospect research · Checked contacts · Monthly delivery' },
] as const;
