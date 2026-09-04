#!/usr/bin/env node
/**
 * Content Security Policy guard.
 *
 * The site sends a strict CSP from vercel.json. `astro dev` does not apply
 * vercel.json headers, so a page that loads anything hosted elsewhere looks
 * perfect on this machine and is broken the moment it is live, silently, with
 * the only evidence in the console of whoever opened the link.
 *
 * That is not hypothetical. The Wardrobe Theatre pitch page shipped with its
 * teaser on a CloudFront bucket and its type from fonts.googleapis.com. The
 * video was refused outright and every heading fell back to system type. Both
 * passed every check this repo had, because none of them knew what the policy
 * said.
 *
 * The policy is read out of vercel.json rather than copied here, so there is
 * one copy of it and this check cannot drift from what production sends.
 *
 *   node scripts/check-csp.mjs            # the repo, exits 1 on a violation
 *   node scripts/check-csp.mjs --url=URL  # a live page, judged against the CSP
 *                                         # that page actually returns. Reads
 *                                         # rendered markup, so it sees CMS
 *                                         # content the repo scan cannot.
 *   node scripts/check-csp.mjs --policy   # print the parsed policy and stop
 *
 * Not checked: connect-src. Telling a browser fetch() from one in an API route
 * apart needs more than a regex, and every server-side call to Resend and
 * Paystack would be a false alarm. Also not checked: anything a script builds
 * at runtime, and any attribute written as an expression rather than a literal,
 * because there is no value to test. A clean result here means the markup and
 * stylesheets are clean, not that the whole page is.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const ROOTS = ['src', 'public'];
const EXTS = new Set(['.astro', '.html', '.css']);
const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.astro', '.vercel', '.git', 'legacy_scripts',
  // A separate Next app on its own domain, sending its own headers. This
  // policy has no authority over it.
  'cms',
]);

const argv = process.argv.slice(2);
const urls = argv.filter((a) => a.startsWith('--url=')).map((a) => a.slice(6));
const showPolicy = argv.includes('--policy');

// ── The policy ───────────────────────────────────────────────────

/** Split a CSP header into { directive: [source, ...] }. */
function parsePolicy(header) {
  const out = {};
  for (const chunk of header.split(';')) {
    const tokens = chunk.trim().split(/\s+/).filter(Boolean);
    if (tokens.length) out[tokens[0].toLowerCase()] = tokens.slice(1);
  }
  return out;
}

/**
 * Which directives a resource type falls back through, most specific first.
 * form-action and base-uri deliberately have no default-src fallback: the spec
 * does not give them one, and pretending otherwise would report a pass that a
 * browser will not honour.
 */
const FALLBACK = {
  'script-src': ['script-src', 'default-src'],
  'style-src':  ['style-src', 'default-src'],
  'img-src':    ['img-src', 'default-src'],
  'font-src':   ['font-src', 'default-src'],
  'media-src':  ['media-src', 'default-src'],
  'object-src': ['object-src', 'default-src'],
  'frame-src':  ['frame-src', 'child-src', 'default-src'],
  'worker-src': ['worker-src', 'child-src', 'default-src'],
  'form-action': ['form-action'],
};

function effective(policy, directive) {
  for (const name of FALLBACK[directive] || [directive]) {
    if (policy[name]) return { name, sources: policy[name] };
  }
  return null; // nothing governs it, so nothing can refuse it
}

/** Does one host-source expression cover this URL? */
function hostSourceMatches(src, url) {
  let rest = src;
  let scheme = null;

  const withScheme = rest.match(/^([a-z][a-z0-9+.\-]*):\/\//i);
  if (withScheme) {
    scheme = withScheme[1].toLowerCase();
    rest = rest.slice(withScheme[0].length);
  }

  let path = '';
  const slash = rest.indexOf('/');
  if (slash !== -1) { path = rest.slice(slash); rest = rest.slice(0, slash); }

  let port = null;
  const colon = rest.lastIndexOf(':');
  if (colon !== -1) { port = rest.slice(colon + 1); rest = rest.slice(0, colon); }

  const host = rest.toLowerCase();
  const urlScheme = url.protocol.replace(':', '').toLowerCase();

  // A source given without a scheme covers http and https only. An http source
  // also covers https, because the spec allows an upgrade but never a downgrade.
  if (scheme) {
    if (scheme !== urlScheme && !(scheme === 'http' && urlScheme === 'https')) return false;
  } else if (urlScheme !== 'http' && urlScheme !== 'https') {
    return false;
  }

  const urlHost = url.hostname.toLowerCase();
  if (host === '*') {
    // any host
  } else if (host.startsWith('*.')) {
    if (!urlHost.endsWith(host.slice(1))) return false;
  } else if (host !== urlHost) {
    return false;
  }

  const defaultPort = urlScheme === 'https' ? '443' : '80';
  const urlPort = url.port || defaultPort;
  if (port === null) {
    if (urlPort !== (scheme === 'http' ? '80' : scheme === 'https' ? '443' : defaultPort)) return false;
  } else if (port !== '*' && port !== urlPort) {
    return false;
  }

  if (path && path !== '/') {
    let p;
    try { p = decodeURIComponent(url.pathname); } catch { p = url.pathname; }
    if (path.endsWith('/') ? !p.startsWith(path) : p !== path) return false;
  }
  return true;
}

/** Would this policy let the browser load this URL for this directive? */
function allowed(url, sources, siteOrigin) {
  for (const raw of sources) {
    const s = raw.trim();
    if (!s) continue;
    if (s === "'none'") return false;
    if (s.startsWith("'")) {
      // Keywords, nonces and hashes. Only 'self' can vouch for a URL.
      if (s === "'self'" && url.origin === siteOrigin) return true;
      continue;
    }
    if (s === '*') {
      // A bare * covers network schemes but never data:, blob: or filesystem:.
      if (!['data:', 'blob:', 'filesystem:'].includes(url.protocol)) return true;
      continue;
    }
    if (/^[a-z][a-z0-9+.\-]*:$/i.test(s)) {
      if (url.protocol.toLowerCase() === s.toLowerCase()) return true;
      continue;
    }
    if (hostSourceMatches(s, url)) return true;
  }
  return false;
}

// ── Finding what a page loads ────────────────────────────────────

const FONT_EXT = /\.(woff2?|ttf|otf|eot)(\?|#|$)/i;

/**
 * Every rule matches a quoted literal attribute. An Astro expression such as
 * src={hero.url} is skipped on purpose: there is no value here to judge, and
 * guessing would produce noise rather than a finding.
 */
const TAG_RULES = [
  ['script-src', 'script src',  /<script\b[^>]*?\bsrc\s*=\s*"([^"]+)"/gi],
  ['script-src', 'script src',  /<script\b[^>]*?\bsrc\s*=\s*'([^']+)'/gi],
  ['img-src',    'image',       /<img\b[^>]*?\bsrc\s*=\s*"([^"]+)"/gi],
  ['img-src',    'image',       /<img\b[^>]*?\bsrc\s*=\s*'([^']+)'/gi],
  ['img-src',    'poster',      /<video\b[^>]*?\bposter\s*=\s*"([^"]+)"/gi],
  ['media-src',  'video',       /<video\b[^>]*?\bsrc\s*=\s*"([^"]+)"/gi],
  ['media-src',  'audio',       /<audio\b[^>]*?\bsrc\s*=\s*"([^"]+)"/gi],
  // <source src> belongs to video and audio; <source srcset> belongs to
  // <picture>. The attribute tells them apart without tracking the parent tag.
  ['media-src',  'media source', /<source\b[^>]*?\bsrc\s*=\s*"([^"]+)"/gi],
  ['media-src',  'text track',  /<track\b[^>]*?\bsrc\s*=\s*"([^"]+)"/gi],
  ['frame-src',  'iframe',      /<iframe\b[^>]*?\bsrc\s*=\s*"([^"]+)"/gi],
  ['object-src', 'embed',       /<embed\b[^>]*?\bsrc\s*=\s*"([^"]+)"/gi],
  ['object-src', 'object',      /<object\b[^>]*?\bdata\s*=\s*"([^"]+)"/gi],
  ['form-action', 'form action', /<form\b[^>]*?\baction\s*=\s*"([^"]+)"/gi],
];

const SRCSET_RULES = [
  ['img-src', 'image srcset',  /<img\b[^>]*?\bsrcset\s*=\s*"([^"]+)"/gi],
  ['img-src', 'picture source', /<source\b[^>]*?\bsrcset\s*=\s*"([^"]+)"/gi],
];

/** What a <link> pulls in depends on rel, and on `as` when it is a preload. */
function linkDirective(tag) {
  const attr = (n) => (tag.match(new RegExp(`\\b${n}\\s*=\\s*"([^"]*)"`, 'i')) || [])[1] || '';
  const rel = attr('rel').toLowerCase().split(/\s+/);
  if (rel.includes('stylesheet')) return ['style-src', 'stylesheet'];
  if (rel.includes('preload') || rel.includes('modulepreload')) {
    const as = attr('as').toLowerCase();
    const map = {
      font: 'font-src', style: 'style-src', script: 'script-src',
      image: 'img-src', video: 'media-src', audio: 'media-src',
    };
    if (map[as]) return [map[as], `preloaded ${as}`];
    if (rel.includes('modulepreload')) return ['script-src', 'preloaded module'];
  }
  // preconnect, dns-prefetch, icon, canonical, manifest: either not governed by
  // a fetch directive or not worth a false alarm.
  return null;
}

function findReferences(text, isCss) {
  const found = [];
  const push = (dir, what, value) => found.push({ dir, what, value, index: -1 });

  if (!isCss) {
    for (const [dir, what, re] of TAG_RULES) {
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) found.push({ dir, what, value: m[1], index: m.index });
    }
    for (const [dir, what, re] of SRCSET_RULES) {
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) {
        for (const part of m[1].split(',')) {
          const url = part.trim().split(/\s+/)[0];
          if (url) found.push({ dir, what, value: url, index: m.index });
        }
      }
    }
    for (const m of text.matchAll(/<link\b[^>]*>/gi)) {
      const hit = linkDirective(m[0]);
      if (!hit) continue;
      const href = (m[0].match(/\bhref\s*=\s*"([^"]*)"/i) || [])[1];
      if (href) found.push({ dir: hit[0], what: hit[1], value: href, index: m.index });
    }
  }

  // CSS, whether a .css file or a <style> block inside a template.
  const blocks = isCss
    ? [{ css: text, offset: 0 }]
    : [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
        .map((m) => ({ css: m[1], offset: m.index + m[0].indexOf(m[1]) }));

  for (const { css, offset } of blocks) {
    for (const m of css.matchAll(/@import\s+(?:url\()?["']?([^"')\s]+)/gi)) {
      found.push({ dir: 'style-src', what: '@import', value: m[1], index: offset + m.index });
    }
    for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      const value = m[1].trim();
      if (/^@import/i.test(value)) continue;
      found.push({
        dir: FONT_EXT.test(value) ? 'font-src' : 'img-src',
        what: FONT_EXT.test(value) ? 'css font' : 'css image',
        value,
        index: offset + m.index,
      });
    }
  }
  return found;
}

// ── Walking ──────────────────────────────────────────────────────

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    // The external drive scatters AppleDouble sidecars. They are not source.
    if (e.name.startsWith('._')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(full, out);
    } else if (EXTS.has(extname(e.name))) {
      out.push(full);
    }
  }
  return out;
}

const lineOf = (text, index) => (index < 0 ? 0 : text.slice(0, index).split('\n').length);

// ── Judging ──────────────────────────────────────────────────────

function judge(text, refs, policy, siteOrigin, label) {
  const violations = [];
  for (const ref of refs) {
    const raw = ref.value.trim();
    // Astro and templating expressions, and fragments with no value to test.
    if (!raw || raw.startsWith('{') || raw.startsWith('#') || raw.includes('${')) continue;

    let url;
    try { url = new URL(raw, siteOrigin); } catch { continue; }
    if (url.protocol === 'mailto:' || url.protocol === 'tel:') continue;

    const eff = effective(policy, ref.dir);
    if (!eff) continue;
    if (allowed(url, eff.sources, siteOrigin)) continue;

    violations.push({
      label,
      line: lineOf(text, ref.index),
      what: ref.what,
      url: url.protocol === 'data:' ? `${raw.slice(0, 40)}...` : url.href,
      directive: eff.name,
      sources: eff.sources.join(' '),
    });
  }
  return violations;
}

// ── Run ──────────────────────────────────────────────────────────

const siteMatch = existsSync(join(ROOT, 'astro.config.mjs'))
  ? readFileSync(join(ROOT, 'astro.config.mjs'), 'utf8').match(/\bsite\s*:\s*['"]([^'"]+)['"]/)
  : null;
const SITE_ORIGIN = siteMatch ? new URL(siteMatch[1]).origin : 'https://quademdigital.com';

/**
 * The site's own policy, which is not the only one in vercel.json any more.
 *
 * /pitch/ (sample sites built for one prospect, served out of the CMS) has a
 * deliberately looser policy of its own, because those documents are made
 * elsewhere and arrive with their type on Google Fonts and their scripts on a
 * CDN. Judging the repo against that policy would pass files this site will
 * refuse to load, so the pitch entry is skipped by source and only the entry
 * covering everything else is returned.
 */
function policyFromVercelJson() {
  const p = join(ROOT, 'vercel.json');
  if (!existsSync(p)) return null;
  let json;
  try { json = JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
  for (const entry of json.headers || []) {
    if (/\/pitch\//.test(entry.source || '') && !/\?!/.test(entry.source || '')) continue;
    for (const h of entry.headers || []) {
      if (/^content-security-policy$/i.test(h.key || '')) return h.value;
    }
  }
  return null;
}

let failures = [];
let checkedCount = 0;
let skipped = [];

if (urls.length) {
  for (const target of urls) {
    let res, body;
    try {
      res = await fetch(target, { redirect: 'follow' });
      body = await res.text();
    } catch (err) {
      skipped.push(`${target} (${err.message})`);
      continue;
    }
    const header = res.headers.get('content-security-policy');
    if (!header) {
      skipped.push(`${target} (served no Content-Security-Policy header)`);
      continue;
    }
    const policy = parsePolicy(header);
    if (showPolicy) console.log(target, '\n ', JSON.stringify(policy, null, 2));
    const origin = new URL(res.url || target).origin;
    failures.push(...judge(body, findReferences(body, false), policy, origin, target));
    checkedCount++;
  }
  console.log(`Checked ${checkedCount} live page(s) against the CSP each one returned.`);
} else {
  const header = policyFromVercelJson();
  if (!header) {
    console.error('No Content-Security-Policy found in vercel.json.');
    console.error('Nothing was checked. This is NOT a clean result.');
    process.exit(2);
  }
  const policy = parsePolicy(header);
  if (showPolicy) {
    console.log(JSON.stringify(policy, null, 2));
    process.exit(0);
  }

  const files = ROOTS.flatMap((r) => walk(join(ROOT, r)));
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const refs = findReferences(text, extname(file) === '.css');
    if (!refs.length) continue;
    failures.push(...judge(text, refs, policy, SITE_ORIGIN, relative(ROOT, file)));
    checkedCount++;
  }
  console.log(
    `Checked ${files.length} file(s) under ${ROOTS.join(', ')} against the policy in vercel.json.`
  );
}

if (skipped.length) {
  console.error('\nCould not check:');
  for (const s of skipped) console.error(`  ${s}`);
}

if (failures.length) {
  console.error(`\n${failures.length} resource(s) the browser will refuse to load:\n`);
  let last = null;
  for (const f of failures) {
    if (f.label !== last) { console.error(`  ${f.label}`); last = f.label; }
    console.error(`    line ${f.line}  ${f.what}`);
    console.error(`      ${f.url}`);
    console.error(`      blocked by ${f.directive}: ${f.sources}`);
  }
  console.error('\nEach of these loads on this machine and fails in production, because');
  console.error('astro dev does not apply the headers in vercel.json.');
  console.error('Prefer hosting the file here over widening the policy: put video through');
  console.error('scripts/optimize-video.mjs and fonts in as woff2 next to the page. Widen');
  console.error('the CSP in vercel.json only for a service that has to be third party.');
  process.exit(1);
}

if (skipped.length) {
  console.error('\nWhat was checked is clean, but the pages above could NOT be checked.');
  console.error('This is NOT a clean result.');
  process.exit(2);
}

console.log('Clean. Nothing is loaded from anywhere the policy refuses.');
process.exit(0);
