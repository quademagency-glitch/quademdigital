import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Reads a stored upload back as bytes, for stamping.
 *
 * Signing documents live in the private documents bucket, under their own
 * prefix so a contract called "agreement.pdf" cannot overwrite a team file of
 * the same name in the same bucket. Without S3_DOCUMENTS_BUCKET, uploads land
 * on the container's disk instead, which is where this looks then.
 */

let client: S3Client | null = null
const s3 = () =>
  (client ??= new S3Client({
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '' },
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined,
  }))

export async function readUpload(doc: { filename?: string | null; prefix?: string | null }, slug: string): Promise<Uint8Array> {
  if (!doc.filename) throw new Error('This record has no file.')
  const bucket = process.env.S3_DOCUMENTS_BUCKET
  if (bucket) {
    const Key = doc.prefix ? `${doc.prefix}/${doc.filename}` : doc.filename
    const res = await s3().send(new GetObjectCommand({ Bucket: bucket, Key }))
    if (!res.Body) throw new Error(`The stored file ${Key} came back empty.`)
    return new Uint8Array(await res.Body.transformToByteArray())
  }
  return new Uint8Array(await fs.readFile(path.resolve(process.cwd(), slug, doc.filename)))
}
