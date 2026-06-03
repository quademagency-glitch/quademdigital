import { defineConfig } from 'astro/config';
import sanity from '@sanity/astro';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://quademdigital.vercel.app',
  output: 'server',
  adapter: vercel({
    webAnalytics: { enabled: true },
  }),
  integrations: [
    sanity({
      projectId: 'xectqauu',
      dataset: 'production',
      useCdn: false, // set to false for fresh data
      apiVersion: '2023-05-03',
    }),
    sitemap(),
  ],
});
