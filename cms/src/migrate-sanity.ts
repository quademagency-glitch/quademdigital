// @ts-nocheck
import { config as dotenvConfig } from 'dotenv'
import path from 'path'
dotenvConfig({ path: '.env' })

import { getPayload } from 'payload'
import configPromise from './payload.config'

async function run() {
  const payload = await getPayload({ config: configPromise })

  console.log('Migrating Sanity Services...')
  const services = [
    {
      title: 'Web Design & Development',
      description: 'Custom, responsive websites built to convert visitors into loyal customers.',
      tags: [{ tag: 'Custom Websites' }, { tag: 'Landing Pages' }, { tag: 'E-commerce' }],
      iconSvg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
      order: 1
    },
    {
      title: 'Digital Marketing & Social Media',
      description: 'Engaging content and strategies to grow your audience and brand presence.',
      tags: [{ tag: 'Strategy' }, { tag: 'Content Calendar' }, { tag: 'Page Management' }],
      iconSvg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      order: 2
    },
    {
      title: 'Branding & Graphic Design',
      description: 'Distinct visual identities that make your brand memorable and professional.',
      tags: [{ tag: 'Logo Design' }, { tag: 'Brand Kit' }, { tag: 'Visual Identity' }],
      iconSvg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>',
      order: 3
    },
    {
      title: 'Video Production',
      description: 'High-quality video content to capture attention and tell your story.',
      tags: [{ tag: 'Reels & TikToks' }, { tag: 'Video Ads' }, { tag: 'Promos' }],
      iconSvg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>',
      order: 4
    },
    {
      title: 'SEO & Paid Ads',
      description: 'Targeted traffic strategies to put your brand in front of the right people.',
      tags: [{ tag: 'Google Ads' }, { tag: 'Meta Ads' }, { tag: 'Organic Ranking' }],
      iconSvg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path><path d="M12 7v5l3 3"></path></svg>',
      order: 5
    }
  ]

  for (const s of services) {
    try {
      await payload.create({ collection: 'services', data: s })
      console.log(`✅ Created service: ${s.title}`)
    } catch (err) {
      console.log(`⏭ Skipping service ${s.title} - already exists or error.`)
    }
  }

  console.log('\\nMigrating Sanity Case Studies...')
  const caseStudies = [
    {
      title: 'Revamping an Online Store for Higher Conversions',
      tag: 'E-commerce',
      description: 'We completely redesigned the user experience, leading to a massive spike in sales.',
      resultMetric: '300%',
      resultText: 'Increase in website traffic',
      order: 1
    },
    {
      title: 'Scaling User Acquisition with Targeted Ads',
      tag: 'SaaS Startup',
      description: 'Implemented a multi-channel ad strategy to bring in high-quality leads.',
      resultMetric: '50%',
      resultText: 'Reduction in CPA',
      order: 2
    },
    {
      title: 'Complete Brand Identity & Local SEO',
      tag: 'Local Business',
      description: 'Built a fresh brand from the ground up and dominated local search results.',
      resultMetric: '#1',
      resultText: 'Ranking for core keywords',
      order: 3
    }
  ]

  for (const c of caseStudies) {
    try {
      await payload.create({ collection: 'caseStudies', data: c })
      console.log(`✅ Created case study: ${c.title}`)
    } catch (err) {
      console.log(`⏭ Skipping case study ${c.title}.`)
    }
  }

  console.log('\\nMigrating Sanity Blog Categories & Posts...')
  const categories = [
    { title: 'Digital Marketing', description: 'Tips and strategies for growing your brand online.' },
    { title: 'Web Design', description: 'Modern web design trends, best practices, and inspiration.' },
    { title: 'Business Growth', description: 'Strategies to scale your business in the digital age.' },
  ]

  const categoryIds = []
  for (const cat of categories) {
    try {
      const created = await payload.create({ collection: 'blogCategories', data: cat })
      console.log(`✅ Created category: ${cat.title}`)
      categoryIds.push(created.id)
    } catch (err) {
      console.log(`⏭ Error/exists for category ${cat.title}. Fetching existing...`)
      const existing = await payload.find({ collection: 'blogCategories', where: { title: { equals: cat.title } } })
      if (existing.docs.length > 0) categoryIds.push(existing.docs[0].id)
    }
  }

  const posts = [
    {
      title: '5 Signs Your Business Needs a Website Redesign in 2026',
      excerpt: 'Your website is your digital storefront. If it is not converting visitors into customers, it might be time for a refresh. Here are the tell-tale signs.',
      category: categoryIds[1],
      author: 'Quadem Digital',
      publishedAt: '2026-06-01T09:00:00Z',
      seoDescription: 'Is your website outdated? Learn the 5 key signs that indicate your business needs a website redesign to stay competitive in 2026.',
      body: [
        { _type: 'block', _key: 'intro1', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's1', text: "Your website is often the first impression potential customers have of your business. In a world where 75% of users judge a company's credibility based on their website design, having an outdated or poorly performing site can directly impact your bottom line.", marks: [] }] },
      ],
    },
    {
      title: 'Why Every Nigerian Business Needs Social Media Marketing in 2026',
      excerpt: "With over 40 million active social media users in Nigeria, businesses that aren't leveraging these platforms are leaving money on the table.",
      category: categoryIds[0],
      author: 'Quadem Digital',
      publishedAt: '2026-05-25T09:00:00Z',
      seoDescription: 'Discover why social media marketing is essential for Nigerian businesses in 2026 and how to build an effective strategy.',
      body: [
        { _type: 'block', _key: 'intro1', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's1', text: "Nigeria's digital landscape is booming. With over 40 million active social media users and mobile internet penetration growing rapidly, the opportunity for businesses to reach customers online has never been greater.", marks: [] }] },
      ]
    },
  ]

  for (const post of posts) {
    try {
      await payload.create({ collection: 'blogPosts', data: post as any })
      console.log(`✅ Created post: ${post.title}`)
    } catch (err) {
      console.log(`⏭ Skipping post ${post.title}.`)
    }
  }

  console.log('\\n🎉 Sanity to Payload Migration Complete!')
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
