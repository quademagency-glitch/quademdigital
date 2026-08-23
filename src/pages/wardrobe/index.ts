import type { APIRoute } from 'astro';
// The Wardrobe Theatre campaign preview, exactly as it was sent in the pitch
// bundle: a finished, self-contained document with its own fonts, CSS and
// reveal script. Rebuilding it as an .astro component would put it through
// Astro's style scoping and change the markup that was signed off, so the
// file ships byte for byte and this route just hands it over.
//
// It lives here rather than in public/ because Astro's dev server will not
// resolve /wardrobe/ to a directory index the way Vercel does, and a link
// going to a client should behave the same locally as it does in production.
// The leading underscore keeps Astro from treating the .html as a route of
// its own, so the page has exactly one URL.
import html from './_campaign-preview.html?raw';

export const GET: APIRoute = () =>
  new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
