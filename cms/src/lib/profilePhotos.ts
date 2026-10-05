import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { sql } from '@payloadcms/db-postgres'
import { APIError, commitTransaction, initTransaction, killTransaction, type CollectionBeforeDeleteHook, type Endpoint, type PayloadRequest } from 'payload'
import { securityTransaction } from './securityDatabase'

export const PHOTO_MAX_BYTES = 4 * 1024 * 1024
const FORM_MAX_BYTES = PHOTO_MAX_BYTES + 32 * 1024
const MIMES = ['image/jpeg', 'image/png', 'image/webp']
const idOf = (value: unknown) => value && typeof value === 'object' ? (value as { id: number }).id : value as number | null

/** Decode the bytes, apply phone orientation, crop and re-encode without EXIF/GPS. */
export async function prepareProfilePhoto(data: Buffer, mime: string) {
  if (!data.length) throw new APIError('Choose a photo first.', 400)
  if (data.length > PHOTO_MAX_BYTES) throw new APIError('Choose a photo smaller than 4 MB.', 400)
  if (!MIMES.includes(mime)) throw new APIError('Use a JPG, PNG or WebP photo.', 400)
  try {
    const photo = sharp(data, { limitInputPixels: 40_000_000, failOn: 'warning' })
    const info = await photo.metadata()
    if (!['jpeg', 'png', 'webp'].includes(info.format || '') || (info.pages ?? 1) > 1) throw new Error('Unsupported photo')
    return await photo.rotate().resize(512, 512, { fit: 'cover' }).webp({ quality: 84 }).toBuffer()
  } catch {
    throw new APIError('That photo could not be opened. Choose a still JPG, PNG or WebP under 40 megapixels.', 400)
  }
}

async function readPhoto(req: PayloadRequest) {
  if (!req.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new APIError('Choose a photo first.', 400)
  if (Number(req.headers.get('content-length')) > FORM_MAX_BYTES) throw new APIError('Choose a photo smaller than 4 MB.', 400)
  // Bound the body even when content-length is missing or incorrect.
  const reader = req.body?.getReader()
  if (!reader) throw new APIError('Choose a photo first.', 400)
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.length
    if (size > FORM_MAX_BYTES) {
      await reader.cancel()
      throw new APIError('Choose a photo smaller than 4 MB.', 400)
    }
    chunks.push(value)
  }
  let form: FormData
  try {
    form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': req.headers.get('content-type')! } }).formData()
  } catch {
    throw new APIError('Choose a photo and try again.', 400)
  }
  const files = form.getAll('file')
  if (files.length !== 1 || !(files[0] instanceof File)) throw new APIError('Choose one photo.', 400)
  return prepareProfilePhoto(Buffer.from(await files[0].arrayBuffer()), files[0].type)
}

async function changePhoto(req: PayloadRequest, remove: boolean) {
  const user = req.user
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 })
  if (!['admin', 'team'].includes(user.role) || user.status === 'ended') return Response.json({ error: 'This account cannot change a team photo.' }, { status: 403 })
  const bytes = remove ? null : await readPhoto(req)
  let previous: number | null = null
  let created: number | null = null
  await initTransaction(req)
  try {
    // Serialise upload/remove across tabs and servers before reading the old pointer.
    const transaction = await securityTransaction(req)
    await transaction.execute(sql`SELECT id FROM users WHERE id = ${user.id} FOR NO KEY UPDATE`)
    const current = await req.payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: false, req })
    if (!['admin', 'team'].includes(current.role) || current.status === 'ended') throw new APIError('This account cannot change a team photo.', 403)
    previous = idOf(current.profilePhoto)
    if (bytes) {
      const photo = await req.payload.create({
        // Its own transaction lets a failed account update delete the new file
        // through Payload's storage adapter after the outer transaction rolls back.
        collection: 'profile-photos', data: { owner: user.id }, depth: 0, overrideAccess: true,
        file: { data: bytes, mimetype: 'image/webp', name: `${randomUUID()}.webp`, size: bytes.length },
      })
      created = photo.id
    }
    req.context.profilePhotoWrite = true
    // The caller cannot choose the target account or attach another person's upload.
    await req.payload.update({ collection: 'users', id: user.id, data: { profilePhoto: created, avatar: null }, depth: 0, overrideAccess: false, req })
    await commitTransaction(req)
  } catch (error) {
    await killTransaction(req)
    if (created) {
      try { await req.payload.delete({ collection: 'profile-photos', id: created, overrideAccess: true }) }
      catch (cleanupError) { req.payload.logger.error({ err: cleanupError, msg: 'Could not remove failed profile photo', photoId: created }) }
    }
    throw error
  } finally {
    delete req.context.profilePhotoWrite
  }
  if (previous) {
    // Delete only our private predecessor. Legacy public Media images may be shared.
    try {
      const old = await req.payload.findByID({ collection: 'profile-photos', id: previous, depth: 0, overrideAccess: true })
      if (String(idOf(old.owner)) === String(user.id)) await req.payload.delete({ collection: 'profile-photos', id: previous, overrideAccess: true })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'Could not remove replaced private profile photo', photoId: previous })
    }
  }
  return Response.json({ ok: true, photoId: created }, { headers: { 'Cache-Control': 'no-store' } })
}

export const profilePhotoEndpoints: Endpoint[] = [
  { path: '/profile-photo', method: 'post', handler: (req) => changePhoto(req, false) },
  { path: '/profile-photo', method: 'delete', handler: (req) => changePhoto(req, true) },
]

export const deleteProfilePhotos: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({ collection: 'profile-photos', where: { owner: { equals: id } }, overrideAccess: true, req })
}
