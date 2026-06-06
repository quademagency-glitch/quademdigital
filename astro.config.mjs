import { defineConfig } from 'astro/config';
import sanity from '@sanity/astro';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://quademdigital.com',
  output: 'server',
  adapter: vercel({
    webAnalytics: { enabled: true },
  }),
  integrations: [
    sanity({
      projectId: 'xectqauu',
      dataset: 'production',
      useCdn: false, // Use live API for instant content updates
      apiVersion: '2023-05-03',
    }),
    sitemap(),
  ],
});
