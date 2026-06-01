import { defineConfig } from 'astro/config';
import sanity from '@sanity/astro';

// https://astro.build/config
export default defineConfig({
  integrations: [
    sanity({
      projectId: 'xectqauu',
      dataset: 'production',
      useCdn: false, // set to false for fresh data
      apiVersion: '2023-05-03',
    }),
  ],
});
