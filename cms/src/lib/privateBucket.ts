import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3'
import { createReadStream, createWriteStream } from 'node:fs'
import { open, stat } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'
import { presignUrl } from './presign'

/*
  The private bucket (S3_DOCUMENTS_BUCKET): agreements, signed documents,
  staged uploads and video pitches. One connection, shared, and the few things
  done to it directly rather than through Payload's storage plugin: links
  signed for the browser, large uploads in parts, and copies that never pass
  through the server's memory.

  Only actions the bucket's account already has are used: getting, putting,
  heading, listing and deleting objects. Multipart uploads are authorised by
  putting; an abandoned one is cleared by the bucket's one-day lifecycle rule
  (scripts/apply-bucket-cors.mjs), so aborting is only a courtesy.
*/

export type Store = { bucket: string; accessKeyId: string; secretAccessKey: string; region: string; endpoint?: string }

export const store = (): Store | null => {
  const bucket = process.env.S3_DOCUMENTS_BUCKET
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  if (!bucket || !accessKeyId || !secretAccessKey) return null
  const region = process.env.S3_REGION && process.env.S3_REGION !== 'auto' ? process.env.S3_REGION : 'us-east-1'
  return { bucket, accessKeyId, secretAccessKey, region, endpoint: process.env.S3_ENDPOINT || undefined }
}

let client: S3Client | null = null
export const s3 = (s: Store) =>
  (client ??= new S3Client({ region: s.region, endpoint: s.endpoint, forcePathStyle: Boolean(s.endpoint), credentials: { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey } }))

/** A link the browser can use directly. Extra `query` is signed too (a part's uploadId and partNumber, a download's file name). */
export const signed = (s: Store, method: 'GET' | 'PUT' | 'HEAD', key: string, expiresIn: number, extra: { headers?: Record<string, string>; query?: Record<string, string> } = {}) =>
  presignUrl({ method, bucket: s.bucket, key, region: s.region, accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey, expiresIn, endpoint: s.endpoint, headers: extra.headers, query: extra.query })

/** A download link that saves under `filename` rather than playing in the tab. */
export const downloadLink = (s: Store, key: string, filename: string, expiresIn: number) =>
  signed(s, 'GET', key, expiresIn, { query: { 'response-content-disposition': `attachment; filename="${filename.replace(/["\\\r\n]/g, '')}"` } })

export async function startMultipart(s: Store, key: string, contentType: string) {
  const r = await s3(s).send(new CreateMultipartUploadCommand({ Bucket: s.bucket, Key: key, ContentType: contentType }))
  if (!r.UploadId) throw new Error('The storage did not start the upload.')
  return r.UploadId
}

/** A one-part PUT link, its size signed so a different-sized piece is refused. */
export const partLink = (s: Store, key: string, uploadId: string, partNumber: number, size: number, expiresIn = 3600) =>
  signed(s, 'PUT', key, expiresIn, { headers: { 'content-length': String(size) }, query: { partNumber: String(partNumber), uploadId } })

export async function completeMultipart(s: Store, key: string, uploadId: string, parts: { n: number; etag: string }[]) {
  const sorted = [...parts].sort((a, b) => a.n - b.n)
  await s3(s).send(
    new CompleteMultipartUploadCommand({
      Bucket: s.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: sorted.map((p) => ({ PartNumber: p.n, ETag: p.etag })) },
    }),
  )
}

export const abortMultipart = (s: Store, key: string, uploadId: string) =>
  s3(s)
    .send(new AbortMultipartUploadCommand({ Bucket: s.bucket, Key: key, UploadId: uploadId }))
    .then(() => true, () => false)

/** Size and type of an object, or null when it is not there. */
export async function headObject(s: Store, key: string) {
  try {
    const h = await s3(s).send(new HeadObjectCommand({ Bucket: s.bucket, Key: key }))
    return { bytes: Number(h.ContentLength) || 0, type: h.ContentType ?? null }
  } catch {
    return null
  }
}

/** A copy inside the bucket. Nothing passes through this server. Up to 5 GB. */
export const copyObject = (s: Store, from: string, to: string, contentType?: string) =>
  s3(s).send(
    new CopyObjectCommand({
      Bucket: s.bucket,
      Key: to,
      CopySource: `${s.bucket}/${from.split('/').map(encodeURIComponent).join('/')}`,
      ...(contentType ? { ContentType: contentType, MetadataDirective: 'REPLACE' as const } : {}),
    }),
  )

export const deleteObject = (s: Store, key: string) => s3(s).send(new DeleteObjectCommand({ Bucket: s.bucket, Key: key })).then(() => true, () => false)

/** Every object under a prefix, such as one pitch's folder. */
export async function deletePrefix(s: Store, prefix: string): Promise<number> {
  if (!prefix.endsWith('/') || prefix.length < 4) throw new Error('A folder to delete ends with a slash.')
  let removed = 0
  let token: string | undefined
  do {
    const page = await s3(s).send(new ListObjectsV2Command({ Bucket: s.bucket, Prefix: prefix, ContinuationToken: token }))
    const keys = (page.Contents ?? []).filter((o) => o.Key).map((o) => ({ Key: o.Key! }))
    if (keys.length) {
      await s3(s).send(new DeleteObjectsCommand({ Bucket: s.bucket, Delete: { Objects: keys, Quiet: true } }))
      removed += keys.length
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)
  return removed
}

/** An object to a file on disk, streamed: never held in memory. */
export async function downloadToFile(s: Store, key: string, path: string) {
  const got = await s3(s).send(new GetObjectCommand({ Bucket: s.bucket, Key: key }))
  if (!got.Body) throw new Error('The stored file is empty.')
  await pipeline(got.Body as Readable, createWriteStream(path))
}

const PART = 16 * 1024 * 1024

/**
 * A file on disk to the bucket. Small files go in one request; larger ones in
 * 16 MiB parts read one at a time, each tried three times, so a long video never
 * sits in memory. A failed upload is abandoned (and aborted).
 */
export async function uploadFile(s: Store, path: string, key: string, contentType: string, cacheControl?: string) {
  const { size } = await stat(path)
  if (size <= PART) {
    await s3(s).send(new PutObjectCommand({ Bucket: s.bucket, Key: key, Body: createReadStream(path), ContentLength: size, ContentType: contentType, CacheControl: cacheControl }))
    return size
  }
  const upload = await s3(s).send(new CreateMultipartUploadCommand({ Bucket: s.bucket, Key: key, ContentType: contentType, CacheControl: cacheControl }))
  const uploadId = upload.UploadId!
  const parts: { n: number; etag: string }[] = []
  const fh = await open(path, 'r')
  try {
    for (let n = 1, at = 0; at < size; n++, at += PART) {
      const length = Math.min(PART, size - at)
      const buf = Buffer.alloc(length)
      await fh.read(buf, 0, length, at)
      let etag = ''
      for (let attempt = 1; ; attempt++) {
        try {
          const r = await s3(s).send(new UploadPartCommand({ Bucket: s.bucket, Key: key, UploadId: uploadId, PartNumber: n, Body: buf, ContentLength: length }))
          etag = r.ETag ?? ''
          break
        } catch (err) {
          if (attempt >= 3) throw err
          await new Promise((r) => setTimeout(r, attempt * 2000))
        }
      }
      parts.push({ n, etag })
    }
    await completeMultipart(s, key, uploadId, parts)
    return size
  } catch (err) {
    await abortMultipart(s, key, uploadId)
    throw err
  } finally {
    await fh.close()
  }
}
