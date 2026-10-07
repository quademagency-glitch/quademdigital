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

  it('other regions and test endpoints', () => {
    expect(presignUrl({ ...example, region: 'eu-west-1', method: 'GET', key: 'a.txt', expiresIn: 60 })).toMatch(/^https:\/\/examplebucket\.s3\.eu-west-1\.amazonaws\.com\/a\.txt\?/)
    expect(presignUrl({ ...example, endpoint: 'http://localhost:9000', method: 'GET', key: 'a.txt', expiresIn: 60 })).toMatch(/^http:\/\/localhost:9000\/examplebucket\/a\.txt\?/)
  })
})
