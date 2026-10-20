#!/usr/bin/env node
// Replace the dated Omek portfolio cover with a verified screenshot of the live store.
// Run from the repo root with: node --env-file=.env cms/scripts/update-omek-storefront-cover.mjs [--apply]
// The default is a read-only preview. The previous media file is retained in the CMS.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const out = path.resolve('output/omek-storefront-image-2026-09-27');
const filename = 'omek-storefront-current-2026-09-27.webp';
const image = path.join(out, filename);
const base = process.env.PUBLIC_PAYLOAD_URL?.replace(/\/$/, '');
assert.equal(new URL(base).hostname, 'cms.quademdigital.com');
assert.ok(process.env.PAYLOAD_API_KEY, 'PAYLOAD_API_KEY is required');
const auth = { Authorization: `users API-Key ${process.env.PAYLOAD_API_KEY}` };

async function api(route, options = {}) {
  const response = await fetch(`${base}/api/${route}`, {
    ...options, headers: { ...auth, ...options.headers },
  });
  assert.ok(response.ok, `CMS ${options.method || 'GET'} ${route}: ${response.status}`);
  return response.json();
}

const current = await api('caseStudies/5?depth=0');
assert.equal(current.slug, 'omek-storefront');
assert.equal(current.published, true);
await fs.access(image);
const alt = 'Omek Gigs Appliances homepage with its logo, white navigation and Big nights. Brilliant pictures. television hero.';
console.log(JSON.stringify({ apply: process.argv.includes('--apply'), caseStudy: current.id, previousCover: current.coverImage, replacement: image, alt }));
if (!process.argv.includes('--apply')) process.exit(0);

await fs.mkdir(out, { recursive: true });
const backup = path.join(out, 'case-study-before.json');
try { await fs.writeFile(backup, JSON.stringify(current, null, 2), { flag: 'wx' }); }
catch (error) { if (error.code !== 'EEXIST') throw error; }

// A new filename avoids the immutable media cache and retains the old asset for rollback.
const existing = await api(`media?where[filename][equals]=${filename}&depth=0`);
let media = existing.docs[0];
if (!media) {
  const form = new FormData();
  form.append('file', new Blob([await fs.readFile(image)], { type: 'image/webp' }), filename);
  form.append('_payload', JSON.stringify({
    alt, kind: 'raw',
    credit: 'Browser screenshot of https://www.omekgh.com/ captured 27 September 2026 at 1600 x 1000. Essential cookies only. No generated or altered storefront content.',
  }));
  const uploaded = await api('media', { method: 'POST', body: form });
  media = uploaded.doc;
}
assert.ok(media?.id, 'Upload did not return a media ID');
assert.equal(media.width, 1600);
assert.equal(media.height, 1000);
await fs.writeFile(path.join(out, 'new-media.json'), JSON.stringify(media, null, 2));

const latest = await api('caseStudies/5?depth=0');
assert.equal(latest.coverImage, current.coverImage, 'Cover changed during upload; inspect before updating');
await api('caseStudies/5', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ coverImage: media.id }),
});
const after = await api('caseStudies/5?depth=0');
assert.equal(after.coverImage, media.id);
const unrelated = doc => Object.fromEntries(Object.entries(doc).filter(([key]) => !['coverImage', 'updatedAt'].includes(key)));
assert.deepEqual(unrelated(after), unrelated(latest), 'Unrelated case-study fields changed');
await fs.writeFile(path.join(out, 'case-study-after.json'), JSON.stringify(after, null, 2));
console.log(JSON.stringify({ updated: true, caseStudy: after.id, oldMediaRetained: current.coverImage, newCover: media.id, filename: media.filename, unrelatedFieldsUnchanged: true }));
