import { createClient } from '@sanity/client';

const client = createClient({
  projectId: 'xectqauu',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2024-03-01'
});

async function main() {
  const doc = await client.fetch(`*[_type == "caseStudy" && slug.current == "revamping-online-store"][0]`);
  console.dir(doc, { depth: null });
}
main().catch(console.error);
