import { createHash, createHmac } from 'node:crypto'

/*
  A time-limited link to one object in a bucket, signed with AWS Signature
  Version 4 in the query string. The AWS SDK's own presigner is not a
  dependency of this package (it arrives only inside @payloadcms/storage-s3,
  which pnpm keeps private), and adding it means a lockfile change this
  machine cannot make, so this is the published algorithm, checked against
  AWS's own worked example in tests/int/presign.int.spec.ts.

  `headers` are signed as well: a PUT signed with content-type and
  content-length accepts only a file of exactly that type and size.
*/

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')
const hmac = (key: Buffer | string, s: string) => createHmac('sha256', key).update(s, 'utf8').digest()
// RFC 3986, as S3 expects: everything but unreserved characters is escaped.
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
const encKey = (key: string) => key.split('/').map(enc).join('/')

export type Presign = {
  method: 'GET' | 'PUT' | 'HEAD' | 'DELETE'
  bucket: string
  key: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  expiresIn: number
  /** Signed headers beyond host, lower-case names. */
  headers?: Record<string, string>
  /** A non-AWS endpoint (path style), such as a local test server. */
  endpoint?: string
  /**
   * Extra query parameters, signed with the rest: a multipart part's
   * `uploadId` and `partNumber`, or a download's `response-content-disposition`.
   */
  query?: Record<string, string>
  now?: Date
}

export function presignUrl({ method, bucket, key, region, accessKeyId, secretAccessKey, expiresIn, headers = {}, endpoint, query: extra = {}, now = new Date() }: Presign): string {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const day = amzDate.slice(0, 8)
  const scope = `${day}/${region}/s3/aws4_request`
  const base = endpoint ? new URL(endpoint) : null
  const host = base ? base.host : `${bucket}.s3.${region === 'us-east-1' ? '' : `${region}.`}amazonaws.com`
  const path = base ? `/${enc(bucket)}/${encKey(key)}` : `/${encKey(key)}`
  const all: Record<string, string> = { host, ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()])) }
  const names = Object.keys(all).sort()
  const signedHeaders = names.join(';')
  const query: Record<string, string> = {
    ...extra,
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': signedHeaders,
  }
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${enc(k)}=${enc(query[k])}`)
    .join('&')
  const canonicalRequest = [method, path, canonicalQuery, names.map((n) => `${n}:${all[n]}\n`).join(''), signedHeaders, 'UNSIGNED-PAYLOAD'].join('\n')
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n')
  const key4 = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, day), region), 's3'), 'aws4_request')
  const signature = createHmac('sha256', key4).update(toSign, 'utf8').digest('hex')
  const origin = base ? `${base.protocol}//${base.host}` : `https://${host}`
  return `${origin}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`
}
