import { getPayload } from 'payload';
import configPromise from './src/payload.config';
import { config as dotenvConfig } from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenvConfig();

interface Project {
  collection: 'webapps' | 'caseStudies';
  field: string;
  title: string; // Used for name or title
  url: string;
  description?: string;
  tag?: string;
  filePath?: string;
}

const projects: Project[] = [
  { collection: 'webapps', field: 'name', title: 'Omek Admin', url: 'https://admin.omekgh.com', description: 'Internal admin dashboard for Omek.', tag: 'Internal Tool' },
  { collection: 'webapps', field: 'name', title: 'QuadERP Store Manager', url: 'https://app.quaderp.app', description: 'Store management dashboard for QuadERP.', tag: 'SaaS' },
  { collection: 'caseStudies', field: 'title', title: 'Omek Storefront', url: 'https://www.omekgh.com', description: 'E-commerce storefront for Omek.', tag: 'E-commerce' },
  { collection: 'caseStudies', field: 'title', title: 'QuadERP Landing', url: 'https://www.quaderp.app', description: 'Landing page and marketing site for QuadERP.', tag: 'SaaS' },
  { collection: 'caseStudies', field: 'title', title: 'SAN Collection', url: 'https://san-collection.vercel.app', description: 'Fashion e-commerce website for SAN Collection.', tag: 'E-commerce' },
  { collection: 'caseStudies', field: 'title', title: 'Quajo Speaks', url: 'https://quajospeaks.vercel.app', description: 'Personal branding and portfolio for Quajo.', tag: 'Personal Brand' },
  { collection: 'caseStudies', field: 'title', title: 'QuadBrand', url: 'https://quadbrand.vercel.app', description: 'Brand identity platform for QuadBrand.', tag: 'Branding' },
];

async function run() {
  console.log(`Using NODE_ENV: ${process.env.NODE_ENV}`);
  const payload = await getPayload({ config: configPromise });

  for (const proj of projects) {
    console.log(`\n--- Processing ${proj.title} ---`);
    
    // 1. Create or Find Document
    let docId;
    const existing = await payload.find({
      collection: proj.collection as any,
      where: { [proj.field]: { equals: proj.title } },
      limit: 1
    });

    if (existing.docs.length > 0) {
      docId = existing.docs[0].id;
      console.log(`Found existing document for ${proj.title} (ID: ${docId})`);
    } else {
      console.log(`Creating new document for ${proj.title}...`);
      const newData = proj.collection === 'caseStudies' 
        ? { title: proj.title, description: proj.description, tag: proj.tag, slug: proj.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), resultMetric: '100%', resultText: 'Completed' }
        : { name: proj.title, description: proj.description, url: proj.url };
      
      const newDoc = await payload.create({
        collection: proj.collection as any,
        data: newData
      });
      docId = newDoc.id;
      console.log(`Created document for ${proj.title} (ID: ${docId})`);
    }

    // 2. Fetch Screenshot via Microlink
    console.log(`Getting screenshot for ${proj.url} via Microlink...`);
    try {
      const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(proj.url)}&screenshot=true&meta=false&waitForTimeout=2000`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      
      if (data.status === 'success' && data.data && data.data.screenshot && data.data.screenshot.url) {
        const imageUrl = data.data.screenshot.url;
        console.log(`Downloading screenshot from ${imageUrl}...`);
        
        const imageRes = await fetch(imageUrl);
        const imageBuffer = await imageRes.arrayBuffer();
        
        const filePath = path.join('/tmp', `${proj.title.replace(/\s+/g, '-')}.jpg`);
        fs.writeFileSync(filePath, Buffer.from(imageBuffer));
        
        // 3. Upload to Payload Media
        console.log(`Uploading media for ${proj.title}...`);
        const fileBuffer = fs.readFileSync(filePath);
        const mediaDoc = await payload.create({
          collection: 'media',
          data: { alt: `${proj.title} Cover Image` },
          file: {
            data: fileBuffer,
            name: `${proj.title.replace(/\s+/g, '-')}-${Date.now()}.jpg`,
            mimetype: 'image/jpeg',
            size: fileBuffer.byteLength
          }
        });
        
        console.log(`Media uploaded, ID: ${mediaDoc.id}. Updating ${proj.collection}...`);
        
        // 4. Update Document with coverImage
        await payload.update({
          collection: proj.collection as any,
          id: docId,
          data: { coverImage: mediaDoc.id }
        });
        console.log(`Successfully updated ${proj.title} with new cover image!`);
      } else {
        console.error(`Failed to get screenshot for ${proj.title}: API returned no image.`);
      }
    } catch (err: any) {
      console.error(`Failed to process screenshot/upload for ${proj.title}: ${err.message}`);
    }
  }
  
  console.log('\nFinished capture and upload process.');
  process.exit(0);
}

run().catch(console.error);
