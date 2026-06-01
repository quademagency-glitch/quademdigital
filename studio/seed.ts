import { getCliClient } from 'sanity/cli'

const client = getCliClient()

async function seed() {
  console.log('Seeding data...')
  
  // 1. Homepage
  await client.createOrReplace({
    _id: 'homepage',
    _type: 'homepage',
    heroHeadline: 'We ',
    heroTagline: 'Elevating brands with premium design and data-driven strategies.',
    heroServices: [
      'build websites',
      'grow brands',
      'create content',
      'run your ads',
      'design identities'
    ]
  })
  console.log('Created Homepage.')

  // 2. Services
  const services = [
    {
      _type: 'service',
      title: 'Web Design & Development',
      description: 'Custom, responsive websites built to convert visitors into loyal customers.',
      tags: ['Custom Websites', 'Landing Pages', 'E-commerce'],
      iconSvg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
      order: 1
    },
    {
      _type: 'service',
      title: 'Digital Marketing & Social Media',
      description: 'Engaging content and strategies to grow your audience and brand presence.',
      tags: ['Strategy', 'Content Calendar', 'Page Management'],
      iconSvg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      order: 2
    },
    {
      _type: 'service',
      title: 'Branding & Graphic Design',
      description: 'Distinct visual identities that make your brand memorable and professional.',
      tags: ['Logo Design', 'Brand Kit', 'Visual Identity'],
      iconSvg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>',
      order: 3
    },
    {
      _type: 'service',
      title: 'Video Production',
      description: 'High-quality video content to capture attention and tell your story.',
      tags: ['Reels & TikToks', 'Video Ads', 'Promos'],
      iconSvg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>',
      order: 4
    },
    {
      _type: 'service',
      title: 'SEO & Paid Ads',
      description: 'Targeted traffic strategies to put your brand in front of the right people.',
      tags: ['Google Ads', 'Meta Ads', 'Organic Ranking'],
      iconSvg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path><path d="M12 7v5l3 3"></path></svg>',
      order: 5
    }
  ]
  
  for (const s of services) {
    await client.create(s)
    console.log(`Created service: ${s.title}`)
  }

  // 3. Case Studies
  const caseStudies = [
    {
      _type: 'caseStudy',
      title: 'Revamping an Online Store for Higher Conversions',
      slug: { _type: 'slug', current: 'revamping-online-store' },
      tag: 'E-commerce',
      description: 'We completely redesigned the user experience, leading to a massive spike in sales.',
      resultMetric: '300%',
      resultText: 'Increase in website traffic',
      order: 1
    },
    {
      _type: 'caseStudy',
      title: 'Scaling User Acquisition with Targeted Ads',
      slug: { _type: 'slug', current: 'scaling-user-acquisition' },
      tag: 'SaaS Startup',
      description: 'Implemented a multi-channel ad strategy to bring in high-quality leads.',
      resultMetric: '50%',
      resultText: 'Reduction in CPA',
      order: 2
    },
    {
      _type: 'caseStudy',
      title: 'Complete Brand Identity & Local SEO',
      slug: { _type: 'slug', current: 'complete-brand-identity' },
      tag: 'Local Business',
      description: 'Built a fresh brand from the ground up and dominated local search results.',
      resultMetric: '#1',
      resultText: 'Ranking for core keywords',
      order: 3
    }
  ]

  for (const c of caseStudies) {
    await client.create(c)
    console.log(`Created case study: ${c.title}`)
  }

  console.log('Seeding complete!')
}

seed().catch(err => {
  console.error(err)
  process.exit(1)
})
