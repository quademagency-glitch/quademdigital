import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://quademdigital.com',
  output: 'server',
  trailingSlash: 'always',
  /*
    Hosted on Cloudflare Workers. src/worker.ts (set as `main` in
    wrangler.jsonc) wraps Astro with the security headers, the www redirect,
    the 60s edge cache and the crons that vercel.json used to provide.
    Images are resized by the Cloudflare Images binding, because sharp cannot
    run inside a Worker.
  */
  adapter: cloudflare({
    imageService: 'cloudflare-binding',
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
