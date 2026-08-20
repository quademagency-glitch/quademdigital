#!/usr/bin/env node
/**
 * Em-dash guard.
 *
 * Ernest does not want em dashes in anything a person reads: they read as
 * AI-written. They were cleared once from the whole site and CMS, but nothing
 * stops the next one being typed, and most of the copy lives in the Payload
 * database rather than the repo, so a source-only check misses most of it.
 *
 * This checks both:
 *   - source, but only strings that actually ship. Code comments are ignored,
 *     because an em dash in an explanatory comment reaches nobody and rewriting
 *     comments to satisfy a linter damages documentation.
 *   - every Payload collection and global, over REST.
 *
 *   node scripts/check-em-dashes.mjs             # source + CMS, exits 1 if any
 *   node scripts/check-em-dashes.mjs --source    # source only, no network
 *   node scripts/check-em-dashes.mjs --cms       # CMS only
 *
 * The CMS half needs PUBLIC_PAYLOAD_URL and PAYLOAD_API_KEY from the repo-root
 * .env. Without them it reports the CMS as skipped rather than passing, so a
 * missing key can never look like a clean result.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const EM = '—';
const EXTS = new Set(['.astro', '.ts', '.tsx', '.js', '.jsx', '.md']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.astro', '.vercel', 'legacy_scripts']);

const args = new Set(process.argv.slice(2));
const wantSource = !args.has('--cms');
const wantCms = !args.has('--source');

/* ---------------------------------------------------------------- source -- */

/**
 * Strip comments so only shipping copy is flagged. Tracks block comments across
 * lines, since `/* ... *\/` and `<!-- ... -->` spanning several lines is exactly
 * where the long explanatory notes live.
 */
function shippingLines(text) {
  const out = [];
  let inBlock = false;
  text.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    const wasInBlock = inBlock;
    const opens = (trimmed.match(/\/\*|<!--|\{\/\*/g) || []).length;
    const closes = (trimmed.match(/\*\/|-->/g) || []).length;
    if (opens > closes) inBlock = true;
    else if (closes > 0) inBlock = false;

    if (wasInBlock || inBlock) return;
    if (/^(\/\/|\*|\/\*|<!--|\{\/\*)/.test(trimmed)) return;
    if (!line.includes(EM)) return;

    // Trailing `// note` on a line of real code.
    const slash = line.indexOf('//');
    if (slash !== -1 && slash < line.indexOf(EM)) return;

    out.push({ line: i + 1, text: trimmed.slice(0, 110) });
  });
  return out;
}

function walkDir(dir, hits) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walkDir(full, hits);
    } else if (EXTS.has(extname(name))) {
      const found = shippingLines(readFileSync(full, 'utf8'));
      for (const f of found) hits.push({ file: relative(ROOT, full), ...f });
    }
  }
  return hits;
}

/* ------------------------------------------------------------------- CMS -- */

const COLLECTIONS = [
  'blogCategories', 'blogPosts', 'calculatorServices', 'caseStudies',
  'emailCampaigns', 'faqs', 'offers', 'pages', 'pricingPlans', 'processSteps',
  'services', 'stats', 'tags', 'testimonials', 'webapps', 'onboarding-guides',
];
const GLOBALS = [
  'about', 'brandIdentityPage', 'contactPage', 'homepage', 'projectsPage',
  'quaderpPage', 'seoPage', 'servicesPage', 'siteSettings',
  'videoProductionPage', 'webDesignPage',
];

function readEnv() {
  const file = join(ROOT, '.env');
  if (!existsSync(file)) return {};
  const env = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

/** Walk any JSON shape and report the path of every string holding an em dash. */
function findInJson(node, path, hits) {
  if (typeof node === 'string') {
    if (node.includes(EM)) {
      const i = node.indexOf(EM);
      hits.push({ path, text: node.slice(Math.max(0, i - 60), i + 40).replace(/\s+/g, ' ') });
    }
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => findInJson(v, `${path}[${i}]`, hits));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) findInJson(v, path ? `${path}.${k}` : k, hits);
  }
  return hits;
}

async function scanCms() {
  const env = { ...readEnv(), ...process.env };
  const base = (env.PUBLIC_PAYLOAD_URL || '').replace(/\/$/, '');
  const key = env.PAYLOAD_API_KEY;
  if (!base || !key) return { skipped: true, hits: [] };

  const headers = { Authorization: `users API-Key ${key}` };
  const hits = [];
  const endpoints = [
    ...COLLECTIONS.map((c) => [c, `${base}/api/${c}?limit=200&depth=0`]),
    ...GLOBALS.map((g) => [g, `${base}/api/globals/${g}?depth=0`]),
  ];

  for (const [name, url] of endpoints) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        hits.push({ path: `${name} (HTTP ${res.status})`, text: 'could not read, treat as unknown' });
        continue;
      }
      findInJson(await res.json(), name, hits);
    } catch (err) {
      hits.push({ path: `${name} (unreachable)`, text: String(err.message || err) });
    }
  }
  return { skipped: false, hits };
}

/* ------------------------------------------------------------------ main -- */

let failed = false;
let cmsSkipped = false;

if (wantSource) {
  const hits = walkDir(join(ROOT, 'src'), []);
  console.log(`Source (shipping copy only): ${hits.length}`);
  for (const h of hits) console.error(`  ${h.file}:${h.line}  ${h.text}`);
  if (hits.length) failed = true;
}

if (wantCms) {
  const { skipped, hits } = await scanCms();
  if (skipped) {
    cmsSkipped = true;
    console.log('CMS: skipped, PUBLIC_PAYLOAD_URL or PAYLOAD_API_KEY not set');
  } else {
    console.log(`CMS content: ${hits.length}`);
    for (const h of hits) console.error(`  ${h.path}\n      ...${h.text}`);
    if (hits.length) failed = true;
  }
}

if (failed) {
  console.error('\nEm dashes found in copy people read.');
  console.error('Replace each one deliberately: a colon for labels and subject lines,');
  console.error('a comma or full stop in prose. A blanket swap to commas makes run-ons.');
  process.exit(1);
}

// Most of the copy lives in the database, so "source is clean" is not the same
// as "clean". Saying so here would be the exact failure this repo keeps hitting:
// a green result that only checked half of what it claimed.
if (cmsSkipped) {
  console.error('\nSource is clean, but the CMS was NOT checked, and most copy lives there.');
  console.error('Set PUBLIC_PAYLOAD_URL and PAYLOAD_API_KEY, then run again.');
  process.exit(2);
}

console.log('\nClean. No em dashes in anything a person reads.');
process.exit(0);
