#!/usr/bin/env node
/**
 * Take the pictures back out of a page.
 *
 * A single self-contained HTML file with every photograph written into it as
 * base64 text is a tempting thing to build, because it is one file you can
 * email. It has two problems and the first one is the one that stops you:
 *
 *  - **Text-encoded pictures are a third bigger than the real files.** The
 *    Star Gate pitch preview was 1.5 MB of photographs that became a 2.1 MB
 *    page, over the 2 MB limit on a page, with nothing else in the folder.
 *  - **Nothing appears until all of it has arrived.** The words on the page
 *    cannot render ahead of the photographs, because they are the same
 *    download, and a visitor who comes back fetches the lot again rather than
 *    reusing the pictures their browser already has.
 *
 * This finds every picture and font baked into a page, writes them out as real
 * files beside it, and repoints the page at them. Identical copies of the same
 * picture collapse into one file, which is common: a logo inlined in six
 * places is six copies of the logo.
 *
 *   node scripts/unpack-inline-images.mjs <file.html|folder>           # report
 *   node scripts/unpack-inline-images.mjs <file.html|folder> --apply   # do it
 *
 * Dry run by default. With --apply the original is kept beside it as
 * `<name>.inlined.html` so the change can be undone by hand.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const APPLY = process.argv.includes('--apply');
const target = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));

/*
  What a page is allowed to weigh once published, in decimal megabytes.

  Not 1024-based: the page that was refused was 2,063,254 bytes, under 2 MiB but
  over 2 million, and the platform called it "2.1MB, over the 2MB limit". A MiB
  threshold would have called that file safe.
*/
const PAGE_LIMIT = 2_000_000;

if (!target) {
  console.log(`Take the pictures back out of a page, so the page is small enough to publish.

  node scripts/unpack-inline-images.mjs <file.html|folder>
  node scripts/unpack-inline-images.mjs <file.html|folder> --apply

Dry run unless you pass --apply.`);
  process.exit(0);
}

const EXT = {
  'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
  'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg', 'image/x-icon': 'ico',
  'font/woff2': 'woff2', 'font/woff': 'woff', 'font/ttf': 'ttf', 'font/otf': 'otf',
  'application/font-woff2': 'woff2', 'application/font-woff': 'woff',
  'video/mp4': 'mp4', 'video/webm': 'webm',
};

const folderFor = (mime) =>
  mime.startsWith('font/') || mime.includes('font') ? 'fonts'
  : mime.startsWith('video/') ? 'video'
  : 'images';

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

/**
 * A name a person can recognise, taken from the page itself where it says one.
 *
 * Whatever sits immediately before the data URI is usually the answer: an
 * object key (`"hero":"data:..."`), an id, or an alt. Falling back to a hash
 * gives a boring but stable name rather than image-1, image-2, which stop
 * matching the moment one is removed.
 */
const nameFrom = (before, bytes) => {
  const clues = [
    /["']([A-Za-z0-9_-]{2,40})["']\s*:\s*["']$/,      // "hero": "data:...
    /\bid=["']([A-Za-z0-9_-]{2,40})["'][^>]*$/i,       // <img id="hero" src="data:...
    /\balt=["']([^"']{2,40})["'][^>]*$/i,              // <img alt="The hero" src="data:...
    /--([a-z0-9-]{2,40})\s*:\s*url\(\s*["']?$/i,       // --hero: url(data:...
  ];
  for (const re of clues) {
    const m = before.match(re);
    if (m) {
      const slug = m[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (slug) return slug;
    }
  }
  return crypto.createHash('sha1').update(bytes).digest('hex').slice(0, 8);
};

function unpack(file) {
  const dir = path.dirname(file);
  const html = fs.readFileSync(file, 'utf8');
  const before = Buffer.byteLength(html);

  const re = /data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=]+)/gi;

  /** hash -> {name, bytes, mime, uses} so the same picture is written once. */
  const assets = new Map();
  const taken = new Set();

  const out = html.replace(re, (whole, mime, b64, offset) => {
    mime = mime.toLowerCase();
    const ext = EXT[mime];
    // Anything that is not a file a browser fetches separately is left alone.
    if (!ext) return whole;

    const bytes = Buffer.from(b64, 'base64');
    const hash = crypto.createHash('sha1').update(bytes).digest('hex');

    if (assets.has(hash)) {
      assets.get(hash).uses++;
      return assets.get(hash).href;
    }

    let stem = nameFrom(html.slice(Math.max(0, offset - 200), offset), bytes);
    let name = `${stem}.${ext}`;
    let n = 2;
    while (taken.has(name)) name = `${stem}-${n++}.${ext}`;
    taken.add(name);

    const href = `${folderFor(mime)}/${name}`;
    assets.set(hash, { name, href, bytes, mime, uses: 1, folder: folderFor(mime) });
    return href;
  });

  const after = Buffer.byteLength(out);
  const list = [...assets.values()].sort((a, b) => b.bytes.length - a.bytes.length);

  console.log(`\n${path.relative(process.cwd(), file) || file}`);
  if (!list.length) {
    console.log(`  nothing inlined. ${kb(before)}${before > PAGE_LIMIT ? '  OVER the 2 MB page limit for another reason' : ''}`);
    return { before, after, extracted: 0, over: before > PAGE_LIMIT };
  }

  for (const a of list) {
    console.log(`  ${a.href.padEnd(28)} ${kb(a.bytes.length).padStart(8)}${a.uses > 1 ? `   (inlined ${a.uses} times, written once)` : ''}`);
  }
  const assetBytes = list.reduce((n, a) => n + a.bytes.length, 0);
  console.log(`  ${'-'.repeat(60)}`);
  console.log(`  page   ${kb(before)} -> ${kb(after)}${after > PAGE_LIMIT ? '   STILL OVER THE LIMIT' : '   under the 2 MB limit'}`);
  console.log(`  files  ${list.length} of them, ${kb(assetBytes)} in total`);
  console.log(`  folder ${kb(before)} -> ${kb(after + assetBytes)}, because text-encoded pictures are a third bigger than the real files`);

  if (!APPLY) return { before, after, extracted: list.length, over: after > PAGE_LIMIT };

  for (const a of list) {
    const d = path.join(dir, a.folder);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, a.name), a.bytes);
  }
  fs.copyFileSync(file, file.replace(/\.html$/, '.inlined.html'));
  fs.writeFileSync(file, out);

  // This drive writes an AppleDouble sidecar beside every file, and they would
  // be uploaded as junk alongside the real ones.
  for (const d of new Set(list.map((a) => path.join(dir, a.folder)))) {
    for (const f of fs.readdirSync(d)) if (f.startsWith('._')) fs.unlinkSync(path.join(d, f));
  }

  console.log(`  written. the original is kept as ${path.basename(file).replace(/\.html$/, '.inlined.html')}`);
  return { before, after, extracted: list.length, over: after > PAGE_LIMIT };
}

const stat = fs.statSync(target);
const files = stat.isDirectory()
  ? fs.readdirSync(target, { recursive: true })
      .filter((f) => typeof f === 'string' && f.endsWith('.html') && !f.endsWith('.inlined.html'))
      .map((f) => path.join(target, f))
  : [target];

if (!files.length) {
  console.log(`No .html files under ${target}`);
  process.exit(0);
}

let totalExtracted = 0;
let anyOver = false;
for (const f of files) {
  const r = unpack(f);
  totalExtracted += r.extracted;
  anyOver = anyOver || r.over;
}

console.log('');
if (!APPLY && totalExtracted) console.log('Dry run. Run again with --apply to write the files.');
if (APPLY && totalExtracted) console.log('Upload the folder, not just the page: the pictures are beside it now.');
process.exit(anyOver ? 1 : 0);
