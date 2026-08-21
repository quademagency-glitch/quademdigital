import 'dotenv/config'
import payload from 'payload'
import config from '../src/payload.config'

/**
 * Populates pricingSection.plans + faqSection.faqs for the 4 service detail
 * globals (webDesignPage, seoPage, brandIdentityPage, videoProductionPage).
 * These fields were empty in the CMS — the live pages were silently
 * rendering hardcoded JS fallback content baked into each .astro file
 * instead. This mirrors that exact fallback content into the CMS so it
 * becomes the real, editable source of truth (zero visual change on deploy).
 */

type Feature = { feature: string }
type Plan = {
  name: string
  price: string
  period?: string
  description?: string
  isPopular?: boolean
  features: Feature[]
}
type Faq = { question: string; answer: string }
type Service = { title: string; description: string; iconSvg: string; features?: Feature[] }
type ProcessStep = { number: string; title: string; description: string }

const webDesignPlans: Plan[] = [
  {
    name: 'Landing Page',
    price: 'GH₵ 2,500',
    period: 'starting at',
    description: 'Perfect for campaigns, lead generation, and new product launches.',
    isPopular: false,
    features: ['High-converting single page', 'Custom premium design', 'Mobile responsive', 'Contact form integration', 'Basic SEO setup', 'Social media links', '1 week delivery'].map((feature) => ({ feature })),
  },
  {
    name: 'Corporate Site',
    price: 'GH₵ 5,000',
    period: 'starting at',
    description: 'Ideal for growing businesses needing a complete online presence.',
    isPopular: true,
    features: ['Up to 5 custom pages', 'Content Management System (CMS)', 'Blog integration', 'Advanced SEO optimization', 'Google Analytics setup', 'Performance tuning', '3 weeks delivery', '30 days free support'].map((feature) => ({ feature })),
  },
  {
    name: 'E-Commerce',
    price: 'Custom',
    period: 'per project',
    description: 'Full-scale online stores or complex web applications.',
    isPopular: false,
    features: ['Unlimited products', 'Secure payment gateway integration', 'Inventory management', 'User accounts & dashboards', 'Custom app functionality', 'Advanced analytics', 'I manage it, start to finish', 'Ongoing maintenance options'].map((feature) => ({ feature })),
  },
]

const webDesignServices: Service[] = [
  { title: 'Corporate Websites', description: 'Professional sites that showcase your brand, services, and credibility.', iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/></svg>' },
  { title: 'E‑Commerce', description: 'Shopify‑ready or custom stores that convert traffic into sales.', iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>' },
  { title: 'Landing Pages', description: 'High‑impact single pages for campaigns, launches, and lead capture.', iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>' },
  { title: 'Web Apps & Dashboards', description: 'Custom interactive applications built on modern stacks.', iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' },
]

const webDesignProcessSteps: ProcessStep[] = [
  { number: '01', title: 'Discovery & Strategy', description: 'We define goals, target audience, and site architecture.' },
  { number: '02', title: 'Design & Wireframes', description: 'Mockups, UI design, and responsive prototypes.' },
  { number: '03', title: 'Development', description: 'Clean, performant code built on Astro, React, or vanilla HTML/CSS.' },
  { number: '04', title: 'Launch & Optimization', description: 'Testing, SEO, performance tuning, and handover.' },
]

const webDesignFaqs: Faq[] = [
  { question: 'How long does it take to build a website?', answer: 'A standard corporate website typically takes 3 to 4 weeks from discovery to launch. Landing pages can be delivered in a week, while complex e-commerce or custom web apps may take 6 to 12 weeks depending on scope.' },
  { question: 'What platforms do you build on?', answer: 'We choose the best stack for your needs. For blazing-fast content sites, we use Astro or Next.js. For e-commerce, we utilize Shopify or custom solutions. For easy content management, we can integrate WordPress or modern headless CMS solutions like Payload CMS.' },
  { question: 'Do I need to provide the content?', answer: "That is up to you. If you have text and images, I will use them. If not, I can write the copy and design the visuals for your brand for an additional fee." },
  { question: 'Will my website be mobile-friendly?', answer: 'Absolutely. Every website we build is 100% responsive, meaning it will look and function beautifully on smartphones, tablets, and desktop computers.' },
  { question: 'Do you provide ongoing support after launch?', answer: 'Yes. All our packages include a 30-day bug-fix guarantee. Beyond that, we offer monthly maintenance packages for security updates, backups, and minor content changes to keep your site running smoothly.' },
]

const seoPlans: Plan[] = [
  {
    name: 'Local SEO',
    price: 'GH₵ 1,500',
    period: '/mo',
    description: 'Perfect for local brick-and-mortar businesses wanting to dominate Google Maps and local searches.',
    isPopular: false,
    features: ['Comprehensive Initial Audit', 'Google Business Profile Optimization', '15 Local Directory Citations/mo', 'Basic On-Page SEO (Up to 5 pages)', 'Monthly Keyword Tracking Report'].map((feature) => ({ feature })),
  },
  {
    name: 'Growth SEO',
    price: 'GH₵ 3,500',
    period: '/mo',
    description: 'Comprehensive strategy for growing brands aiming to capture national search traffic and leads.',
    isPopular: true,
    features: ['Everything in Local SEO', 'Advanced Technical Fixes', '4x SEO Blog Posts per month', 'Foundational Link Building', 'Competitor Content Gap Analysis', 'Quarterly Strategy Sessions'].map((feature) => ({ feature })),
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '/mo',
    description: 'For large e-commerce stores, news portals, or massive sites requiring highly technical interventions.',
    isPopular: false,
    features: ['Custom Crawl Budget Optimization', 'Programmatic SEO Buildout', 'High-Tier Digital PR Backlinks', 'E-commerce Taxonomy Mapping', 'Direct Line to Me, Not a Queue'].map((feature) => ({ feature })),
  },
]

const seoServices: Service[] = [
  { title: 'Technical SEO', description: 'We ensure search engines can seamlessly crawl and index your website. A fast, error-free site is the foundation of high rankings.', iconSvg: '⚙️', features: ['Site Speed & Core Web Vitals', 'Mobile Optimization', 'Crawl Error Resolution', 'Schema Markup & Structured Data'].map((feature) => ({ feature })) },
  { title: 'On-Page SEO', description: "We optimize your site's structure, copy, and meta tags to perfectly align with high-intent search queries from your customers.", iconSvg: '📄', features: ['Deep Keyword Research', 'Meta Title & Description Tuning', 'Content Readability & UX', 'Internal Linking Strategy'].map((feature) => ({ feature })) },
  { title: 'Local & Off-Page', description: 'We build your site\'s authority and prominence across the web so you dominate local "near me" searches and industry queries.', iconSvg: '🌍', features: ['Google Business Profile Setup', 'Local Directory Citations', 'High-Authority Backlink Building', 'Digital PR & Outreach'].map((feature) => ({ feature })) },
  { title: 'Content Marketing', description: "We create valuable, keyword-rich content that answers your customers' questions and establishes your brand as an industry authority.", iconSvg: '✍️', features: ['Blog Post Creation', 'Lead Magnets & Whitepapers', 'Copywriting for Landing Pages', 'Content Refreshing'].map((feature) => ({ feature })) },
]

const seoProcessSteps: ProcessStep[] = [
  { number: '1', title: 'Audit & Strategy', description: 'We deep-dive into your current rankings, competitor gaps, and technical health to build a custom roadmap.' },
  { number: '2', title: 'Technical Fixes', description: 'We repair broken links, improve load times, and ensure search engines can properly read your site.' },
  { number: '3', title: 'Content Deployment', description: 'We deploy keyword-optimized service pages, blog posts, and on-page tweaks to capture high-intent traffic.' },
  { number: '4', title: 'Authority & Reporting', description: 'We build backlinks and provide transparent monthly reports tracking your ranking improvements and ROI.' },
]

const seoFaqs: Faq[] = [
  { question: 'How long does SEO take to see results?', answer: "Unlike paid ads (PPC), SEO is a long-term strategy. Typically, it takes 3 to 6 months to start seeing significant movement in rankings and organic traffic, depending on your industry's competitiveness and your website's current history. The results, however, are highly sustainable." },
  { question: 'Do you guarantee #1 rankings on Google?', answer: "No ethical SEO agency can guarantee a #1 spot on Google, as Google's algorithms constantly change. However, we guarantee that we will implement proven, white-hat strategies that have consistently improved search visibility, traffic, and leads for our clients." },
  { question: 'Is content creation included in the retainers?', answer: 'Yes. The Growth SEO tier includes four keyword-optimized blog posts a month, written by me. On the Local SEO tier I optimize the content you already have but do not write ongoing posts.' },
  { question: "What's the difference between Local and Growth SEO?", answer: 'Local SEO is designed for businesses serving a specific geographic area (e.g., a plumber in Accra) and focuses heavily on Google Maps and local directories. Growth SEO is for businesses looking to attract a national or global audience through broader keyword targeting, aggressive content marketing, and backlink building.' },
]

const brandIdentityPlans: Plan[] = [
  {
    name: 'Logo Design',
    price: 'GH₵ 1,000',
    period: 'starting at',
    description: 'Perfect for startups or new businesses needing a fresh face.',
    isPopular: false,
    features: ['3 custom logo concepts', '3 revision rounds', 'Primary & secondary logos', 'High-res PNGs and JPGs', 'Vector files (SVG, EPS, AI)', 'Logo usage guide', '1 week delivery'].map((feature) => ({ feature })),
  },
  {
    name: 'Brand Kit',
    price: 'GH₵ 2,500',
    period: 'starting at',
    description: 'Everything you need for a consistent and professional brand.',
    isPopular: true,
    features: ['5 custom logo concepts', 'Unlimited revisions', 'Color palette selection', 'Typography pairing', 'Comprehensive Brand Guidelines PDF', 'Social media profile assets', 'Business card design', 'All vector & raster files', '2 weeks delivery'].map((feature) => ({ feature })),
  },
  {
    name: 'Full Visual Identity',
    price: 'Custom',
    period: 'per project',
    description: 'A complete design overhaul across all physical and digital mediums.',
    isPopular: false,
    features: ['Everything in Brand Kit', 'Custom iconography set', 'Letterhead & envelope design', 'Email signature design', 'Presentation (Pitch Deck) template', 'Social media post templates', 'Brand strategy consultation', 'I art direct it personally'].map((feature) => ({ feature })),
  },
]

const brandIdentityServices: Service[] = [
  { title: 'Logo Design', description: 'Custom logos that capture your brand essence and values perfectly.', iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg>' },
  { title: 'Brand Kit', description: 'Complete visual guidelines including color palettes and typography rules.', iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>' },
  { title: 'Visual Identity', description: 'Consistent design language across all physical and digital touchpoints.', iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>' },
  { title: 'Graphic Design', description: 'Pitch decks, marketing materials, social media templates, and business cards.', iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' },
]

const brandIdentityProcessSteps: ProcessStep[] = [
  { number: '01', title: 'Discovery & Strategy', description: "Research, mood boards, and defining your brand's unique positioning." },
  { number: '02', title: 'Concept Development', description: 'Sketching out initial logo ideas, drafts, and establishing visual directions.' },
  { number: '03', title: 'Design & Refinement', description: 'Finalizing the logo, curating color palettes, and selecting typography.' },
  { number: '04', title: 'Delivery & Guidelines', description: 'Handing over all vector files alongside a comprehensive brand guideline document.' },
]

const brandIdentityFaqs: Faq[] = [
  { question: 'What is a Brand Kit?', answer: "A Brand Kit is a digital package that contains your company's core visual assets. It typically includes your primary and secondary logos, a defined color palette with HEX/RGB codes, typography pairings, and a rulebook (Brand Guidelines) on how to use these assets correctly to maintain consistency." },
  { question: "Why do I need more than just a logo?", answer: "A logo is just one piece of your brand's identity. To build trust and recognition, your brand needs to look consistent across your website, social media, printed materials, and emails. A full brand identity ensures that whether a customer sees an Instagram post or a business card, they instantly recognize your company." },
  { question: 'Will I own the rights to the designs?', answer: 'Yes. Once the project is completed and final payment is made, you will have full ownership and copyright of the final logo and all associated brand assets.' },
  { question: "What if I don't like any of the initial concepts?", answer: 'Before we start designing, we go through a rigorous discovery and mood-boarding phase to align on the visual direction. In the rare case that the initial concepts miss the mark, we will revisit the drawing board and provide new concepts based on your detailed feedback.' },
  { question: 'Do you offer printing services?', answer: 'We primarily operate as a digital design agency and provide print-ready digital files (PDF, EPS, AI). However, we can coordinate with our trusted local printing partners to handle the printing of your business cards, letterheads, and merchandise upon request.' },
]

const videoProductionPlans: Plan[] = [
  {
    name: 'Reel Pack',
    price: 'GH₵ 1,500',
    period: 'one-off · 3 reels',
    description: 'Try it once. Three reels made with AI, no subscription and no commitment.',
    isPopular: false,
    features: ['3 AI reels (up to 30 seconds each)', 'Script and 2 hook options per reel', 'Burned-in captions, your logo and your colours', 'AI voiceover or licensed music', '2 revision rounds', 'Sized for Reels, TikTok and Shorts (9:16, 1:1, 16:9)', 'Delivered in about 5 working days'].map((feature) => ({ feature })),
  },
  {
    name: 'Starter',
    price: 'GH₵ 1,800',
    period: 'per month',
    description: 'Stay consistent on one platform without doing it yourself.',
    isPopular: false,
    features: ['4 short-form videos (reels) / month', '12 branded posts / month', '1 platform of your choice', 'Monthly content calendar'].map((feature) => ({ feature })),
  },
  {
    name: 'Growth',
    price: 'GH₵ 3,500',
    period: 'per month',
    description: 'Content that keeps posting and ads that bring in sales.',
    isPopular: true,
    features: ['6 short-form videos (reels) / month', '20 branded posts / month', '8 ad creatives for testing', '2 to 3 platforms, cross-posted', 'Monthly performance report'].map((feature) => ({ feature })),
  },
  {
    name: 'Scale',
    price: 'GH₵ 8,000',
    period: 'per month',
    description: 'Full coverage across every platform for brands growing fast.',
    isPopular: false,
    features: ['10 short-form videos (reels) / month', '30 branded posts / month', '12 ad creatives + paid-ad creative', 'All platforms covered', 'Advanced analytics & reporting'].map((feature) => ({ feature })),
  },
]

const videoProductionServices: Service[] = [
  { title: 'Reels & TikToks', description: 'Vertical video cut for Instagram, TikTok and YouTube Shorts. Captions burned in, the hook in the first second, sized right for every feed.', iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>' },
  { title: 'Video Ads', description: 'Short ads for Meta and TikTok, delivered as three or four different hooks so you can test which one brings sales at the lowest cost.', iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>' },
  { title: 'Product Videos', description: 'Send us photos of what you sell. We turn them into motion, so your product moves on screen instead of sitting still in a feed.', iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>' },
  { title: 'AI Presenter Videos', description: 'A voice and a face on screen without anyone filming. Licensed AI presenters, or your own likeness with your written permission.', iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>' },
]

const videoProductionProcessSteps: ProcessStep[] = [
  { number: '01', title: 'Brand kit', description: 'You send your logo, colours, product photos and the offer you want pushed. We set it up once and reuse it on every video after that.' },
  { number: '02', title: 'Script & hooks', description: 'We write the script and two or three opening hooks, and you approve them before anything is made. This is the stage where changes are cheap.' },
  { number: '03', title: 'We generate & edit', description: 'We generate the visuals and voiceover with AI, then edit by hand: pacing, captions, your logo, your colours, licensed music.' },
  { number: '04', title: 'You approve & post', description: 'You review, we fix what you flag, then you get the files sized for every platform. Nothing publishes without your yes.' },
]

const videoProductionFaqs: Faq[] = [
  { question: 'Do you film anything?', answer: 'No. There is no shoot, no camera, no crew and no location to book. Everything is made with AI tools and edited by hand. That is exactly why it costs a fraction of a shoot and lands in days instead of weeks.' },
  { question: 'Will it look fake?', answer: 'Some AI video does. Ours does not go out until it looks right. We keep shots short, we use your real product photos wherever the product is on screen, and we cut anything that reads as odd. If a scene still looks wrong to you, we replace it. You see everything before it publishes.' },
  { question: 'Do you use my actual products and branding?', answer: 'Yes. Send your logo, colours, fonts and product photos once and we build every video from them. Your product appears as your product, not a generic stand-in. If you have no photos yet we can generate product-accurate visuals, but real photos always come out better.' },
  { question: 'Can you put me, or my staff, in the videos?', answer: "Only with written permission. If you want your own face or voice used, you sign a short consent form and send us the reference material. Otherwise we use licensed AI presenters that are cleared for commercial use. We never use anybody's likeness without their say-so." },
  { question: 'How many revisions do I get, and how fast is it?', answer: 'Two revision rounds on every video, one at the script stage and one on the final cut. A one-off pack of three reels takes about five working days. Monthly plans run to a calendar you approve at the start of the month, so you always know what is coming and when.' },
  { question: 'Who owns the videos, and can I run them as paid ads?', answer: 'You do, once the invoice is paid. Full commercial rights, ads included. The music and any AI presenters are licensed for commercial use, so nothing gets pulled for a rights claim later.' },
]

const updates: {
  slug: 'webDesignPage' | 'seoPage' | 'brandIdentityPage' | 'videoProductionPage'
  services: Service[]
  steps: ProcessStep[]
  plans: Plan[]
  faqs: Faq[]
}[] = [
  { slug: 'webDesignPage', services: webDesignServices, steps: webDesignProcessSteps, plans: webDesignPlans, faqs: webDesignFaqs },
  { slug: 'seoPage', services: seoServices, steps: seoProcessSteps, plans: seoPlans, faqs: seoFaqs },
  { slug: 'brandIdentityPage', services: brandIdentityServices, steps: brandIdentityProcessSteps, plans: brandIdentityPlans, faqs: brandIdentityFaqs },
  { slug: 'videoProductionPage', services: videoProductionServices, steps: videoProductionProcessSteps, plans: videoProductionPlans, faqs: videoProductionFaqs },
]

console.log('Initializing payload...')
await payload.init({ config })
console.log('Initialized.')

for (const { slug, services, steps, plans, faqs } of updates) {
  console.log(`Fetching ${slug}...`)
  const existing = await payload.findGlobal({ slug })
  console.log(`Fetched ${slug}, updating...`)
  await payload.updateGlobal({
    slug,
    data: {
      servicesSection: {
        ...(existing.servicesSection || {}),
        services,
      },
      processSection: {
        ...(existing.processSection || {}),
        steps,
      },
      pricingSection: {
        ...(existing.pricingSection || {}),
        plans,
      },
      faqSection: {
        ...(existing.faqSection || {}),
        faqs,
      },
    },
  })
  console.log(`Updated ${slug}: ${services.length} services, ${steps.length} steps, ${plans.length} plans, ${faqs.length} faqs`)
}

process.exit(0)
