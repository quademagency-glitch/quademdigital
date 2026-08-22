#!/usr/bin/env node
/**
 * Theme-literal ratchet.
 *
 * Light mode broke because the stylesheet mixed design tokens with hundreds of
 * hard-coded dark values: rgba(255,255,255,0.03) card surfaces that vanish on
 * a light ground, rgba(0,0,0,0.3) form fields that produce dark-on-dark text.
 * Fixing them once is not enough; nothing stops the next one being written.
 *
 * This counts the remaining offenders and fails if the count rises above the
 * baseline below. Each sweep commit lowers the baseline. That makes a
 * 29-file sweep verifiable by CI instead of by eyeballing every page.
 *
 *   node scripts/check-theme-literals.mjs            # check against baseline
 *   node scripts/check-theme-literals.mjs --list     # show every offender
 *   node scripts/check-theme-literals.mjs --update   # rewrite the baseline
 *
 * Exempt a genuinely intentional literal by wrapping it:
 *   / * theme-exempt:start * /  ...  / * theme-exempt:end * /
 * or ending the line with:  / * theme-exempt * /
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const BASELINE_FILE = join(ROOT, 'scripts', 'theme-literals-baseline.json');

const EXTS = new Set(['.css', '.astro', '.tsx', '.jsx']);

// Properties where a colour literal actually themes something. Excludes
// box-shadow/text-shadow/filter, which are tuned per-design and rarely invert.
const PROP = /(?:^|[;{\s])(background|background-color|color|border|border-color|border-top|border-bottom|border-left|border-right|fill|stroke|outline|outline-color)\s*:/i;

const DARK_HEX = /#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi;
const RGBA = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/gi;

function luminance(r, g, b) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function parseHex(h) {
  const s = h.slice(1);
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

/** A literal is an offender if it is a dark colour, or white with low alpha
 *  (the "subtle raised surface" idiom that disappears on a light ground). */
function isOffender(text) {
  if (text.startsWith('#')) {
    const [r, g, b] = parseHex(text);
    return luminance(r, g, b) < 0.06;
  }
  const nums = text.match(/[\d.]+/g).map(Number);
  const [r, g, b, a = 1] = nums;
  // Fully transparent: a gradient stop, not a colour. Renders nothing either way.
  if (a === 0) return false;
  // Heavy scrims over imagery are legitimately dark in both themes; it is the
  // low-alpha "subtle surface" idiom that breaks on a light ground.
  if (r === 255 && g === 255 && b === 255) return a < 0.5;
  return luminance(r, g, b) < 0.06 && a >= 0.85;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    // The external drive scatters AppleDouble sidecars; they are binary.
    if (entry.startsWith('._') || entry === 'node_modules') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXTS.has(extname(p))) out.push(p);
  }
  return out;
}

const findings = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const lines = readFileSync(file, 'utf8').split('\n');
  let exempt = false;
  let inPrint = false;
  let braceDepth = 0;

  lines.forEach((line, i) => {
    if (line.includes('theme-exempt:start')) exempt = true;
    if (line.includes('theme-exempt:end')) { exempt = false; return; }

    // @media print blocks are deliberately light-on-white.
    if (/@media\s+print/.test(line)) { inPrint = true; braceDepth = 0; }
    if (inPrint) {
      braceDepth += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      if (braceDepth <= 0 && line.includes('}')) inPrint = false;
      return;
    }

    if (exempt || line.includes('theme-exempt')) return;
    if (!PROP.test(line)) return;
    // Skip lines that are building HTML strings (outbound email templates).
    if (/`|"<|<\/|style="/.test(line) && extname(file) !== '.css') {
      if (!/^\s*[a-z-]+\s*:/i.test(line)) return;
    }

    for (const m of [...line.matchAll(DARK_HEX), ...line.matchAll(RGBA)]) {
      if (isOffender(m[0])) {
        findings.push({ file: rel, line: i + 1, literal: m[0], text: line.trim().slice(0, 90) });
      }
    }
  });
}

const byFile = findings.reduce((acc, f) => {
  acc[f.file] = (acc[f.file] || 0) + 1;
  return acc;
}, {});

if (process.argv.includes('--list')) {
  for (const f of findings) {
    console.log(`${f.file}:${f.line}  ${f.literal.padEnd(26)} ${f.text}`);
  }
  console.log();
}

const sorted = Object.entries(byFile).sort((a, b) => b[1] - a[1]);
if (process.argv.includes('--by-file')) {
  for (const [file, n] of sorted) console.log(String(n).padStart(4), file);
  console.log();
}

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE_FILE, JSON.stringify({ total: findings.length, byFile }, null, 2) + '\n');
  console.log(`Baseline updated: ${findings.length} theme literals across ${sorted.length} files.`);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
} catch {
  console.error('No baseline. Run: node scripts/check-theme-literals.mjs --update');
  process.exit(1);
}

const delta = findings.length - baseline.total;
console.log(`Theme literals: ${findings.length} (baseline ${baseline.total}, ${delta >= 0 ? '+' : ''}${delta})`);

if (delta > 0) {
  const worse = sorted.filter(([f, n]) => n > (baseline.byFile[f] || 0));
  console.error('\nNew hard-coded theme literals were introduced:');
  for (const [file, n] of worse) {
    console.error(`  ${file}: ${baseline.byFile[file] || 0} -> ${n}`);
  }
  console.error('\nUse a token from :root (--bg-card, --bg-inset, --text-subtle, ...)');
  console.error('or mark it /* theme-exempt */ if it is intentionally fixed in both themes.');
  process.exit(1);
}

if (delta < 0) {
  console.log('Improved. Lower the baseline with --update and commit it.');
}
process.exit(0);
