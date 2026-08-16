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
    // Brand Studio was folded into the AI Video & Reels service page. Listed
    // here as well as in vercel.json so `astro dev` behaves like production.
    // One entry only: trailingSlash 'always' normalises this to
    // /brand-studio/, and listing both forms collides on the same route.
    '/brand-studio': '/services/video-production/',
  },
});
