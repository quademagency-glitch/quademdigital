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
  redirects: {
    '/services/branding--graphic-design': '/services/brand-identity/',
    '/services/web-design--development': '/services/web-design/',
    '/services/digital-marketing--social-media': '/services/seo/',
    '/services/seo--paid-ads': '/services/seo/',
  },
});
