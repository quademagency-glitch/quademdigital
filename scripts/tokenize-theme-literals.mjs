#!/usr/bin/env node
/**
 * Replace hard-coded dark colour literals with theme tokens.
 *
 * Deliberately NOT a colour-parsing regex that rewrites anything dark. It is an
 * exact-string allowlist: a literal is replaced only if it appears verbatim in
 * MAP below, in a colour property, outside an exempt region. Anything else is
 * reported and left alone. That constraint is what makes the tool incapable of
 * surprising you across 24 files.
 *
 *   node scripts/tokenize-theme-literals.mjs <file>...            # dry run
 *   node scripts/tokenize-theme-literals.mjs --write <file>...    # apply
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';

// literal -> token. Dark values map to the token whose DARK value is identical,
// so dark mode renders byte-for-byte the same and only light mode changes.
const MAP = new Map(Object.entries({
  // Page / surface grounds
  '#050814': 'var(--bg-page)',
  '#0a0f25': 'var(--bg-surface)',
  '#1a1a24': 'var(--bg-card)',
  '#111118': 'var(--bg-card)',
  '#15192b': 'var(--bg-card)',
  '#111520': 'var(--bg-card)',
  '#0d111d': 'var(--bg-page)',
  '#0d0d14': 'var(--bg-page)',
  '#1a1a2e': 'var(--bg-card)',

  // Raised surfaces: white at low alpha, invisible on a light ground.
  'rgba(255,255,255,0.02)': 'var(--bg-inset)',
  'rgba(255, 255, 255, 0.02)': 'var(--bg-inset)',
  'rgba(255,255,255,0.03)': 'var(--bg-inset)',
  'rgba(255, 255, 255, 0.03)': 'var(--bg-inset)',
  'rgba(255,255,255,0.04)': 'var(--bg-inset)',
  'rgba(255, 255, 255, 0.04)': 'var(--bg-inset)',
  'rgba(255,255,255,0.05)': 'var(--bg-hover)',
  'rgba(255, 255, 255, 0.05)': 'var(--bg-hover)',
  'rgba(255,255,255,0.06)': 'var(--bg-hover)',
  'rgba(255, 255, 255, 0.06)': 'var(--bg-hover)',

  // Hairlines
  'rgba(255,255,255,0.08)': 'var(--border-color)',
  'rgba(255, 255, 255, 0.08)': 'var(--border-color)',
  'rgba(255,255,255,0.1)': 'var(--border-color)',
  'rgba(255, 255, 255, 0.1)': 'var(--border-color)',
  'rgba(255,255,255,0.12)': 'var(--border-color)',
  'rgba(255, 255, 255, 0.12)': 'var(--border-color)',
  'rgba(255,255,255,0.15)': 'var(--border-strong)',
  'rgba(255, 255, 255, 0.15)': 'var(--border-strong)',
  'rgba(255,255,255,0.18)': 'var(--border-strong)',
  'rgba(255, 255, 255, 0.18)': 'var(--border-strong)',
  'rgba(255,255,255,0.2)': 'var(--border-strong)',
  'rgba(255, 255, 255, 0.2)': 'var(--border-strong)',


  // Low-alpha white text: unreadable on a light ground.
  'rgba(255,255,255,0.25)': 'var(--border-strong)',
  'rgba(255, 255, 255, 0.25)': 'var(--border-strong)',
  'rgba(255,255,255,0.3)': 'var(--text-subtle)',
  'rgba(255, 255, 255, 0.3)': 'var(--text-subtle)',
  'rgba(255,255,255,0.4)': 'var(--text-subtle)',
  'rgba(255, 255, 255, 0.4)': 'var(--text-subtle)',
  'rgba(255,255,255,0.65)': 'var(--text-muted)',
  'rgba(255, 255, 255, 0.65)': 'var(--text-muted)',
  'rgba(255,255,255,0.75)': 'var(--text-muted)',
  'rgba(255, 255, 255, 0.75)': 'var(--text-muted)',

  // Sunken / field grounds
  'rgba(0,0,0,0.2)': 'var(--bg-inset)',
  'rgba(0, 0, 0, 0.2)': 'var(--bg-inset)',
  'rgba(0,0,0,0.3)': 'var(--field-bg)',
  'rgba(0, 0, 0, 0.3)': 'var(--field-bg)',
  'rgba(0,0,0,0.7)': 'var(--bg-scrim)',
  'rgba(0, 0, 0, 0.7)': 'var(--bg-scrim)',
}));

const PROP = /(?:^|[;{\s])(background|background-color|color|border|border-color|border-top|border-bottom|border-left|border-right|fill|stroke|outline|outline-color)\s*:/i;

const write = process.argv.includes('--write');
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (files.length === 0) {
  console.error('Usage: tokenize-theme-literals.mjs [--write] <file>...');
  process.exit(1);
}

let changed = 0;
let skipped = 0;

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  const lines = original.split('\n');
  let exempt = false;
  let inPrint = false;
  let inScript = false;
  let depth = 0;
  const hits = [];

  const out = lines.map((line, i) => {
    if (/<script[\s>]/i.test(line)) inScript = true;
    if (/<\/script>/i.test(line)) { inScript = false; return line; }
    if (line.includes('theme-exempt:start')) exempt = true;
    if (line.includes('theme-exempt:end')) { exempt = false; return line; }
    if (/@media\s+print/.test(line)) { inPrint = true; depth = 0; }
    if (inPrint) {
      depth += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      if (depth <= 0 && line.includes('}')) inPrint = false;
      return line;
    }
    if (exempt || line.includes('theme-exempt')) return line;
    if (!PROP.test(line)) return line;

    // Inline style="" on template markup is real page CSS and safe to tokenize.
    // Colour literals inside a <script> block are NOT: that is where outbound
    // email HTML is assembled, and email clients cannot resolve CSS variables,
    // so "fixing" one silently ships unstyled mail.
    if (inScript) {
      skipped++;
      return line;
    }

    let next = line;
    for (const [literal, token] of MAP) {
      if (next.includes(literal)) {
        next = next.split(literal).join(token);
        hits.push({ line: i + 1, literal, token });
      }
    }
    return next;
  }).join('\n');

  if (hits.length) {
    console.log(`\n${file}`);
    for (const h of hits) {
      console.log(`  ${String(h.line).padStart(5)}  ${h.literal.padEnd(28)} -> ${h.token}`);
    }
    changed += hits.length;
    if (write) writeFileSync(file, out);
  }
}

console.log(`\n${write ? 'Applied' : 'Would apply'} ${changed} replacements.`);
if (skipped) console.log(`Skipped ${skipped} line(s) that look like HTML/JS strings.`);
if (!write && changed) console.log('Re-run with --write to apply.');
