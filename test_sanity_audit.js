import { createClient } from '@sanity/client';

const client = createClient({
  projectId: 'xectqauu',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2024-03-01'
});

const types = [
  'homepage', 'about', 'siteSettings', 'service', 'caseStudy',
  'stat', 'processStep', 'pricingPlan', 'testimonial', 'faq',
  'calculatorService', 'blogPost', 'blogCategory', 'page',
  'contactPage', 'servicesPage', 'projectsPage', 'clientPortal', 'emailCampaign'
];

async function audit() {
  console.log('=== SANITY CMS CONTENT AUDIT ===\n');
  
  for (const type of types) {
    const docs = await client.fetch(`*[_type == "${type}"]`);
    const count = docs.length;
    const status = count > 0 ? '✅' : '⚠️  EMPTY';
    console.log(`${status} ${type}: ${count} document(s)`);
    
    // For singleton docs, show key fields
    if (count === 1 && ['homepage', 'about', 'siteSettings', 'contactPage'].includes(type)) {
      const doc = docs[0];
      const keys = Object.keys(doc).filter(k => !k.startsWith('_'));
      const filled = keys.filter(k => doc[k] !== null && doc[k] !== undefined && doc[k] !== '');
      const empty = keys.filter(k => doc[k] === null || doc[k] === undefined || doc[k] === '');
      console.log(`     Fields filled: ${filled.length}/${keys.length} — Empty: [${empty.join(', ')}]`);
    }
    
    // For array docs, show titles
    if (count > 0 && ['service', 'caseStudy', 'testimonial', 'blogPost', 'pricingPlan', 'faq', 'calculatorService', 'stat', 'processStep'].includes(type)) {
      docs.forEach(d => {
        const label = d.title || d.name || d.question || d.label || d.quote?.substring(0, 40) || 'untitled';
        console.log(`     → ${label}`);
      });
    }
  }
  
  // Check CDN vs API freshness
  console.log('\n=== CDN vs LIVE API FRESHNESS TEST ===');
  const cdnClient = createClient({
    projectId: 'xectqauu',
    dataset: 'production',
    useCdn: true,
    apiVersion: '2024-03-01'
  });
  
  const liveSettings = await client.fetch(`*[_type == "siteSettings"][0]._updatedAt`);
  const cdnSettings = await cdnClient.fetch(`*[_type == "siteSettings"][0]._updatedAt`);
  console.log(`Live API _updatedAt: ${liveSettings}`);
  console.log(`CDN      _updatedAt: ${cdnSettings}`);
  if (liveSettings === cdnSettings) {
    console.log('✅ CDN is in sync with live API');
  } else {
    console.log('⚠️  CDN is stale — may take a few minutes to catch up');
  }
}

audit().catch(console.error);
