import { createClient } from '@sanity/client';

const sanityClient = createClient(
  { "apiVersion": "2023-05-03", "projectId": "xectqauu", "dataset": "production", "useCdn": false }
);

globalThis.sanityClient = sanityClient;

export { sanityClient as s };
