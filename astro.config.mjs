import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://quademdigital.com',
  output: 'server',
  trailingSlash: 'always',
  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
  adapter: vercel({
    webAnalytics: { enabled: true },
  }),
  integrations: [
    react(),
  ],
  /*
    Redirects are not listed here any more. They live in the CMS `redirects`
    collection and are served by src/middleware.ts, which runs in `astro dev`
    too, so dev and production stay in step without a second copy.
  */
});
