import { createClient } from '@sanity/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const client = createClient({
  projectId: 'xectqauu',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2024-03-12',
  token: process.env.SANITY_WRITE_TOKEN,
});

const offers = [
  {
    _type: 'offer',
    title: 'Free Technical SEO & Website Performance Audit',
    slug: { _type: 'slug', current: 'free-seo-audit' },
    description: "Is your website underperforming? We're offering a completely free, no-obligation audit of your website's SEO, speed, and user experience. We'll provide you with a custom roadmap to increase your traffic and conversions.",
    cta: 'Claim Free Audit',
  },
  {
    _type: 'offer',
    title: 'Get 15% Off Your First Custom Web Project',
    slug: { _type: 'slug', current: 'web-dev-discount' },
    description: "Ready to elevate your digital presence? Partner with Quadem Digital Enterprise and get 15% off your first custom web development or app design project. Valid for new clients only. Let's build something amazing together!",
    cta: 'Claim Your 15% Discount',
  },
  {
    _type: 'offer',
    title: '1 Month Free Social Media Management',
    slug: { _type: 'slug', current: 'social-media-bonus' },
    description: "Launch your new website with a bang! Book a complete Web Design package with us this month and receive 1 month of dedicated Social Media Management absolutely free to help drive immediate traffic to your new site.",
    cta: 'Claim Free Month',
  }
];

async function seed() {
  console.log('🌱 Seeding offers to Sanity...');
  try {
    for (const offer of offers) {
      console.log(`Creating offer: ${offer.title}`);
      await client.create(offer);
    }
    console.log('✅ Seeding complete!');
  } catch (error) {
    console.error('❌ Error seeding offers:', error);
  }
}

seed();
