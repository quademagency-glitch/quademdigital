import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { appChallenge, base32, fromBase32, hotp, isRecoveryShape, otpauthUri, recoveryCodes, recoveryHash, seal, stepAt, totpStep, unseal } from '../../src/lib/authenticatorApp'
import { securityChallengeResponse } from '../../src/lib/securityChallengeResponse'

describe('authenticator app codes (spec 14.11)', () => {
  // RFC 6238 appendix B (SHA-1), cut to the six digits the apps show.
  const key = Buffer.from('12345678901234567890')
  it('match the standard test vectors', () => {
    for (const [t, code] of [
      [59, '287082'],
      [1111111109, '081804'],
      [1111111111, '050471'],
      [1234567890, '005924'],
      [2000000000, '279037'],
    ] as const) expect(hotp(key, stepAt(t * 1000))).toBe(code)
  })

  it('a code is good for its half minute and the one either side, nothing wider', () => {
    const secret = base32(key)
    const now = 1111111111_000
    expect(totpStep(secret, '050471', now)).toBe(stepAt(now))
    expect(totpStep(secret, '050 471', now)).toBe(stepAt(now))
    expect(totpStep(secret, hotp(key, stepAt(now) + 1), now)).toBe(stepAt(now) + 1)
    expect(totpStep(secret, hotp(key, stepAt(now) - 2), now)).toBeNull()
    expect(totpStep(secret, 'abcdef', now)).toBeNull()
  })

  it('base32 goes both ways, as the apps read it', () => {
    const b = randomBytes(20)
    expect(fromBase32(base32(b)).equals(b)).toBe(true)
    expect(base32(Buffer.from('foobar'))).toBe('MZXW6YTBOI')
  })

  it('the QR code names Quadem and the person', () => {
    expect(otpauthUri('JBSWY3DPEHPK3PXP', 'ama@example.test')).toBe('otpauth://totp/Quadem%3Aama%40example.test?secret=JBSWY3DPEHPK3PXP&issuer=Quadem&algorithm=SHA1&digits=6&period=30')
  })

  it('the secret is sealed at rest and opens only with the same server secret', () => {
    const sealed = seal('JBSWY3DPEHPK3PXP', 'server-secret')
    expect(sealed).not.toContain('JBSWY3DPEHPK3PXP')
    expect(unseal(sealed, 'server-secret')).toBe('JBSWY3DPEHPK3PXP')
    expect(unseal(sealed, 'other-secret')).toBeNull()
    expect(unseal(null, 'server-secret')).toBeNull()
  })

  it('recovery codes: eight different, kept only as a keyed hash per person', () => {
    const codes = recoveryCodes()
    expect(new Set(codes).size).toBe(8)
    for (const c of codes) expect(isRecoveryShape(c)).toBe(true)
    expect(recoveryHash('s', 7, codes[0])).toBe(recoveryHash('s', 7, codes[0].toUpperCase()))
    expect(recoveryHash('s', 7, codes[0])).not.toBe(recoveryHash('s', 8, codes[0]))
  })

  it("the app's challenge looks like an email one, so the sign-in forms keep the code field", () => {
    const challenge = appChallenge('server-secret', 12)
    expect(challenge).toMatch(/^[a-f0-9]{64}$/)
    const out = securityChallengeResponse({ error: Object.assign(new Error('Enter the six-digit code from your authenticator app.'), { status: 428, isPublic: true, data: { securityChallenge: challenge, method: 'app' } }) } as never)
    expect(out).toEqual({ status: 428, response: { errors: [{ message: 'Enter the six-digit code from your authenticator app.', data: { securityChallenge: challenge, method: 'app' } }] } })
    const email = securityChallengeResponse({ error: Object.assign(new Error('x'), { status: 428, isPublic: true, data: { securityChallenge: challenge } }) } as never)
    expect((email as { response: { errors: { data: { method: string } }[] } }).response.errors[0].data.method).toBe('email')
  })
})
