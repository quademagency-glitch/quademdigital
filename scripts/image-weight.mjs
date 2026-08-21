#!/usr/bin/env node
/**
 * Image weight guard.
 *
 * Pictures are the largest thing this site sends and the failures are never
 * visible: nothing looks broken when a file is four times heavier than it needs
 * to be, it just costs the visitor data and time. Three real examples, all
 * found by measuring rather than looking:
 *
 *   - the logo was 2000px square and 37KB, painted at 52px, on every page
 *   - a service hero preloaded the 50KB original and painted the 12KB copy
 *   - a 2560px screenshot uploaded as PNG became a 92KB webp, while every
 *     resized copy of it stayed PNG: the 800px one is 626KB, seven times the
 *     original it was made from
 *
 * There is no single byte count that separates good from bad, because a big
 * picture is allowed to be a big file, and bytes per pixel rises as an image
 * gets smaller whatever quality you use. So this does not guess a threshold.
 * It re-encodes each picture at the setting the CMS itself uses and compares:
 * a file is over budget when encoding it properly would save real bytes. That
 * is self-calibrating, and it is the same question --fix then answers.
 *
 *   node scripts/image-weight.mjs                    # report, exit 1 if any are wasteful
 *   node scripts/image-weight.mjs --source           # repo images only, no network
 *   node scripts/image-weight.mjs --cms              # CMS media only
 *   node scripts/image-weight.mjs --fix              # re-render repo images in place
 *   node scripts/image-weight.mjs --cms --fix --yes  # re-render CMS media too
 *
 * --fix never changes an image's dimensions, only how it is encoded, so the
 * picture stays the same picture. For the CMS it re-uploads the original, which
 * is what makes Payload regenerate every size using the current settings in
 * cms/src/collections/Media.ts. That is the only way a settings change reaches
 * pictures uploaded before it.
 *
 * The CMS half needs PUBLIC_PAYLOAD_URL and PAYLOAD_API_KEY from the repo-root
 * .env. Without them it exits 2 and says what went unchecked, so a missing key
 * can never look like a clean result. Rewriting production media additionally
 * requires --yes.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

// ── The standard ─────────────────────────────────────────────────
// Kept identical to DERIVATIVE_FORMAT in cms/src/collections/Media.ts. If that
// changes, change this with it, or the guard will argue with the CMS.
const QUALITY = 72;
const EFFORT = 6;
// How much heavier than a proper encode a file may be before it is worth
// rewriting. Some slack matters: re-encoding an already lossy file is never
// byte-identical, and churning every image for 2% is noise, not a saving.
const TOLERANCE = 1.15;
const MIN_SAVING_BYTES = 10 * 1024;
// Below this, re-encoding cannot save enough to be worth anyone's attention.
const IGNORE_UNDER_BYTES = 20 * 1024;
// ─────────────────────────────────────────────────────────────────

const IMAGE_EXTS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.avif']);
const SCAN_DIRS = ['public/images', 'src/images'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.astro', '.vercel', '.git']);

const args = new Set(process.argv.slice(2));
const doFix = args.has('--fix');
const confirmed = args.has('--yes');
const onlySource = args.has('--source');
const onlyCms = args.has('--cms') && !onlySource;

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('sharp is not installed, so nothing can be measured or re-rendered.');
  process.exit(2);
}

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

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
const pct = (before, after) => `${Math.round((1 - after / before) * 100)}%`;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    // macOS writes a ._name sidecar next to every file on these volumes. They
    // carry an image extension, contain no image, and would otherwise be
    // counted and reported as unreadable pictures.
    if (entry.name.startsWith('._')) continue;
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && IMAGE_EXTS.has(extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

/**
 * Encode at the standard, keeping dimensions and format. Format is kept because
 * changing it here would rename files and break every reference to them; the
 * repo has a separate prebuild step (optimize-images.mjs) for converting source
 * PNG and JPEG to webp, and the CMS converts on upload.
 */
async function encodeAtStandard(buffer, format) {
  const img = sharp(buffer);
  if (format === 'webp') return img.webp({ quality: QUALITY, effort: EFFORT }).toBuffer();
  if (format === 'avif') return img.avif({ quality: QUALITY, effort: EFFORT }).toBuffer();
  if (format === 'jpeg' || format === 'jpg') return img.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
  if (format === 'png') return img.png({ quality: QUALITY, effort: 8, palette: true }).toBuffer();
  return null;
}

/** Is this file meaningfully heavier than the same picture encoded properly? */
function isWasteful(currentBytes, standardBytes) {
  return currentBytes > standardBytes * TOLERANCE
      && currentBytes - standardBytes >= MIN_SAVING_BYTES;
}

async function scanRepo() {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
  const over = [];
  for (const file of files) {
    const bytes = statSync(file).size;
    if (bytes < IGNORE_UNDER_BYTES) continue;
    let buffer, meta;
    try {
      buffer = readFileSync(file);
      meta = await sharp(buffer).metadata();
    } catch {
      continue;
    }
    const standard = await encodeAtStandard(buffer, meta.format);
    if (!standard || !isWasteful(bytes, standard.length)) continue;
    over.push({ file, bytes, standard, width: meta.width, height: meta.height });
  }
  return { checked: files.length, over };
}

function fixRepo(over) {
  for (const item of over) writeFileSync(item.file, item.standard);
  return over.map((i) => ({ ...i, after: i.standard.length }));
}

async function cmsMedia() {
  const env = { ...readEnv(), ...process.env };
  const base = (env.PUBLIC_PAYLOAD_URL || '').replace(/\/$/, '');
  const key = env.PAYLOAD_API_KEY;
  if (!base || !key) return { skipped: true };

  const res = await fetch(`${base}/api/media?limit=1000&depth=0`, {
    headers: { Authorization: `users API-Key ${key}` },
  });
  if (!res.ok) throw new Error(`CMS media list failed: ${res.status}`);
  const { docs } = await res.json();
  return { skipped: false, base, key, docs: docs.filter((d) => d.mimeType?.startsWith('image/')) };
}

/**
 * Only originals are downloaded. Every other size is produced by Payload from
 * the original using the collection settings, so if the original is right and
 * the settings are right, the derivatives follow. The one thing that has to be
 * read straight from the metadata is their format: a resized copy that is not
 * webp means the per-size settings were lost, which is how a 92KB screenshot
 * ended up with a 626KB copy of itself.
 */
async function scanCms(docs) {
  const wrongFormat = [];
  const wasteful = [];
  let checked = 0;

  for (const doc of docs) {
    const badSizes = Object.entries(doc.sizes || {})
      .filter(([, v]) => v && v.filename && !v.mimeType?.includes('webp'));
    checked += 1 + Object.values(doc.sizes || {}).filter((v) => v && v.filename).length;
    if (badSizes.length) {
      wrongFormat.push({
        id: doc.id, filename: doc.filename,
        sizes: badSizes.map(([n, v]) => `${n} ${v.mimeType?.split('/')[1] || '?'} ${kb(v.filesize || 0)}`),
        heaviest: Math.max(...badSizes.map(([, v]) => v.filesize || 0)),
      });
      continue; // re-rendering fixes the format and the weight in one pass
    }
    if (!doc.filesize || doc.filesize < IGNORE_UNDER_BYTES) continue;
  }

  // Weigh the originals that are not already flagged for their format.
  const flagged = new Set(wrongFormat.map((w) => w.id));
  for (const doc of docs) {
    if (flagged.has(doc.id) || !doc.filesize || doc.filesize < IGNORE_UNDER_BYTES) continue;
    const buffer = await downloadOriginal(doc);
    if (!buffer) continue;
    const meta = await sharp(buffer).metadata();
    const standard = await encodeAtStandard(buffer, meta.format);
    if (!standard || !isWasteful(buffer.length, standard.length)) continue;
    wasteful.push({ id: doc.id, filename: doc.filename, bytes: buffer.length, standard: standard.length });
  }
  return { checked, wrongFormat, wasteful };
}

let CMS_BASE = '';
async function downloadOriginal(doc) {
  const res = await fetch(`${CMS_BASE}/api/media/file/${encodeURIComponent(doc.filename)}`);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Re-upload the original so Payload regenerates every size with the settings
 * that are live now. The filename is kept, so nothing that already points at
 * this picture has to change.
 */
async function fixCms(items, base, key) {
  const out = [];
  for (const item of items) {
    const buffer = await downloadOriginal({ filename: item.filename });
    if (!buffer) { out.push({ ...item, outcome: 'could not download the original' }); continue; }

    const meta = await sharp(buffer).metadata();
    const standard = await encodeAtStandard(buffer, meta.format);
    const upload = standard && standard.length < buffer.length ? standard : buffer;

    const before = await sizeOfEverything(item.id, base, key);
    const form = new FormData();
    form.append('file', new Blob([upload], { type: `image/${meta.format}` }), item.filename);
    const patch = await fetch(`${base}/api/media/${item.id}`, {
      method: 'PATCH',
      headers: { Authorization: `users API-Key ${key}` },
      body: form,
    });
    if (!patch.ok) {
      out.push({ ...item, outcome: `upload rejected: ${patch.status} ${(await patch.text()).slice(0, 140)}` });
      continue;
    }
    const { doc } = await patch.json();
    const after = totalOf(doc);
    out.push({
      ...item, before, after,
      renamed: doc.filename !== item.filename ? doc.filename : null,
      outcome: 'rerendered',
    });
  }
  return out;
}

const totalOf = (doc) =>
  (doc.filesize || 0) +
  Object.values(doc.sizes || {}).reduce((n, v) => n + ((v && v.filesize) || 0), 0);

async function sizeOfEverything(id, base, key) {
  const res = await fetch(`${base}/api/media/${id}?depth=0`, {
    headers: { Authorization: `users API-Key ${key}` },
  });
  if (!res.ok) return 0;
  return totalOf(await res.json());
}

// ── Run ──────────────────────────────────────────────────────────
let failed = false;
let cmsSkipped = false;

if (!onlyCms) {
  const { checked, over } = await scanRepo();
  console.log(`\nRepo images: ${checked} checked, ${over.length} heavier than a proper encode`);
  if (over.length && doFix) {
    for (const r of fixRepo(over)) {
      console.log(`  ${relative(ROOT, r.file)}\n      ${kb(r.bytes)} -> ${kb(r.after)}, ${pct(r.bytes, r.after)} smaller`);
    }
  } else {
    for (const r of over) {
      console.error(`  ${relative(ROOT, r.file)}\n      ${kb(r.bytes)} at ${r.width}x${r.height}, would be ${kb(r.standard.length)} at quality ${QUALITY}`);
    }
    if (over.length) failed = true;
  }
}

if (!onlySource) {
  const media = await cmsMedia();
  if (media.skipped) {
    cmsSkipped = true;
    console.log('\nCMS media: skipped, PUBLIC_PAYLOAD_URL or PAYLOAD_API_KEY not set');
  } else {
    CMS_BASE = media.base;
    const { checked, wrongFormat, wasteful } = await scanCms(media.docs);
    const total = wrongFormat.length + wasteful.length;
    console.log(`\nCMS media: ${media.docs.length} pictures, ${checked} files, ${total} need re-rendering`);

    for (const w of wrongFormat) {
      console.error(`  ${w.filename}\n      resized copies are not webp: ${w.sizes.join(', ')}`);
    }
    for (const w of wasteful) {
      console.error(`  ${w.filename}\n      ${kb(w.bytes)}, would be ${kb(w.standard)} at quality ${QUALITY}`);
    }

    if (total && doFix) {
      if (!confirmed) {
        console.error('\n  Re-rendering CMS media rewrites production files. Re-run with --yes to do it.');
        failed = true;
      } else {
        const items = [...wrongFormat, ...wasteful].map((w) => ({ id: w.id, filename: w.filename }));
        console.log(`\n  Re-rendering ${items.length} pictures. Each one regenerates every size.`);
        for (const r of await fixCms(items, media.base, media.key)) {
          if (r.outcome === 'rerendered') {
            console.log(`  ${r.filename}\n      every size together: ${kb(r.before)} -> ${kb(r.after)}, ${pct(r.before, r.after)} smaller` +
                        (r.renamed ? `\n      NOTE: the CMS renamed the file to ${r.renamed}` : ''));
          } else {
            console.error(`  ${r.filename}\n      ${r.outcome}`);
            failed = true;
          }
        }
      }
    } else if (total) {
      failed = true;
    }
  }
}

if (failed) {
  console.error(`\nImages are heavier than they need to be. Run with --fix for the repo's,`);
  console.error('and --cms --fix --yes for the ones in the CMS.');
  process.exit(1);
}

// Most of the pictures on this site are in the CMS, so "the repo is clean" is
// not the same as clean, and saying so would be the failure this guard exists
// to prevent.
if (cmsSkipped) {
  console.error('\nWhat was checked is fine, but the CMS could NOT be checked,');
  console.error('and most of the pictures on this site are there. This is not a pass.');
  process.exit(2);
}

console.log('\nEvery picture is encoded at the standard.');
process.exit(0);
