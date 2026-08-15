import { getPayload } from 'payload';
import configPromise from './src/payload.config';

async function run() {
  console.log(`Using NODE_ENV: ${process.env.NODE_ENV}`);
  const payload = await getPayload({ config: configPromise });

  // Fix webapps: only set link (skip status since it's an enum in production DB)
  console.log('\n=== Fixing webapp links ===');
  const webappFixes: Record<string, string> = {
    'Omek Admin': 'https://admin.omekgh.com',
    'QuadERP Store Manager': 'https://app.quaderp.app',
  };

  const webapps = await payload.find({
    collection: 'webapps' as any,
    limit: 50,
  });

  for (const app of webapps.docs) {
    const name = (app as any).name;
    const link = webappFixes[name];
    if (link) {
      console.log(`Fixing webapp: ${name} -> link: ${link}`);
      try {
        await payload.update({
          collection: 'webapps' as any,
          id: app.id,
          data: { link } as any,
        });
        console.log(`✅ Updated ${name}`);
      } catch (err: any) {
        console.error(`❌ Failed to update ${name}: ${err.message}`);
      }
    }
  }

  console.log('\nDone!');
  process.exit(0);
}

run().catch(console.error);
