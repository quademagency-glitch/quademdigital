import { createClient } from '@sanity/client';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const client = createClient({
  projectId: 'xectqauu',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2023-05-03',
  token: process.env.SANITY_WRITE_TOKEN,
});

async function seedWebapps() {
  const webapps = [
    {
      _type: 'webapp',
      name: 'QuadERP',
      tagline: 'The Ultimate Inventory & Operations Hub',
      description: 'A powerful, all-in-one Enterprise Resource Planning system built for modern retail. Track inventory, manage sales, and optimize operations from a single dashboard.',
      link: '/store-manager',
      status: 'Live',
      order: 1,
    },
    {
      _type: 'webapp',
      name: 'BrandEngine',
      tagline: 'AI-Powered Brand Asset Generation',
      description: 'Generate stunning, brand-aligned visual assets and marketing copy in seconds. BrandEngine uses advanced AI to ensure perfect consistency across all your digital channels.',
      link: '#',
      status: 'In Development',
      order: 2,
    }
  ];

  console.log('Seeding webapps...');
  for (const app of webapps) {
    try {
      const result = await client.create(app);
      console.log(`✅ Created webapp: ${result.name}`);
    } catch (err) {
      console.error(`❌ Failed to create ${app.name}:`, err);
    }
  }
  console.log('Done!');
}

seedWebapps();
