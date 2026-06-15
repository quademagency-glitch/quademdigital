import { config as dotenvConfig } from 'dotenv'
import path from 'path'
dotenvConfig({ path: '.env' })

import { getPayload } from 'payload'
import configPromise from './payload.config'

async function run() {
  const payload = await getPayload({ config: configPromise })

  console.log('Migrating Offers...')
  const offers = [
    {
      title: 'Free Technical SEO & Website Performance Audit',
      description: "Is your website underperforming? We're offering a completely free, no-obligation audit of your website's SEO, speed, and user experience. We'll provide you with a custom roadmap to increase your traffic and conversions.",
      cta: 'Claim Free Audit',
    },
    {
      title: 'Get 15% Off Your First Custom Web Project',
      description: "Ready to elevate your digital presence? Partner with Quadem Digital Enterprise and get 15% off your first custom web development or app design project. Valid for new clients only. Let's build something amazing together!",
      cta: 'Claim Your 15% Discount',
    },
    {
      title: '1 Month Free Social Media Management',
      description: "Launch your new website with a bang! Book a complete Web Design package with us this month and receive 1 month of dedicated Social Media Management absolutely free to help drive immediate traffic to your new site.",
      cta: 'Claim Free Month',
    }
  ]

  for (const offer of offers) {
    try {
      await payload.create({ collection: 'offers', data: offer as any })
      console.log(`✅ Created offer: ${offer.title}`)
    } catch (err) {
      console.log(`⏭ Skipping offer ${offer.title}`)
    }
  }

  console.log('\\nMigrating Calculator Services...')
  const calcServices = [
    { name: 'Web Design & Development', priceUSD: 5000, priceGHS: 57500, order: 1 },
    { name: 'Branding & Identity', priceUSD: 3500, priceGHS: 40000, order: 2 },
    { name: 'SEO & Content', priceUSD: 2500, priceGHS: 28500, billingCycle: ' / mo', order: 3 },
    { name: 'Video Production', priceUSD: 4000, priceGHS: 46000, order: 4 }
  ]

  for (const calc of calcServices) {
    try {
      await payload.create({ collection: 'calculatorServices', data: { name: calc.name, price: calc.priceUSD.toString(), order: calc.order } })
      console.log(`✅ Created calculator service: ${calc.name}`)
    } catch (err) {
      console.log(`⏭ Skipping calculator service ${calc.name}`)
    }
  }

  console.log('\\nMigrating Homepage Global...')
  try {
    await payload.updateGlobal({
      slug: 'homepage',
      data: {
        heroHeadline: 'We ',
        heroTagline: 'Elevating brands with premium design and data-driven strategies.',
        heroServices: [
          { service: 'build websites' },
          { service: 'grow brands' },
          { service: 'create content' },
          { service: 'run your ads' },
          { service: 'design identities' }
        ]
      } as any
    })
    console.log('✅ Updated Homepage')
  } catch (err) {
    console.log('⏭ Error updating Homepage')
  }

  console.log('\\n🎉 Final Migration Complete!')
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
