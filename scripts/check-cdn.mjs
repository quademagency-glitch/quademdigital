#!/usr/bin/env node
/**
 * Is the media CDN safe to switch on?
 *
 * Pointing the site's images at a new hostname is a change with no half
 * measures: get it wrong and every picture on every page is a broken icon, all
 * at once. So this asks the CDN for real files that really exist, checks the
 * bytes match what the CMS serves today, and checks the headers that make a CDN
 * worth having are actually there.
 *
 * Run it BEFORE setting MEDIA_CDN_URL on the CMS, not after.
 *
 *   node scripts/check-cdn.mjs https://media.quademdigital.com
 *
 * With no argument it reads MEDIA_CDN_URL, and says what to do if that is unset
 * too. Exit code 0 means switch it on; anything else means do not.
 */

const CMS = (process.env.PUBLIC_PAYLOAD_URL || 'https://cms.quademdigital.com').replace(/\/$/, '');
const cdn = (process.argv[2] || process.env.MEDIA_CDN_URL || '').replace(/\/$/, '');

/** How many real files to check. Enough to catch a prefix or encoding mistake. */
const SAMPLE = 8;

const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => { console.log(`  FAIL  ${m}`); failures++; };
let failures = 0;

if (!cdn) {
  console.log(`No CDN to check.

Pass one as an argument, or set MEDIA_CDN_URL:

  node scripts/check-cdn.mjs https://media.quademdigital.com

Until that exists, images are served by the CMS at ${CMS}, which works and is
simply slower. Nothing is broken.`);
  process.exit(0);
}

if (!/^https:\/\//.test(cdn)) {
  console.log(`FAIL  ${cdn} is not https. Browsers will refuse it on an https page.`);
  process.exit(1);
}

console.log(`CDN:  ${cdn}`);
console.log(`CMS:  ${CMS}\n`);

// Real documents, so a mistake in how the key is built shows up here rather
// than on the homepage.
const res = await fetch(`${CMS}/api/media?limit=${SAMPLE}&depth=0`);
if (!res.ok) {
  console.log(`FAIL  could not list media from the CMS (HTTP ${res.status}). Check it is up.`);
  process.exit(1);
}
const docs = (await res.json()).docs || [];
if (!docs.length) {
  console.log('FAIL  the CMS returned no media, so there is nothing to check against.');
  process.exit(1);
}

const key = (filename, prefix) =>
  prefix ? `${prefix}/${encodeURIComponent(filename)}` : encodeURIComponent(filename);

let checkedSizes = 0;

for (const doc of docs) {
  const url = `${cdn}/${key(doc.filename, doc.prefix)}`;
  console.log(doc.filename);

  let r;
  try {
    r = await fetch(url);
  } catch (err) {
    fail(`could not be fetched at all: ${err.message}`);
    continue;
  }

  if (r.status !== 200) {
    fail(`HTTP ${r.status} from the CDN. Either the origin path is wrong or the file is not public.`);
    continue;
  }
  pass('served');

  const bytes = (await r.arrayBuffer()).byteLength;
  if (doc.filesize && bytes !== doc.filesize) {
    fail(`served ${bytes} bytes, the CMS says the file is ${doc.filesize}. That is a different file.`);
  } else {
    pass(`${bytes} bytes, matching the CMS`);
  }

  const type = r.headers.get('content-type') || '';
  if (doc.mimeType && !type.startsWith(doc.mimeType.split('/')[0])) {
    fail(`content-type is "${type}", should be "${doc.mimeType}". Browsers will refuse to render it.`);
  } else {
    pass(`content-type ${type}`);
  }

  const cache = r.headers.get('cache-control') || '';
  if (!/max-age=\d{5,}/.test(cache)) {
    fail(`cache-control is "${cache || 'missing'}". Without a long max-age a returning visitor
        refetches every image, which is most of what a CDN is for. Set it on the
        CDN's response headers policy.`);
  } else {
    pass(`cache-control ${cache}`);
  }

  // The resized copies are separate objects and are what pages actually use.
  const sizes = Object.values(doc.sizes || {}).filter((s) => s && s.filename);
  if (sizes.length) {
    const s = sizes[0];
    const sr = await fetch(`${cdn}/${key(s.filename, doc.prefix)}`).catch(() => null);
    if (!sr || sr.status !== 200) {
      fail(`the resized copy ${s.filename} is ${sr ? `HTTP ${sr.status}` : 'unreachable'}. Pages use these, not the original.`);
    } else {
      pass(`resized copy ${s.filename} served`);
      checkedSizes++;
    }
  }
  console.log('');
}

if (!checkedSizes) {
  console.log('Note: none of the sampled files had resized copies to check.\n');
}

if (failures) {
  console.log(`${failures} problem(s). Do NOT set MEDIA_CDN_URL yet.`);
  process.exit(1);
}
console.log(`All good. Safe to set MEDIA_CDN_URL=${cdn} on the CMS service in Railway.
Redeploy is automatic; images move over within a couple of minutes.
To undo it, remove that variable. Nothing else changes.`);
