#!/usr/bin/env node
/*
  Every bespoke blog route needs a matching CMS document, and vice versa.

  The blog index (src/pages/blog/index.astro) and the RSS feed
  (src/pages/rss.xml.ts) are driven entirely by the Payload `blogPosts`
  collection. Neither of them can see a file. So an analysis piece written as a
  static .astro route is invisible in both unless a blogPosts document exists
  with the same slug, whose only job is to supply the card and the feed item.

  Astro matches static route segments ahead of dynamic ones, so the file always
  wins the URL and blog/[slug].astro never serves it. That is the mechanism, not
  an accident.

  What this guard catches. Change the slug on the CMS document and the index and
  the feed start linking a URL where blog/[slug].astro finds a post with an
  empty body, and renders a near-blank article. It fails quietly and it looks
  like a rendering bug rather than a data problem, which is the expensive kind
  of failure. Delete the CMS document and the page simply disappears from both
  surfaces with nothing on the page to show for it.

  Exit codes follow scripts/check-em-dashes.mjs, and the distinction matters:
    0  every route pairs with a document
    1  a real mismatch
    2  could not check, because the CMS was unreachable or the key is missing.
       Not a pass.

  Usage:  node scripts/check-blog-routes.mjs
*/

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLOG_DIR = join(ROOT, 'src', 'pages', 'blog');

// Routes that are the blog machinery itself, not articles.
const MACHINERY = new Set(['index.astro', '[slug].astro']);

function readEnv() {
    const out = {};
    const file = join(ROOT, '.env');
    if (!existsSync(file)) return out;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
    return out;
}

function bespokeRoutes() {
    if (!existsSync(BLOG_DIR)) return [];
    return readdirSync(BLOG_DIR)
        .filter((f) => f.endsWith('.astro'))
        // The external drive scatters AppleDouble sidecars; they are not routes.
        .filter((f) => !f.startsWith('._'))
        .filter((f) => !MACHINERY.has(f))
        .map((f) => f.replace(/\.astro$/, ''))
        .sort();
}

const env = { ...readEnv(), ...process.env };
const base = env.PUBLIC_PAYLOAD_URL;
const key = env.PAYLOAD_API_KEY;

const routes = bespokeRoutes();

if (routes.length === 0) {
    console.log('No bespoke blog routes. Nothing to check.');
    process.exit(0);
}

if (!base || !key) {
    console.log(`Bespoke blog routes found: ${routes.length}`);
    for (const r of routes) console.log(`  UNREAD  /blog/${r}/`);
    console.log('\nCould NOT check: PUBLIC_PAYLOAD_URL or PAYLOAD_API_KEY missing from .env.');
    console.log('This is NOT a clean result. Run it somewhere with the keys present.');
    process.exit(2);
}

// draft=true so a document staged ahead of a deploy still counts as present.
// A route whose document is deliberately held back as a draft is correct; a
// route with no document at all is not.
let docs;
try {
    const res = await fetch(`${base}/api/blogPosts?limit=500&depth=0&draft=true`, {
        headers: { Authorization: `users API-Key ${key}` },
    });
    if (!res.ok) {
        console.log(`Could NOT check: the CMS answered HTTP ${res.status}.`);
        console.log('This is NOT a clean result and it is NOT a list of problems.');
        process.exit(2);
    }
    docs = (await res.json()).docs ?? [];
} catch (err) {
    console.log(`Could NOT check: ${err.message}`);
    console.log('This is NOT a clean result and it is NOT a list of problems.');
    process.exit(2);
}

const bySlug = new Map(docs.map((d) => [d.slug, d]));
const problems = [];

for (const route of routes) {
    const doc = bySlug.get(route);
    if (!doc) {
        problems.push(
            `/blog/${route}/ has no blogPosts document with slug "${route}".\n` +
            `      The page works, but it is absent from the blog index and the RSS feed,\n` +
            `      so nobody finds it. Create the document, slug spelled exactly this way.`
        );
        continue;
    }
    // A document paired with a file must not carry body copy: the file renders
    // the page, so anything typed into the document is written and never seen.
    const hasBody = (doc.content && Object.keys(doc.content).length > 0) || (doc.body && Object.keys(doc.body).length > 0);
    if (hasBody) {
        problems.push(
            `/blog/${route}/ has a blogPosts document that also holds body copy.\n` +
            `      The static route renders the page, so that copy is invisible. Keep the\n` +
            `      document to title, slug, excerpt, publishedAt, coverImage and category.`
        );
    }
}

console.log(`Bespoke blog routes: ${routes.length}. CMS documents: ${docs.length}.`);
for (const route of routes) {
    const doc = bySlug.get(route);
    const status = !doc ? 'NO DOCUMENT' : doc._status === 'draft' ? 'draft, not yet live' : 'published';
    console.log(`  /blog/${route}/  ${status}`);
}

if (problems.length > 0) {
    console.log('');
    for (const p of problems) console.log(`  ${p}`);
    console.log('\nRoutes and documents have drifted apart.');
    process.exit(1);
}

console.log('\nEvery bespoke route pairs with a document.');
process.exit(0);
