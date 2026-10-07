import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { CollectionSlug, Endpoint, PayloadRequest } from 'payload'
import { presignUrl } from './presign'

/*
  Files too big for the team portal's own server, which refuses anything over
  about 4 MB on its way through. The browser puts the file straight into the
  private documents bucket instead, then the CMS files it as an ordinary
  upload, with every check an ordinary upload has.

    POST /api/staged-uploads/start   {collection, filename, size, mimeType}
      -> a ten-minute link that accepts exactly that file, and a ticket
    POST /api/staged-uploads/finish  {ticket, data}
      -> the record, created as the signed-in person

  The file waits under incoming/<their id>/, a place only this route reads.
  The ticket is signed with the CMS secret and names the holding key, the
  collection, the size and type, and whose it is, so finishing cannot pick up
  another person's file or any file already stored. (Payload's own
  direct-upload route can: see lib/uploadGuard.ts, which refuses it.)

  Only the collections the portal uploads large files to are offered, and
  only to someone who may create in them.
*/

export const STAGED_MAX_BYTES = 25 * 1024 * 1024
export const STAGED_COLLECTIONS = ['documents', 'signature-requests', 'proposals'] as const
const LINK_SECONDS = 600
const TICKET_SECONDS = 3600

type Ticket = { k: string; c: string; n: string; t: string; s: number; u: string; e: number }

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url')
const mac = (body: string, secret: string) => createHmac('sha256', secret).update(body).digest('base64url')

export function signTicket(t: Ticket, secret: string) {
  const body = b64(JSON.stringify(t))
  return `${body}.${mac(body, secret)}`
}

export function readTicket(token: unknown, secret: string, now = Date.now()): Ticket | null {
  if (typeof token !== 'string' || !secret) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const want = Buffer.from(mac(body, secret))
  const got = Buffer.from(sig)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  try {
    const t = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Ticket
    return t.e * 1000 > now ? t : null
  } catch {
    return null
  }
}

/** A file name safe as part of a storage key, keeping its extension. */
export const safeName = (name: unknown) => String(name ?? '').replace(/[^\w.\-() ]+/g, '_').replace(/^\.+/, '').slice(-120) || 'file'

const allowedType = (mime: string, allowed: string[] | undefined) =>
  !allowed?.length || allowed.some((a) => a === mime || (a.endsWith('/*') && mime.startsWith(a.slice(0, -1))))

const store = () => {
  const bucket = process.env.S3_DOCUMENTS_BUCKET
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  if (!bucket || !accessKeyId || !secretAccessKey) return null
  const region = process.env.S3_REGION && process.env.S3_REGION !== 'auto' ? process.env.S3_REGION : 'us-east-1'
  return { bucket, accessKeyId, secretAccessKey, region, endpoint: process.env.S3_ENDPOINT || undefined }
}

let client: S3Client | null = null
const s3 = (s: NonNullable<ReturnType<typeof store>>) =>
  (client ??= new S3Client({ region: s.region, endpoint: s.endpoint, forcePathStyle: Boolean(s.endpoint), credentials: { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey } }))

const mb = (n: number) => `${Math.round((n / 1024 / 1024) * 10) / 10} MB`
const say = (error: string, status: number) => Response.json({ error }, { status })

async function body(req: PayloadRequest): Promise<Record<string, unknown>> {
  try {
    return ((await req.json?.()) ?? {}) as Record<string, unknown>
  } catch {
    return {}
  }
}

async function mayCreate(req: PayloadRequest, slug: string) {
  const access = req.payload.collections[slug as CollectionSlug]?.config.access.create
  if (!access) return false
  return Boolean(await access({ req } as never))
}

export const stagedUploadEndpoints: Endpoint[] = [
  {
    path: '/staged-uploads/start',
    method: 'post',
    handler: async (req) => {
      if (!req.user) return say('Sign in first.', 401)
      const { collection, filename, size, mimeType } = await body(req)
      const slug = String(collection ?? '')
      if (!(STAGED_COLLECTIONS as readonly string[]).includes(slug)) return say('Large files go to documents, signing or deals.', 400)
      if (!(await mayCreate(req, slug))) return say('You cannot add files there.', 403)
      const s = store()
      if (!s) return say('Large files need the storage bucket, which is not set up here.', 503)
      const bytes = Number(size)
      if (!Number.isInteger(bytes) || bytes <= 0) return say('That file is empty.', 400)
      if (bytes > STAGED_MAX_BYTES) return say(`That file is ${mb(bytes)}. The most is ${mb(STAGED_MAX_BYTES)}.`, 400)
      const type = String(mimeType ?? '')
      const allowed = (req.payload.collections[slug as CollectionSlug].config.upload as { mimeTypes?: string[] } | undefined)?.mimeTypes
      if (!type || !allowedType(type, allowed)) return say('That kind of file cannot go there.', 400)
      if (!process.env.PAYLOAD_SECRET) return say('The CMS is missing its secret.', 503)

      const key = `incoming/${req.user.id}/${randomUUID()}/${safeName(filename)}`
      const url = presignUrl({ ...s, method: 'PUT', key, expiresIn: LINK_SECONDS, headers: { 'content-type': type, 'content-length': String(bytes) } })
      const ticket = signTicket({ k: key, c: slug, n: safeName(filename), t: type, s: bytes, u: String(req.user.id), e: Math.floor(Date.now() / 1000) + TICKET_SECONDS }, process.env.PAYLOAD_SECRET)
      return Response.json({ url, ticket, headers: { 'Content-Type': type } })
    },
  },
  {
    path: '/staged-uploads/finish',
    method: 'post',
    handler: async (req) => {
      if (!req.user) return say('Sign in first.', 401)
      const { ticket: token, data } = await body(req)
      const t = readTicket(token, process.env.PAYLOAD_SECRET ?? '')
      if (!t) return say('That upload has run out of time. Upload the file again.', 400)
      if (t.u !== String(req.user.id) || !t.k.startsWith(`incoming/${req.user.id}/`)) return say('That upload is not yours.', 403)
      const s = store()
      if (!s) return say('Large files need the storage bucket, which is not set up here.', 503)
      const head = await s3(s)
        .send(new HeadObjectCommand({ Bucket: s.bucket, Key: t.k }))
        .catch(() => null)
      if (!head) return say('The file did not arrive. Upload it again.', 400)
      if (Number(head.ContentLength) !== t.s) return say('The file that arrived is not the one chosen. Upload it again.', 400)
      const got = await s3(s).send(new GetObjectCommand({ Bucket: s.bucket, Key: t.k }))
      const bytes = Buffer.from((await got.Body?.transformToByteArray()) ?? [])
      if (bytes.length !== t.s) return say('The file could not be read back. Upload it again.', 502)

      // Filed as the person, with every check an upload from them has.
      const doc = await req.payload.create({
        collection: t.c as CollectionSlug,
        data: (data && typeof data === 'object' ? data : {}) as never,
        file: { data: bytes, mimetype: t.t, name: t.n, size: t.s },
        user: req.user,
        overrideAccess: false,
        depth: 0,
        req,
      })
      await s3(s)
        .send(new DeleteObjectCommand({ Bucket: s.bucket, Key: t.k }))
        .catch((err) => req.payload.logger.warn({ err, key: t.k }, 'A staged upload was filed but its holding copy was not removed'))
      return Response.json({ doc }, { status: 201 })
    },
  },
]
