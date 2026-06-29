import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://quademdigital.com',
  output: 'server',
  trailingSlash: 'always',
  adapter: vercel({
    webAnalytics: { enabled: true },
  }),
  integrations: [
    react(),
  ],
});
