import { createClient } from '@sanity/client';

const client = createClient({
  projectId: 'xectqauu',
  dataset: 'production',
  apiVersion: '2023-05-03',
  useCdn: false,
  token: process.env.SANITY_TOKEN
});

async function seedBlog() {
  console.log('🌱 Seeding blog categories...');
  
  // Create categories
  const categories = [
    { _type: 'blogCategory', title: 'Digital Marketing', slug: { current: 'digital-marketing' }, description: 'Tips and strategies for growing your brand online.' },
    { _type: 'blogCategory', title: 'Web Design', slug: { current: 'web-design' }, description: 'Modern web design trends, best practices, and inspiration.' },
    { _type: 'blogCategory', title: 'Business Growth', slug: { current: 'business-growth' }, description: 'Strategies to scale your business in the digital age.' },
  ];
  
  const createdCategories = [];
  for (const cat of categories) {
    const existing = await client.fetch(`*[_type == "blogCategory" && slug.current == $slug][0]`, { slug: cat.slug.current });
    if (existing) {
      console.log(`  ⏭  Category "${cat.title}" already exists`);
      createdCategories.push(existing);
    } else {
      const created = await client.create(cat);
      console.log(`  ✅ Created category: ${cat.title}`);
      createdCategories.push(created);
    }
  }
  
  console.log('\n📝 Seeding blog posts...');
  
  const posts = [
    {
      _type: 'blogPost',
      title: '5 Signs Your Business Needs a Website Redesign in 2026',
      slug: { current: '5-signs-business-needs-website-redesign' },
      excerpt: 'Your website is your digital storefront. If it is not converting visitors into customers, it might be time for a refresh. Here are the tell-tale signs.',
      category: { _type: 'reference', _ref: createdCategories[1]._id },
      author: 'Quadem Digital',
      publishedAt: '2026-06-01T09:00:00Z',
      seoDescription: 'Is your website outdated? Learn the 5 key signs that indicate your business needs a website redesign to stay competitive in 2026.',
      body: [
        { _type: 'block', _key: 'intro1', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's1', text: 'Your website is often the first impression potential customers have of your business. In a world where 75% of users judge a company\'s credibility based on their website design, having an outdated or poorly performing site can directly impact your bottom line.', marks: [] }] },
        { _type: 'block', _key: 'h1', style: 'h2', markDefs: [], children: [{ _type: 'span', _key: 's2', text: '1. Your Site Isn\'t Mobile-Responsive', marks: [] }] },
        { _type: 'block', _key: 'p1', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's3', text: 'Over 60% of web traffic now comes from mobile devices. If your website doesn\'t look and function perfectly on smartphones and tablets, you\'re losing more than half your potential audience. A mobile-responsive redesign isn\'t optional — it\'s essential.', marks: [] }] },
        { _type: 'block', _key: 'h2', style: 'h2', markDefs: [], children: [{ _type: 'span', _key: 's4', text: '2. Your Bounce Rate Is Over 50%', marks: [] }] },
        { _type: 'block', _key: 'p2', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's5', text: 'A high bounce rate means visitors are landing on your site and immediately leaving. This could be due to slow load times, confusing navigation, or outdated design. Modern websites should load in under 3 seconds and guide visitors naturally toward a call to action.', marks: [] }] },
        { _type: 'block', _key: 'h3', style: 'h2', markDefs: [], children: [{ _type: 'span', _key: 's6', text: '3. Your Branding Has Evolved', marks: [] }] },
        { _type: 'block', _key: 'p3', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's7', text: 'If you\'ve updated your logo, color palette, or brand voice but your website still reflects the old identity, there\'s a disconnect. Your website should be the most accurate representation of your current brand.', marks: [] }] },
        { _type: 'block', _key: 'h4', style: 'h2', markDefs: [], children: [{ _type: 'span', _key: 's8', text: '4. You Can\'t Update Content Easily', marks: [] }] },
        { _type: 'block', _key: 'p4', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's9', text: 'If making a simple text change requires a developer, your site lacks a proper CMS. Modern platforms like our Sanity-powered builds let you update everything — from hero text to blog posts — without touching code.', marks: [] }] },
        { _type: 'block', _key: 'h5', style: 'h2', markDefs: [], children: [{ _type: 'span', _key: 's10', text: '5. Your Competitors Look Better', marks: [] }] },
        { _type: 'block', _key: 'p5', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's11', text: 'If your competitors\' websites feel more professional, faster, and more engaging, you\'re losing the comparison game. Your website should be your competitive advantage, not your weakness.', marks: [] }] },
        { _type: 'block', _key: 'cta', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's12', text: 'Ready for a redesign? Contact Quadem Digital for a free strategy call and we\'ll audit your current site, then propose a design that converts.', marks: ['strong'] }] },
      ],
    },
    {
      _type: 'blogPost',
      title: 'Why Every Nigerian Business Needs Social Media Marketing in 2026',
      slug: { current: 'nigerian-business-social-media-marketing' },
      excerpt: 'With over 40 million active social media users in Nigeria, businesses that aren\'t leveraging these platforms are leaving money on the table.',
      category: { _type: 'reference', _ref: createdCategories[0]._id },
      author: 'Quadem Digital',
      publishedAt: '2026-05-25T09:00:00Z',
      seoDescription: 'Discover why social media marketing is essential for Nigerian businesses in 2026 and how to build an effective strategy.',
      body: [
        { _type: 'block', _key: 'intro1', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's1', text: 'Nigeria\'s digital landscape is booming. With over 40 million active social media users and mobile internet penetration growing rapidly, the opportunity for businesses to reach customers online has never been greater.', marks: [] }] },
        { _type: 'block', _key: 'h1', style: 'h2', markDefs: [], children: [{ _type: 'span', _key: 's2', text: 'The Numbers Don\'t Lie', marks: [] }] },
        { _type: 'block', _key: 'p1', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's3', text: 'Instagram, TikTok, and WhatsApp are the dominant platforms in Nigeria. Businesses that post consistently and engage with their audience see 3-5x more leads than those relying solely on word-of-mouth. The cost per lead on social media is also significantly lower than traditional advertising.', marks: [] }] },
        { _type: 'block', _key: 'h2', style: 'h2', markDefs: [], children: [{ _type: 'span', _key: 's4', text: 'Content Is King — But Strategy Is Queen', marks: [] }] },
        { _type: 'block', _key: 'p2', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's5', text: 'Posting random content without a strategy is like throwing darts blindfolded. A successful social media plan includes: content calendars, audience targeting, engagement metrics tracking, and paid ad campaigns optimized for your specific goals.', marks: [] }] },
        { _type: 'block', _key: 'h3', style: 'h2', markDefs: [], children: [{ _type: 'span', _key: 's6', text: 'The Quadem Approach', marks: [] }] },
        { _type: 'block', _key: 'p3', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's7', text: 'At Quadem Digital, we don\'t just manage your social media — we build a growth engine. From content creation and graphic design to paid ads and influencer partnerships, we handle everything so you can focus on running your business.', marks: [] }] },
        { _type: 'block', _key: 'cta', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's8', text: 'Ready to grow your brand on social media? Book a free strategy call with our team today.', marks: ['strong'] }] },
      ],
    },
    {
      _type: 'blogPost',
      title: 'How to Choose the Right Digital Agency for Your Business',
      slug: { current: 'how-to-choose-right-digital-agency' },
      excerpt: 'Choosing a digital agency is one of the most important decisions for your brand. Here\'s what to look for and the red flags to avoid.',
      category: { _type: 'reference', _ref: createdCategories[2]._id },
      author: 'Quadem Digital',
      publishedAt: '2026-05-18T09:00:00Z',
      seoDescription: 'A practical guide to choosing the right digital agency for your business. Learn what to look for, questions to ask, and red flags to avoid.',
      body: [
        { _type: 'block', _key: 'intro1', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's1', text: 'The right digital agency can transform your business. The wrong one can waste your budget and set you back months. With hundreds of agencies claiming to be the best, how do you actually choose? Here\'s our honest guide.', marks: [] }] },
        { _type: 'block', _key: 'h1', style: 'h2', markDefs: [], children: [{ _type: 'span', _key: 's2', text: '1. Look at Their Own Website', marks: [] }] },
        { _type: 'block', _key: 'p1', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's3', text: 'If an agency\'s own website looks outdated, loads slowly, or feels generic — that\'s a red flag. Their website is their portfolio piece. If they can\'t make themselves look good, how will they make you look good?', marks: [] }] },
        { _type: 'block', _key: 'h2', style: 'h2', markDefs: [], children: [{ _type: 'span', _key: 's4', text: '2. Check Their Case Studies', marks: [] }] },
        { _type: 'block', _key: 'p2', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's5', text: 'Real results beat fancy promises. A good agency will show you before-and-after metrics: traffic growth, conversion improvements, revenue impact. If they only show pretty designs without measurable outcomes, they might prioritize aesthetics over results.', marks: [] }] },
        { _type: 'block', _key: 'h3', style: 'h2', markDefs: [], children: [{ _type: 'span', _key: 's6', text: '3. Understand Their Process', marks: [] }] },
        { _type: 'block', _key: 'p3', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's7', text: 'A professional agency has a clear process: discovery, strategy, design, development, launch, and ongoing optimization. If they jump straight to design without understanding your business goals, that\'s concerning.', marks: [] }] },
        { _type: 'block', _key: 'h4', style: 'h2', markDefs: [], children: [{ _type: 'span', _key: 's8', text: '4. Ask About Communication', marks: [] }] },
        { _type: 'block', _key: 'p4', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's9', text: 'How often will they update you? What tools do they use for project management? Will you have a dedicated account manager? Clear communication is the foundation of a successful agency-client relationship.', marks: [] }] },
        { _type: 'block', _key: 'h5', style: 'h2', markDefs: [], children: [{ _type: 'span', _key: 's10', text: '5. Trust Your Gut', marks: [] }] },
        { _type: 'block', _key: 'p5', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's11', text: 'After all the research, trust your instinct. The best agency partnerships feel collaborative, not transactional. You should feel heard, understood, and confident in their ability to deliver.', marks: [] }] },
        { _type: 'block', _key: 'cta', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's12', text: 'At Quadem Digital, we believe in transparency, results, and partnership. Book a free strategy call and see if we\'re the right fit for your brand.', marks: ['strong'] }] },
      ],
    },
  ];
  
  for (const post of posts) {
    const existing = await client.fetch(`*[_type == "blogPost" && slug.current == $slug][0]`, { slug: post.slug.current });
    if (existing) {
      console.log(`  ⏭  Post "${post.title}" already exists`);
    } else {
      await client.create(post);
      console.log(`  ✅ Created post: ${post.title}`);
    }
  }
  
  console.log('\n🎉 Blog seeding complete!');
}

seedBlog().catch(console.error);
