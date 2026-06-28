/**
 * Pre-build image optimization script.
 *
 * Scans public/images/ for oversized images and automatically:
 *   1. Compresses PNGs and JPEGs that exceed SIZE_THRESHOLD
 *   2. Generates WebP versions alongside every PNG/JPEG
 *
 * Run manually:   node scripts/optimize-images.mjs
 * Runs on build:  via "prebuild" npm script
 */
import sharp from 'sharp';
import { readdir, stat, rename, unlink } from 'fs/promises';
import path from 'path';

// ── Configuration ────────────────────────────────────────────────
const IMAGES_DIR  = './public/images';
const SIZE_THRESHOLD = 200 * 1024;          // 200 KB — flag anything above this
const WEBP_QUALITY   = 80;
const PNG_QUALITY    = 80;                  // palette-based quantization
const JPEG_QUALITY   = 82;
const MAX_WIDTH      = 1600;                // don't ship images wider than this
const EXTENSIONS     = new Set(['.png', '.jpg', '.jpeg']);
// ─────────────────────────────────────────────────────────────────

/** Recursively list all files under `dir`. */
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

let optimized = 0;
let webpCreated = 0;
let skipped = 0;
let totalSaved = 0;

const allFiles = await walk(IMAGES_DIR);
const imageFiles = allFiles.filter(f => {
  const basename = path.basename(f);
  // Skip macOS resource fork files
  if (basename.startsWith('._')) return false;
  return EXTENSIONS.has(path.extname(f).toLowerCase());
});

console.log(`\n🖼  Image optimizer — scanning ${imageFiles.length} images in ${IMAGES_DIR}/\n`);

for (const filePath of imageFiles) {
 try {
  const ext = path.extname(filePath).toLowerCase();
  const baseName = filePath.slice(0, -ext.length);
  const fileSize = (await stat(filePath)).size;
  const relPath = path.relative('.', filePath);

  // ── 1. Generate WebP if missing ────────────────────────────
  const webpPath = `${baseName}.webp`;
  let webpExists = false;
  try { await stat(webpPath); webpExists = true; } catch {}

  if (!webpExists) {
    await sharp(filePath)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 6 })
      .toFile(webpPath);
    const webpSize = (await stat(webpPath)).size;
    console.log(`  ✅ WebP created: ${path.relative('.', webpPath)} (${(webpSize / 1024).toFixed(0)} KB)`);
    webpCreated++;
  }

  // ── 2. Compress original if oversized ──────────────────────
  if (fileSize <= SIZE_THRESHOLD) {
    skipped++;
    continue;
  }

  console.log(`  ⚠️  Oversized: ${relPath} (${(fileSize / 1024).toFixed(0)} KB)`);

  const tmpPath = `${filePath}.tmp`;

  if (ext === '.png') {
    await sharp(filePath)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .png({ quality: PNG_QUALITY, compressionLevel: 9, palette: true, effort: 10 })
      .toFile(tmpPath);
  } else {
    // JPEG
    await sharp(filePath)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toFile(tmpPath);
  }

  const newSize = (await stat(tmpPath)).size;

  // Only replace if we actually made it smaller
  if (newSize < fileSize) {
    await unlink(filePath);
    await rename(tmpPath, filePath);
    const saved = fileSize - newSize;
    totalSaved += saved;
    console.log(`  ✅ Compressed: ${relPath}  ${(fileSize / 1024).toFixed(0)} KB → ${(newSize / 1024).toFixed(0)} KB  (saved ${(saved / 1024).toFixed(0)} KB)`);
    optimized++;
  } else {
    await unlink(tmpPath);
    console.log(`  ⏭  Already optimal: ${relPath}`);
    skipped++;
  }
 } catch (err) {
    console.warn(`  ⚠️  Skipped (error): ${path.relative('.', filePath)} — ${err.message}`);
    skipped++;
  }
}

console.log(`\n── Summary ─────────────────────────────────────────────`);
console.log(`  Compressed:  ${optimized} image(s)`);
console.log(`  WebP added:  ${webpCreated} image(s)`);
console.log(`  Skipped:     ${skipped} image(s) (already ≤ ${SIZE_THRESHOLD / 1024} KB)`);
console.log(`  Total saved: ${(totalSaved / 1024).toFixed(0)} KB`);
console.log(`────────────────────────────────────────────────────────\n`);
