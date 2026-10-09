import { describe, expect, it } from 'vitest'
import { presignUrl } from '../../src/lib/presign'

// AWS's worked example: "Authenticating Requests: Using Query Parameters (AWS Signature Version 4)".
const example = { bucket: 'examplebucket', region: 'us-east-1', accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', now: new Date('2013-05-24T00:00:00Z') }

describe('time-limited bucket links', () => {
  it('matches AWS’s own worked example exactly', () => {
    expect(presignUrl({ ...example, method: 'GET', key: 'test.txt', expiresIn: 86400 })).toBe(
      'https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    )
  })

  it('signs the size and type of an upload, and escapes the key', () => {
    const url = new URL(presignUrl({ ...example, method: 'PUT', key: 'incoming/7/ab12/Proposal (final).pdf', expiresIn: 600, headers: { 'Content-Type': 'application/pdf', 'Content-Length': '12345678' } }))
    expect(url.pathname).toBe('/incoming/7/ab12/Proposal%20%28final%29.pdf')
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('600')
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
    // Another size is another signature: S3 refuses a different file under this link.
    const other = new URL(presignUrl({ ...example, method: 'PUT', key: 'incoming/7/ab12/Proposal (final).pdf', expiresIn: 600, headers: { 'Content-Type': 'application/pdf', 'Content-Length': '12345679' } }))
    expect(other.searchParams.get('X-Amz-Signature')).not.toBe(url.searchParams.get('X-Amz-Signature'))
  })

  /*
    Extra parameters, checked against links made by AWS's own presigner
    (@aws-sdk/s3-request-presigner 3.1067.0, global endpoint, no checksums) for
    the same inputs, once, outside this repository (9 October 2026).
  */
  it('a multipart upload part matches AWS exactly', () => {
    const url = new URL(presignUrl({ ...example, method: 'PUT', key: 'incoming/7/ab12/recording.webm', expiresIn: 3600, query: { 'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD', partNumber: '3', uploadId: 'VXBsb2FkIElEIGZvciA2aWWpbmcncyBteS1tb3ZpZS5tMnRzIHVwbG9hZA', 'x-id': 'UploadPart' } }))
    expect(url.searchParams.get('X-Amz-Signature')).toBe('d148ca223f05d646c8acc92b76c00d819a5c57cd64b6b67a9c2bd0476f2f0807')
    expect(url.searchParams.get('partNumber')).toBe('3')
  })

  it('a download with its own file name matches AWS exactly', () => {
    const url = new URL(presignUrl({ ...example, method: 'GET', key: 'pitch-videos/12/video.mp4', expiresIn: 21600, query: { 'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD', 'response-content-disposition': 'attachment; filename="Evermark Homes - Quadem.mp4"', 'x-id': 'GetObject' } }))
    expect(url.searchParams.get('X-Amz-Signature')).toBe('40520f1cdfd39728fc3c1b02a5e049ba6ee94c2e73baab531245f2b1ac020c47')
  })

  it('other regions and test endpoints', () => {
    expect(presignUrl({ ...example, region: 'eu-west-1', method: 'GET', key: 'a.txt', expiresIn: 60 })).toMatch(/^https:\/\/examplebucket\.s3\.eu-west-1\.amazonaws\.com\/a\.txt\?/)
    expect(presignUrl({ ...example, endpoint: 'http://localhost:9000', method: 'GET', key: 'a.txt', expiresIn: 60 })).toMatch(/^http:\/\/localhost:9000\/examplebucket\/a\.txt\?/)
  })
})
