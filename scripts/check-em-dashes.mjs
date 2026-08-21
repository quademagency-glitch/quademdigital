#!/usr/bin/env node
/**
 * Em-dash guard.
 *
 * Ernest does not want em dashes in anything a person reads: they read as
 * AI-written. They were cleared once from the whole site and CMS, but nothing
 * stops the next one being typed, and most of the copy lives in the Payload
 * database rather than the repo, so a source-only check misses most of it.
 *
 * Copy lives in three places, so this checks all three:
 *   - the repo, but only strings that actually ship. Code comments are ignored,
 *     because an em dash in an explanatory comment reaches nobody and rewriting
 *     comments to satisfy a linter damages documentation. The exception is an
 *     HTML comment in a .astro template: `<!-- ... -->` is emitted into the
 *     served markup and shows in View Source, so it does reach a person. Use
 *     `{/* ... *\/}` instead, which Astro strips at build. The rest of the site
 *     read clean while three such comments shipped on every single page.
 *   - every Payload collection and global, over REST.
 *   - every Resend template, which is where the automated emails actually live.
 *     A repo-only check called the site clean while four of the five templates
 *     that email every lead still had em dashes in them.
 *
 *   node scripts/check-em-dashes.mjs             # all three, exits 1 if any
 *   node scripts/check-em-dashes.mjs --source    # repo only, no network
 *   node scripts/check-em-dashes.mjs --cms       # Payload content only
 *   node scripts/check-em-dashes.mjs --resend    # automated email templates only
 *
 * The network halves need PUBLIC_PAYLOAD_URL, PAYLOAD_API_KEY and RESEND_API_KEY
 * from the repo-root .env. Without them it exits 2 and says what went unchecked,
 * so a missing key can never look like a clean result.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const EM = '—';
const EXTS = new Set(['.astro', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.md']);
const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.astro', '.vercel', 'legacy_scripts',
  // Generated, not authored: Payload rewrites these and their em dashes come
  // from field descriptions already checked at their source.
  'migrations',
]);
const SKIP_FILES = new Set(['payload-types.ts', 'check-em-dashes.mjs']);

/**
 * Directories holding copy that reaches a person. `cms/` matters as much as
 * `src/`: the seed scripts write straight into the database, and
 * `cms/src/utils/aiEmailGenerator.ts` drafts client emails with an LLM.
 */
const SCAN_DIRS = ['src', 'cms/src', 'cms/scripts', 'scripts'];

const args = new Set(process.argv.slice(2));
const only = args.has('--source') || args.has('--cms') || args.has('--resend');
const wantSource = !only || args.has('--source');
const wantCms = !only || args.has('--cms');
const wantResend = !only || args.has('--resend');

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

    // A line may legitimately need the character: the AI prompt that tells the
    // model never to emit one has to show it, and so does the strip that
    // removes it. Mark those with `em-dash-ok` in a comment on the same line.
    if (/em-dash-ok/.test(line)) return;

    out.push({ line: i + 1, text: trimmed.slice(0, 110) });
  });
  return out;
}

/**
 * An HTML comment in an Astro template is not a private note: Astro emits it
 * into the served page, so it ships to every visitor and shows in View Source.
 * `shippingLines` deliberately skips comments, which made these invisible to
 * the check even though they are the one kind of comment that does ship.
 */
function shippingHtmlComments(text) {
  const out = [];
  for (const m of text.matchAll(/<!--[\s\S]*?-->/g)) {
    if (!m[0].includes(EM) || /em-dash-ok/.test(m[0])) continue;
    out.push({
      line: text.slice(0, m.index).split('\n').length,
      text: `ships in the HTML, use {/* ... */} instead: ${m[0].replace(/\s+/g, ' ').slice(0, 90)}`,
    });
  }
  return out;
}

function walkDir(dir, hits) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || SKIP_FILES.has(name) || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walkDir(full, hits);
    } else if (EXTS.has(extname(name))) {
      const src = readFileSync(full, 'utf8');
      const found = shippingLines(src);
      if (extname(name) === '.astro') found.push(...shippingHtmlComments(src));
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

/* ---------------------------------------------------------------- Resend -- */

/**
 * The Day 1/3/7 nurture emails and the lead auto-reply are Resend templates,
 * not repo files. They go to every lead and were invisible to a repo-only
 * check: four of the five held em dashes while the site read clean.
 *
 * Templates are versioned. A PATCH creates an unpublished draft and the live
 * copy keeps sending until POST /templates/{id}/publish, so this reads the
 * published document and also reports anything left unpublished.
 */
async function scanResend() {
  const env = { ...readEnv(), ...process.env };
  const key = env.RESEND_API_KEY;
  if (!key) return { skipped: true, hits: [] };

  const headers = { Authorization: `Bearer ${key}` };
  const hits = [];
  try {
    const listRes = await fetch('https://api.resend.com/templates', { headers });
    if (!listRes.ok) {
      return { skipped: false, hits: [{ path: `templates (HTTP ${listRes.status})`, text: 'could not list' }] };
    }
    for (const t of (await listRes.json()).data || []) {
      const res = await fetch(`https://api.resend.com/templates/${t.id}`, { headers });
      if (!res.ok) {
        hits.push({ path: `${t.name} (HTTP ${res.status})`, text: 'could not read' });
        continue;
      }
      const doc = await res.json();
      for (const field of ['subject', 'html', 'text']) {
        const v = doc[field];
        if (typeof v === 'string' && v.includes(EM)) {
          const i = v.indexOf(EM);
          hits.push({
            path: `${doc.name}.${field}`,
            text: v.slice(Math.max(0, i - 60), i + 40).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '),
          });
        }
      }
      if (doc.has_unpublished_versions) {
        hits.push({ path: `${doc.name}`, text: 'has an UNPUBLISHED draft; live sends still use the old copy' });
      }
    }
  } catch (err) {
    hits.push({ path: 'resend (unreachable)', text: String(err.message || err) });
  }
  return { skipped: false, hits };
}

/* ------------------------------------------------------------------ main -- */

let failed = false;
let cmsSkipped = false;
let resendSkipped = false;

if (wantSource) {
  const hits = [];
  for (const d of SCAN_DIRS) {
    const full = join(ROOT, d);
    if (existsSync(full)) walkDir(full, hits);
  }
  console.log(`Source (shipping copy only, ${SCAN_DIRS.join(' + ')}): ${hits.length}`);
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

if (wantResend) {
  const { skipped, hits } = await scanResend();
  if (skipped) {
    resendSkipped = true;
    console.log('Resend templates: skipped, RESEND_API_KEY not set');
  } else {
    console.log(`Resend templates: ${hits.length}`);
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
if (cmsSkipped || resendSkipped) {
  const missing = [
    cmsSkipped && 'the CMS (most page copy lives there)',
    resendSkipped && 'Resend templates (every automated email lives there)',
  ].filter(Boolean);
  console.error(`\nWhat was checked is clean, but ${missing.join(' and ')} could NOT be checked.`);
  console.error('Set the missing keys in .env, then run again. This is not a pass.');
  process.exit(2);
}

console.log('\nClean. No em dashes in anything a person reads.');
process.exit(0);
