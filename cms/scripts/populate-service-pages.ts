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
    features: ['Unlimited products', 'Secure payment gateway integration', 'Inventory management', 'User accounts & dashboards', 'Custom app functionality', 'Advanced analytics', 'Dedicated project manager', 'Ongoing maintenance options'].map((feature) => ({ feature })),
  },
]

const webDesignFaqs: Faq[] = [
  { question: 'How long does it take to build a website?', answer: 'A standard corporate website typically takes 3 to 4 weeks from discovery to launch. Landing pages can be delivered in a week, while complex e-commerce or custom web apps may take 6 to 12 weeks depending on scope.' },
  { question: 'What platforms do you build on?', answer: 'We choose the best stack for your needs. For blazing-fast content sites, we use Astro or Next.js. For e-commerce, we utilize Shopify or custom solutions. For easy content management, we can integrate WordPress or modern headless CMS solutions like Payload CMS.' },
  { question: 'Do I need to provide the content?', answer: "It's completely up to you! If you have text and images, we can use them. If not, our in-house copywriters and designers can create professional content tailored to your brand for an additional fee." },
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
    features: ['Custom Crawl Budget Optimization', 'Programmatic SEO Buildout', 'High-Tier Digital PR Backlinks', 'E-commerce Taxonomy Mapping', 'Dedicated Account Manager'].map((feature) => ({ feature })),
  },
]

const seoFaqs: Faq[] = [
  { question: 'How long does SEO take to see results?', answer: "Unlike paid ads (PPC), SEO is a long-term strategy. Typically, it takes 3 to 6 months to start seeing significant movement in rankings and organic traffic, depending on your industry's competitiveness and your website's current history. The results, however, are highly sustainable." },
  { question: 'Do you guarantee #1 rankings on Google?', answer: "No ethical SEO agency can guarantee a #1 spot on Google, as Google's algorithms constantly change. However, we guarantee that we will implement proven, white-hat strategies that have consistently improved search visibility, traffic, and leads for our clients." },
  { question: 'Is content creation included in the retainers?', answer: 'Yes! Our Growth SEO tier includes four high-quality, keyword-optimized blog posts per month written by our expert copywriters. For the Local SEO tier, we optimize existing content but do not write ongoing blog posts.' },
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
    features: ['Everything in Brand Kit', 'Custom iconography set', 'Letterhead & envelope design', 'Email signature design', 'Presentation (Pitch Deck) template', 'Social media post templates', 'Brand strategy consultation', 'Dedicated art director'].map((feature) => ({ feature })),
  },
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
    name: 'Starter',
    price: 'GH₵ 1,500',
    period: 'per video',
    description: 'Perfect for small businesses and personal brands getting started with video.',
    isPopular: false,
    features: ['1 professional video (up to 60 seconds)', 'Scriptwriting & storyboarding', 'Professional filming (1 location)', 'Basic color grading & editing', 'Licensed background music', '2 revision rounds', 'Delivery in MP4 (1080p)', 'Social media aspect ratios (16:9, 9:16, 1:1)'].map((feature) => ({ feature })),
  },
  {
    name: 'Professional',
    price: 'GH₵ 3,000',
    period: 'per video',
    description: 'Ideal for growing businesses that need standout video content consistently.',
    isPopular: true,
    features: ['1 professional video (up to 90 seconds)', 'Scriptwriting & storyboarding', 'Professional filming (up to 2 locations)', 'Advanced color grading & editing', 'Motion graphics & lower thirds', 'Licensed music & SFX', 'Drone / aerial footage', '3 revision rounds', 'Delivery in 1080p & 4K', 'Thumbnail design'].map((feature) => ({ feature })),
  },
  {
    name: 'Premium',
    price: 'Custom',
    period: 'per project',
    description: 'Full-scale cinematic productions for brands that demand the best.',
    isPopular: false,
    features: ['Multiple videos per project', 'Full creative direction & strategy', 'Unlimited filming locations', 'Cinematic color grading', 'Advanced motion graphics & VFX', 'Custom animations & intros/outros', 'Voice-over talent', 'Sound design & mixing', 'All formats including 4K HDR', 'Raw footage delivery', 'Dedicated video producer'].map((feature) => ({ feature })),
  },
]

const videoProductionFaqs: Faq[] = [
  { question: 'How long does a typical video project take?', answer: 'Most projects take 2-4 weeks from concept to final delivery. This includes scripting, filming, and post-production. Expedited timelines are available at an additional cost for time-sensitive projects.' },
  { question: 'What equipment do you use?', answer: 'We shoot with cinema-grade cameras, professional lighting rigs, stabilizers, and wireless audio equipment. For aerial shots, we use licensed commercial drones. All post-production is done with industry-standard software.' },
  { question: 'Can I be involved in the creative process?', answer: 'Absolutely! We collaborate closely with you at every stage — from the initial brief and storyboard approval to reviewing rough cuts. Your input is essential to making sure the final product is exactly what you envisioned.' },
  { question: 'Do you handle scriptwriting?', answer: "Yes! Scriptwriting is included in all our packages. We develop the script based on your goals, target audience, and key messages. You'll review and approve the script before we begin filming." },
  { question: 'What formats do you deliver in?', answer: 'We deliver in all standard formats including MP4, MOV, and platform-optimized exports for Instagram, TikTok, YouTube, LinkedIn, and more. 4K and HDR options are available with our Professional and Premium packages.' },
  { question: 'Do you provide raw footage?', answer: 'Raw footage delivery is included in our Premium package. For Starter and Professional plans, raw footage can be provided as an add-on at an additional cost.' },
]

const updates: { slug: 'webDesignPage' | 'seoPage' | 'brandIdentityPage' | 'videoProductionPage'; plans: Plan[]; faqs: Faq[] }[] = [
  { slug: 'webDesignPage', plans: webDesignPlans, faqs: webDesignFaqs },
  { slug: 'seoPage', plans: seoPlans, faqs: seoFaqs },
  { slug: 'brandIdentityPage', plans: brandIdentityPlans, faqs: brandIdentityFaqs },
  { slug: 'videoProductionPage', plans: videoProductionPlans, faqs: videoProductionFaqs },
]

await payload.init({ config })

for (const { slug, plans, faqs } of updates) {
  const existing = await payload.findGlobal({ slug })
  await payload.updateGlobal({
    slug,
    data: {
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
  console.log(`Updated ${slug}: ${plans.length} plans, ${faqs.length} faqs`)
}

process.exit(0)
