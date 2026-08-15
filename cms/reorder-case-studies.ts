import { getPayload } from 'payload';
import configPromise from './src/payload.config';

async function run() {
  console.log(`Using NODE_ENV: ${process.env.NODE_ENV}`);
  const payload = await getPayload({ config: configPromise });

  const docs = await payload.find({
    collection: 'caseStudies',
    limit: 100,
  });

  // Target these to be primary (lower order)
  const primaryProjects = [
    'Omek Storefront',
    'QuadERP Landing',
    'SAN Collection',
    'Quajo Speaks',
    'QuadBrand'
  ];

  for (const doc of docs.docs) {
    let newOrder = 100; // Default low priority
    const title = doc.title;
    
    if (primaryProjects.includes(title)) {
      newOrder = primaryProjects.indexOf(title) + 1; // 1, 2, 3, 4, 5
    }

    // Default body if not present
    let newBody = doc.body;
    if (!newBody || (typeof newBody === 'object' && Object.keys(newBody).length === 0)) {
      // Create a simple generic Lexical rich text structure or simple JSON object since it's just type 'json'
      // Payload Rich Text (Lexical) simple paragraph:
      newBody = {
        root: {
          type: 'root',
          format: '',
          indent: 0,
          version: 1,
          children: [
            {
              type: 'paragraph',
              format: '',
              indent: 0,
              version: 1,
              children: [
                {
                  type: 'text',
                  mode: 'normal',
                  text: `Detailed case study for ${title}. We analyzed the market, designed a custom solution tailored to the brand's needs, and deployed a highly scalable and robust system. More details and full breakdown coming soon!`,
                  style: '',
                  detail: 0,
                  format: 0,
                  version: 1
                }
              ]
            }
          ]
        }
      };
    }

    console.log(`Updating ${title} -> Order: ${newOrder}`);
    try {
      await payload.update({
        collection: 'caseStudies',
        id: doc.id,
        data: {
          order: newOrder,
          body: newBody
        }
      });
      console.log(`✅ Updated ${title}`);
    } catch (err: any) {
      console.error(`❌ Failed to update ${title}: ${err.message}`);
    }
  }
  
  console.log('Done!');
  process.exit(0);
}

run().catch(console.error);
