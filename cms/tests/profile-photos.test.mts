import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import sharp from 'sharp'
import { prepareProfilePhoto, PHOTO_MAX_BYTES } from '../src/lib/profilePhotos'
const out = '/tmp/quadem-team-completion-evidence'
await fs.mkdir(out, { recursive: true })
const original = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#005477' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer()
await fs.writeFile(`${out}/photo-sample.jpg`, original)
const clean = await prepareProfilePhoto(original, 'image/jpeg')
const info = await sharp(clean).metadata()
assert.equal(info.format, 'webp'); assert.equal(info.width, 512); assert.equal(info.height, 512)
assert.equal(info.exif, undefined); assert.equal(info.icc, undefined); assert.equal(info.orientation, undefined)
for (const format of ['png', 'webp'] as const) {
  const source = await sharp(original)[format]().toBuffer()
  assert.equal((await sharp(await prepareProfilePhoto(source, `image/${format}`)).metadata()).format, 'webp')
}
for (const [data, type] of [
  [Buffer.alloc(0), 'image/jpeg'], [Buffer.alloc(PHOTO_MAX_BYTES + 1), 'image/jpeg'],
  [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'), 'image/png'],
  [Buffer.from('not an image'), 'image/jpeg'], [original, 'text/html'],
] as const) await assert.rejects(() => prepareProfilePhoto(data, type))
await fs.writeFile(`${out}/photo-image-checks.json`, JSON.stringify({ passed: true, groups: 3, checks: ['JPEG PNG WebP decode and resize', 'orientation applied and metadata removed', 'empty oversized unsupported and spoofed images rejected'] }, null, 2))
console.log('PASS: 3 image validation groups')
