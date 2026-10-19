#!/usr/bin/env node
/**
 * Voice guard: the site sells results, not the founder, the location or the
 * size of the business.
 *
 * Ernest, 19 October 2026: "I am not enthused about founder led this or that.
 * I don't like location being mentioned. Those are not what converts. Let's
 * build the site to talk about what results we intend to give our clients."
 * The same review moved the site from "I" to "we" and dropped every line that
 * made Quadem sound small ("one person", "not an account manager"). Quadem is
 * Ernest alone, so the opposite failure matters as much: no "our team", no
 * account managers, nobody invented.
 *
 * Copy lives in the repo and in the CMS, so this checks both, the same way
 * scripts/check-em-dashes.mjs does: shipping strings only in the repo (code
 * comments are ignored), and the public collections and globals over REST.
 *
 * Not checked, on purpose: blog posts and case studies (Ernest's own voice, and
 * a client's location is part of its story), the client portal, quotes,
 * invoices and signing pages (private, transactional), and structured data.
 *
 * A line that genuinely needs one of these words carries `voice-ok` in a
 * comment on the same line.
 *
 *   node scripts/check-voice.mjs            # repo and CMS, exits 1 if any
 *   node scripts/check-voice.mjs --source   # repo only, no network
 *
 * Exit 0 clean, 1 a finding, 2 the CMS could not be read (not a pass).
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SOURCE_ONLY = process.argv.includes('--source');

const RULES = [
  [/founder[- ]led/i, 'founder-led selling'],
  [/led by our founder|work(?:ing)? directly with ernest|direct with ernest|ask ernest|meet the founder|(?:get|talk to|work with) the founder/i, 'founder selling'],
  [/\bone[- ]person\b/i, 'sounds small'],
  [/not an account manager/i, 'sounds small'],
  [/\bour team\b|\bteam of\b|\baccount manager\b|\bproject manager\b|\bin-house\b/i, 'invents people Quadem does not have'],
  [/made in accra|\bin accra\b|based in (?:accra|ghana)|built for ghana|ghana (?:and|&) worldwide/i, 'location selling'],
];

/* ---------------------------------------------------------------- source -- */

const EXTS = new Set(['.astro', '.ts', '.tsx', '.js', '.jsx']);
// privacy: a privacy notice must say who the business is and where, by law.
const SKIP_DIRS = new Set(['node_modules', 'dist', '.astro', 'portal', 'quote', 'invoice', 'sign', 'api', 'pitch', 'wardrobe', 'blog', 'privacy']);
const SCAN_DIRS = ['src'];

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
    if (/voice-ok/.test(line)) return;
    const code = line.replace(/\/\/.*$/, '');
    for (const [re, why] of RULES) if (re.test(code)) out.push({ line: i + 1, why, text: trimmed.slice(0, 110) });
  });
  return out;
}

function walk(dir, hits) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, hits);
    else if (EXTS.has(extname(name))) for (const f of shippingLines(readFileSync(full, 'utf8'))) hits.push({ where: `${relative(ROOT, full)}:${f.line}`, why: f.why, text: f.text });
  }
  return hits;
}

/* ------------------------------------------------------------------- CMS -- */

const GLOBALS = ['homepage', 'about', 'contactPage', 'servicesPage', 'webDesignPage', 'seoPage', 'videoProductionPage'];
const COLLECTIONS = ['services', 'faqs', 'processSteps', 'pricingPlans', 'offers'];
const RETIRED_SERVICES = new Set(['branding-graphic-design']);

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

function findInJson(node, path, hits) {
  if (typeof node === 'string') {
    for (const [re, why] of RULES) {
      const m = node.match(re);
      if (m) hits.push({ where: path, why, text: node.slice(Math.max(0, m.index - 50), m.index + 60).replace(/\s+/g, ' ') });
    }
  } else if (Array.isArray(node)) node.forEach((v, i) => findInJson(v, `${path}[${i}]`, hits));
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) findInJson(v, path ? `${path}.${k}` : k, hits);
  return hits;
}

async function scanCms() {
  const env = { ...readEnv(), ...process.env };
  const base = (env.PUBLIC_PAYLOAD_URL || '').replace(/\/$/, '');
  const key = env.PAYLOAD_API_KEY;
  if (!base || !key) return null;
  const headers = { Authorization: `users API-Key ${key}` };
  const hits = [];
  for (const g of GLOBALS) {
    const res = await fetch(`${base}/api/globals/${g}?depth=0`, { headers });
    if (!res.ok) return null;
    findInJson(await res.json(), g, hits);
  }
  for (const c of COLLECTIONS) {
    const res = await fetch(`${base}/api/${c}?limit=200&depth=0`, { headers });
    if (!res.ok) return null;
    const docs = ((await res.json()).docs || []).filter((d) =>
      !(c === 'services' && RETIRED_SERVICES.has(d.slug)) && !(c === 'pricingPlans' && d.active === false));
    for (const d of docs) findInJson(d, `${c}/${d.slug || d.name || d.id}`, hits);
  }
  return hits;
}

/* ------------------------------------------------------------------ main -- */

const sourceHits = SCAN_DIRS.flatMap((d) => (existsSync(join(ROOT, d)) ? walk(join(ROOT, d), []) : []));
let cmsHits = [];
if (!SOURCE_ONLY) {
  const got = await scanCms();
  if (got === null) {
    console.log(`Source: ${sourceHits.length} finding(s).`);
    for (const h of sourceHits) console.log(`  ${h.where}  [${h.why}]  ${h.text}`);
    console.log('Could NOT read the CMS (need PUBLIC_PAYLOAD_URL and PAYLOAD_API_KEY in .env). That is not a pass.');
    process.exit(2);
  }
  cmsHits = got;
}

console.log(`Source: ${sourceHits.length} finding(s).`);
for (const h of sourceHits) console.log(`  ${h.where}  [${h.why}]  ${h.text}`);
if (!SOURCE_ONLY) {
  console.log(`CMS: ${cmsHits.length} finding(s).`);
  for (const h of cmsHits) console.log(`  ${h.where}  [${h.why}]  ${h.text}`);
}
if (sourceHits.length || cmsHits.length) {
  console.log('\nThe site talks about the results clients get: no founder selling, no location,');
  console.log('nothing that makes Quadem sound small, and no people it does not have.');
  process.exit(1);
}
console.log('Clean. The site sells results.');
