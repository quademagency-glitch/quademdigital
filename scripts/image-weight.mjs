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
 *   ... --cms --missing-sizes            # which pictures lack a newly added size
 *   ... --cms --missing-sizes --fix --yes  # give them it (this is the AVIF backfill)
 *   node scripts/image-weight.mjs --cms --only=blog- # just the ones named blog-
 *   ... --cms --only=<one file> --name=<old name>  # put back a renamed file
 *   ... --cms --only=<one file> --replace=<path>  # swap in different artwork
 *
 * --fix never changes an image's dimensions, only how it is encoded, so the
 * picture stays the same picture. For the CMS it re-uploads the original, which
 * is what makes Payload regenerate every size using the current settings in
 * cms/src/lib/mediaPresets.ts. That is the only way a settings change reaches
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
// Kept identical to WEBP in cms/src/lib/mediaPresets.ts. If that changes,
// change this with it, or the guard will argue with the CMS about work the CMS
// itself did.
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

// Every size cms/src/collections/Media.ts generates, with the width it is
// generated at. Kept in step with that file by hand, same as QUALITY and
// EFFORT above, because this script cannot import across packages.
//
// The width matters as much as the name. Payload returns null for a size
// bigger than the picture it was made from, so a 300px logo legitimately has
// no `medium`, and flagging it as missing would re-upload it forever.
const EXPECTED_SIZES = {
  thumb: 200, thumbnail: 400, card: 480, medium: 800, large: 1200, og: 1200,
  mediumAvif: 800, largeAvif: 1200,
};

const IMAGE_EXTS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.avif']);
// Formats with no raster encoding to compare against. Skipping one of these is
// an answer, not a gap, so it is deliberately not reported.
const NON_RASTER = new Set(['svg']);
const SCAN_DIRS = ['public/images', 'src/images'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.astro', '.vercel', '.git']);

const argv = process.argv.slice(2);
const args = new Set(argv);
const doFix = args.has('--fix');
// --only=blog- narrows the CMS half to filenames containing that text, so a
// large re-render can be done in batches with a look at the result between.
const only = (argv.find((a) => a.startsWith('--only=')) || '').slice(7);
// --name=x.webp, with --only matching one picture, puts back a filename that a
// past collision renamed. See putFile for why a collision renames at all.
const rename = (argv.find((a) => a.startsWith('--name=')) || '').slice(7);
// --replace=path, with --only matching one picture, swaps in a different image
// while keeping the doc, its filename and every reference to it. Used when the
// artwork itself is wrong rather than merely heavy.
const replaceWith = (argv.find((a) => a.startsWith('--replace=')) || '').slice(10);
const confirmed = args.has('--yes');
// --missing-sizes re-renders pictures that lack a size the collection now
// makes, rather than ones that are badly encoded. Adding AVIF is what this is
// for: every existing picture was already webp at the right quality, so the
// weight check correctly said they were all fine, and not one of them would
// ever have gained the new format.
const missingSizes = args.has('--missing-sizes');
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
  const unreadable = [];
  for (const file of files) {
    const bytes = statSync(file).size;
    if (bytes < IGNORE_UNDER_BYTES) continue;
    let buffer, meta;
    try {
      buffer = readFileSync(file);
      meta = await sharp(buffer).metadata();
    } catch {
      // Same rule as the CMS half: say so rather than drop it quietly.
      unreadable.push({ file, why: 'it could not be read as an image' });
      continue;
    }
    if (NON_RASTER.has(meta.format)) continue;
    const standard = await encodeAtStandard(buffer, meta.format);
    if (!standard) {
      unreadable.push({ file, why: `there is no standard encoding for ${meta.format}` });
      continue;
    }
    if (!isWasteful(bytes, standard.length)) continue;
    over.push({ file, bytes, standard, width: meta.width, height: meta.height });
  }
  return { checked: files.length, over, unreadable };
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
  const images = docs.filter((d) => d.mimeType?.startsWith('image/'));
  return { skipped: false, base, key, docs: only ? images.filter((d) => d.filename?.includes(only)) : images };
}

/**
 * Only originals are downloaded. Every other size is produced by Payload from
 * the original using the collection settings, so if the original is right and
 * the settings are right, the derivatives follow. The one thing that has to be
 * read straight from the metadata is their format: a resized copy that is not
 * webp means the per-size settings were lost, which is how a 92KB screenshot
 * ended up with a 626KB copy of itself.
 */
/**
 * Sizes this picture should have and does not.
 *
 * Only counts a size the original is actually big enough to produce, so a
 * small picture is not reported forever for a size it can never have.
 */
function missingFrom(doc) {
  const width = Number(doc.width) || 0;
  if (!width) return [];
  return Object.entries(EXPECTED_SIZES)
    .filter(([name, w]) => width >= w && !doc.sizes?.[name]?.filename)
    .map(([name]) => name);
}

async function scanCms(docs) {
  const wrongFormat = [];
  const wasteful = [];
  const incomplete = [];
  // A picture this could not assess. It must be reported rather than skipped:
  // a guard that answers "clean" while having quietly dropped something is
  // worse than no guard, and that is not hypothetical. A download that failed
  // mid-run is how image-2.png, 2.3MB against a proper 432KB, sat through a
  // bulk re-render of 100 pictures and came out the other side unreported.
  const unreadable = [];
  let checked = 0;

  for (const doc of docs) {
    const sizes = Object.entries(doc.sizes || {}).filter(([, v]) => v && v.filename);
    checked += 1 + sizes.length;

    if (missingSizes) {
      const absent = missingFrom(doc);
      if (absent.length) incomplete.push({ id: doc.id, filename: doc.filename, absent });
      continue; // this mode asks one question only
    }

    // Free signal, straight from the metadata: a resized copy that is not webp
    // means the per-size settings were lost. Worth naming separately because it
    // is a settings regression rather than one badly saved picture.
    const badFormat = sizes.filter(([, v]) => !v.mimeType?.includes('webp'));
    if (badFormat.length) {
      wrongFormat.push({
        id: doc.id, filename: doc.filename,
        sizes: badFormat.map(([n, v]) => `${n} ${v.mimeType?.split('/')[1] || '?'} ${kb(v.filesize || 0)}`),
      });
      continue; // re-rendering fixes the format and the weight together
    }

    // Otherwise weigh the whole set. Judging the original alone would miss the
    // case this was written for: originals already saved sensibly, whose
    // resized copies were generated with settings since corrected. Those copies
    // are what pages actually load.
    const currentTotal = totalOf(doc);
    if (currentTotal < IGNORE_UNDER_BYTES) continue;
    const buffer = await downloadOriginal(doc);
    if (!buffer) {
      unreadable.push({ filename: doc.filename, why: 'it could not be downloaded' });
      continue;
    }
    let meta;
    try {
      meta = await sharp(buffer).metadata();
    } catch {
      unreadable.push({ filename: doc.filename, why: 'it could not be read as an image' });
      continue;
    }
    // A vector has no encoding to compare against, so there is nothing to say
    // about it. That is a real answer, not a skip.
    if (NON_RASTER.has(meta.format)) continue;
    const standardOriginal = await encodeAtStandard(buffer, meta.format);
    if (!standardOriginal) {
      unreadable.push({ filename: doc.filename, why: `there is no standard encoding for ${meta.format}` });
      continue;
    }
    let standardTotal = standardOriginal.length;
    for (const [, v] of sizes) {
      if (!v.width || !v.height) continue;
      const resized = await sharp(buffer)
        .resize(v.width, v.height, { fit: 'cover' })
        .webp({ quality: QUALITY, effort: EFFORT })
        .toBuffer();
      standardTotal += resized.length;
    }
    if (!isWasteful(currentTotal, standardTotal)) continue;
    wasteful.push({ id: doc.id, filename: doc.filename, bytes: currentTotal, standard: standardTotal });
  }
  return { checked, wrongFormat, wasteful, unreadable, incomplete };
}

let CMS_BASE = '';
async function downloadOriginal(doc) {
  const res = await fetch(`${CMS_BASE}/api/media/file/${encodeURIComponent(doc.filename)}`);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Send a file to an existing media doc.
 *
 * Payload will not overwrite a filename that is already taken, and a doc's own
 * current file counts as taken, so a straight re-upload under the same name
 * comes back as name-1. That matters: the old URL then 404s, which breaks any
 * link already out in the world, and once it has happened the original name is
 * not recoverable in a single step. The REST layer has no way to pass Payload's
 * overwriteExistingFiles option, so the name is freed first by parking the doc
 * on a temporary one, and then claimed back.
 */
async function putFile(id, bytes, filename, mime, alt, base, key) {
  const send = async (name) => {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: mime }), name);
    // Payload reads non-file fields from a _payload part, not from named form
    // fields. Without this the upload is rejected for a missing alt, which is
    // a required field on every picture.
    form.append('_payload', JSON.stringify({ alt }));
    const res = await fetch(`${base}/api/media/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `users API-Key ${key}` },
      body: form,
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 140)}`);
    return (await res.json()).doc;
  };
  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
  await send(`tmp-rerender-${id}${ext}`);
  return send(filename);
}

/**
 * Re-upload the original so Payload regenerates every size with the settings
 * that are live now. That is the only way a settings change reaches pictures
 * uploaded before it.
 */
async function fixCms(items, base, key) {
  const out = [];
  for (const item of items) {
    const existing = await readDoc(item.id, base, key);
    const before = totalOf(existing);
    const buffer = await downloadOriginal({ filename: existing.filename || item.filename });
    if (!buffer) { out.push({ ...item, outcome: 'could not download the original' }); continue; }

    const meta = await sharp(buffer).metadata();
    // item.filename is the name to end up with. It is normally the name the doc
    // already has; --name overrides it to put back one that a past collision
    // renamed.
    const standard = await encodeAtStandard(buffer, meta.format);
    const upload = standard && standard.length < buffer.length ? standard : buffer;

    let doc;
    try {
      doc = await putFile(item.id, upload, item.filename, `image/${meta.format}`,
                          existing.alt || item.filename, base, key);
    } catch (e) {
      out.push({ ...item, outcome: `upload rejected: ${e.message}` });
      continue;
    }
    out.push({
      ...item, before, after: totalOf(doc),
      renamed: doc.filename !== item.filename ? doc.filename : null,
      outcome: 'rerendered',
    });
  }
  return out;
}

const totalOf = (doc) =>
  (doc.filesize || 0) +
  Object.values(doc.sizes || {}).reduce((n, v) => n + ((v && v.filesize) || 0), 0);

async function readDoc(id, base, key) {
  const res = await fetch(`${base}/api/media/${id}?depth=0`, {
    headers: { Authorization: `users API-Key ${key}` },
  });
  return res.ok ? res.json() : {};
}

// ── Run ──────────────────────────────────────────────────────────
let failed = false;
let cmsSkipped = false;

if (!onlyCms) {
  const { checked, over, unreadable } = await scanRepo();
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
  for (const u of unreadable) {
    console.error(`  ${relative(ROOT, u.file)}\n      NOT CHECKED, ${u.why}`);
    failed = true;
  }
}

if (!onlySource) {
  const media = await cmsMedia();
  if (media.skipped) {
    cmsSkipped = true;
    console.log('\nCMS media: skipped, PUBLIC_PAYLOAD_URL or PAYLOAD_API_KEY not set');
  } else if (replaceWith) {
    // Swap the artwork on an existing picture. Replacing the file rather than
    // creating a new doc means every post, page and gallery already pointing at
    // it follows automatically, and the filename other places link to survives.
    CMS_BASE = media.base;
    if (media.docs.length !== 1) {
      console.error(`\n--replace needs --only to match exactly one picture, it matched ${media.docs.length}.`);
      process.exit(1);
    }
    if (!existsSync(replaceWith)) {
      console.error(`\nNo such file: ${replaceWith}`);
      process.exit(1);
    }
    const [doc] = media.docs;
    const bytes = readFileSync(replaceWith);
    const meta = await sharp(bytes).metadata();
    console.log(`\nReplacing ${doc.filename} with ${relative(ROOT, replaceWith)} (${meta.width}x${meta.height}, ${kb(bytes.length)})`);
    try {
      const updated = await putFile(doc.id, bytes, doc.filename, `image/${meta.format}`,
                                    doc.alt || doc.filename, media.base, media.key);
      if (updated.filename !== doc.filename) {
        console.error(`  failed: ended up as ${updated.filename}`);
        failed = true;
      } else {
        console.log(`  done, every size together ${kb(totalOf(updated))}`);
      }
    } catch (e) {
      console.error(`  failed: ${e.message}`);
      failed = true;
    }
  } else if (rename) {
    // Put back a filename that a collision renamed. Nothing is re-encoded: the
    // bytes already there are sent back under the name they should have had, so
    // the URL that other places point at works again.
    CMS_BASE = media.base;
    if (media.docs.length !== 1) {
      console.error(`\n--name needs --only to match exactly one picture, it matched ${media.docs.length}.`);
      process.exit(1);
    }
    const [doc] = media.docs;
    console.log(`\nRenaming ${doc.filename} to ${rename}`);
    const [result] = await fixCms([{ id: doc.id, filename: rename }], media.base, media.key);
    if (result.outcome === 'rerendered' && !result.renamed) {
      console.log(`  done, every size together ${kb(result.after)}`);
    } else {
      console.error(`  failed: ${result.renamed ? `ended up as ${result.renamed}` : result.outcome}`);
      failed = true;
    }
  } else {
    CMS_BASE = media.base;
    const { checked, wrongFormat, wasteful, unreadable, incomplete } = await scanCms(media.docs);
    const total = missingSizes ? incomplete.length : wrongFormat.length + wasteful.length;
    console.log(`\nCMS media: ${media.docs.length} pictures, ${checked} files, ${total} need re-rendering`);

    for (const m of incomplete) {
      console.error(`  ${m.filename}\n      missing ${m.absent.join(', ')}`);
    }

    for (const w of wrongFormat) {
      console.error(`  ${w.filename}\n      resized copies are not webp: ${w.sizes.join(', ')}`);
    }
    for (const w of wasteful) {
      console.error(`  ${w.filename}\n      every size together ${kb(w.bytes)}, would be ${kb(w.standard)} at quality ${QUALITY}`);
    }
    // Named loudly and counted as a failure. These are the ones that would
    // otherwise vanish into a clean-looking result.
    for (const u of unreadable) {
      console.error(`  ${u.filename}\n      NOT CHECKED, ${u.why}. Re-run to weigh it.`);
      failed = true;
    }

    if (total && doFix) {
      if (!confirmed) {
        console.error('\n  Re-rendering CMS media rewrites production files. Re-run with --yes to do it.');
        failed = true;
      } else {
        const items = (missingSizes ? incomplete : [...wrongFormat, ...wasteful])
          .map((w) => ({ id: w.id, filename: w.filename }));
        console.log(`\n  Re-rendering ${items.length} pictures. Each one regenerates every size.`);
        for (const r of await fixCms(items, media.base, media.key)) {
          if (r.outcome === 'rerendered') {
            // In --missing-sizes the total goes UP, because sizes that did not
            // exist now do. Saying "smaller" there would be a lie.
            console.log(`  ${r.filename}\n      every size together: ${kb(r.before)} -> ${kb(r.after)}` +
                        (missingSizes ? '' : `, ${pct(r.before, r.after)} smaller`) +
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
