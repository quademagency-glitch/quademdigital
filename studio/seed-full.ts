import { getCliClient } from 'sanity/cli'

const client = getCliClient()

async function seedFull() {
  console.log('Seeding siteSettings...')
  await client.createOrReplace({
    _id: 'siteSettings',
    _type: 'siteSettings',
    title: 'Quadem Digital Enterprise',
    description: 'Quadem Digital Enterprise is a full-service digital agency offering web design, digital marketing, branding, video production, and SEO services.',
    email: 'hello@quademdigital.com',
    whatsappNumber: '1234567890',
    socialLinks: {
      linkedin: 'https://linkedin.com',
      instagram: 'https://instagram.com',
      twitter: 'https://twitter.com'
    },
    footerTagline: 'Elevating brands with premium design and data-driven strategies.'
  })

  console.log('Seeding stats...')
  const stats = [
    { value: 150, label: 'Projects Delivered', order: 1 },
    { value: 98, label: 'Happy Clients', order: 2 },
    { value: 5, label: 'Services Offered', order: 3 },
    { value: 7, label: 'Years Active', order: 4 }
  ]
  for (const s of stats) {
    await client.create({ _type: 'stat', ...s })
  }

  console.log('Seeding process steps...')
  const steps = [
    { stepNumber: 1, title: 'Discover', description: 'We learn your business, goals, and target audience inside out.' },
    { stepNumber: 2, title: 'Strategy', description: 'We build a tailored roadmap and design system for your project.' },
    { stepNumber: 3, title: 'Execute', description: 'We design, build, and deliver your solution at the highest standard.' },
    { stepNumber: 4, title: 'Deliver', description: 'You get results, training, reports, and ongoing growth support.' }
  ]
  for (const s of steps) {
    await client.create({ _type: 'processStep', ...s })
  }

  console.log('Seeding pricing plans...')
  const plans = [
    { name: 'Starter', price: 'Custom', description: 'Perfect for small businesses needing a strong foundation.', features: ['Single service focus', 'Basic branding & design', 'Standard 5-page website', '1 month post-launch support'], isPopular: false, buttonText: 'Get Started', order: 1 },
    { name: 'Growth', price: 'Custom', description: 'The ideal bundle for scaling your online presence quickly.', features: ['2–3 services bundled', 'Advanced custom website', 'Complete brand identity kit', '3 months SEO & Marketing', 'Priority support channel'], isPopular: true, buttonText: 'Book a Call', order: 2 },
    { name: 'Premium', price: 'Retainer', description: 'Your dedicated, full-scale digital agency partner.', features: ['All services included', 'Continuous ad management', 'Weekly content creation', 'Advanced analytics & reporting', 'Dedicated account manager'], isPopular: false, buttonText: "Let's Talk", order: 3 }
  ]
  for (const p of plans) {
    await client.create({ _type: 'pricingPlan', ...p })
  }

  console.log('Seeding testimonials...')
  const testimonials = [
    { authorName: 'Sarah Jenkins', authorRole: 'CEO, TechFlow', quote: 'Quadem completely transformed our digital presence. Since launching the new site, our inbound leads have doubled. Highly recommend!', stars: 5, order: 1 },
    { authorName: 'David Chen', authorRole: 'Founder, Urban Eats', quote: 'The branding and social media strategy they delivered was spot on. They truly understand how to speak to our audience.', stars: 5, order: 2 },
    { authorName: 'Emma Williams', authorRole: 'Marketing Director, LuxLife', quote: 'Professional, fast, and extremely talented. Their video production team made our ad campaign an absolute hit.', stars: 5, order: 3 }
  ]
  for (const t of testimonials) {
    await client.create({ _type: 'testimonial', ...t })
  }

  console.log('Seeding servicesPage and projectsPage...')
  await client.createOrReplace({
    _id: 'servicesPage',
    _type: 'servicesPage',
    title: 'Our Services',
    subtitle: 'Comprehensive digital solutions to scale your business and dominate your market.'
  })
  
  await client.createOrReplace({
    _id: 'projectsPage',
    _type: 'projectsPage',
    title: 'Featured Work',
    subtitle: 'Real results for real businesses. See how we\'ve helped our clients grow.'
  })

  // Note: homepage already exists, we will update it manually in Studio or leave the fields empty and fallback to defaults in Astro if missing.
  console.log('Seeding complete!')
}

seedFull().catch(console.error)
