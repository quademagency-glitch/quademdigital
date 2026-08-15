import { getPayload } from 'payload';
import configPromise from './src/payload.config';

async function run() {
  console.log(`Using NODE_ENV: ${process.env.NODE_ENV}`);
  const payload = await getPayload({ config: configPromise });

  // 1. Fix ALL case studies: set published = true
  console.log('\n=== Setting all case studies to published ===');
  const caseStudies = await payload.find({
    collection: 'caseStudies' as any,
    limit: 50,
  });

  for (const study of caseStudies.docs) {
    console.log(`Publishing: ${(study as any).title} (ID: ${study.id}, was published: ${(study as any).published})`);
    await payload.update({
      collection: 'caseStudies' as any,
      id: study.id,
      data: { published: true } as any,
    });
  }
  console.log(`✅ Published ${caseStudies.docs.length} case studies.`);

  // 2. Fix webapps: set correct links and status
  console.log('\n=== Fixing webapp links and status ===');
  const webappFixes: Record<string, { link: string; status: string }> = {
    'Omek Admin': { link: 'https://admin.omekgh.com', status: 'Live' },
    'QuadERP Store Manager': { link: 'https://app.quaderp.app', status: 'Live' },
  };

  const webapps = await payload.find({
    collection: 'webapps' as any,
    limit: 50,
  });

  for (const app of webapps.docs) {
    const name = (app as any).name;
    const fix = webappFixes[name];
    if (fix) {
      console.log(`Fixing webapp: ${name} -> link: ${fix.link}, status: ${fix.status}`);
      await payload.update({
        collection: 'webapps' as any,
        id: app.id,
        data: { link: fix.link, status: fix.status } as any,
      });
    }
  }
  console.log(`✅ Fixed ${webapps.docs.length} webapps.`);

  console.log('\nDone! All projects are now published and linked.');
  process.exit(0);
}

run().catch(console.error);
