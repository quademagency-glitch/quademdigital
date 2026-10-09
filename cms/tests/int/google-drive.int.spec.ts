import { describe, expect, it } from 'vitest'
import { connectState, connectUrl, DRIVE_SCOPE, folderName, readState, redirectUri, sealToken, SUBFOLDERS, unsealToken } from '../../src/lib/googleDrive'

/* The pure rules of the Google Drive connection (lib/googleDrive.ts). The folders themselves, against a stand-in Google, are in api.int.spec.ts. */
describe('the Google Drive connection, its rules', () => {
  it('seals the refresh token so only this CMS can open it', () => {
    const sealed = sealToken('1//refresh-token', 'secret-a')
    expect(sealed).not.toContain('refresh-token')
    expect(unsealToken(sealed, 'secret-a')).toBe('1//refresh-token')
    expect(unsealToken(sealed, 'secret-b')).toBeNull()
    const [v, iv, tag, body] = sealed.split('.')
    expect(unsealToken([v, iv, tag, body.slice(0, -2) + 'AA'].join('.'), 'secret-a')).toBeNull()
    expect(unsealToken('', 'secret-a')).toBeNull()
  })

  it('carries who asked through Google and back, for ten minutes only', () => {
    const now = Date.parse('2026-10-09T10:00:00Z')
    const state = connectState(7, 'secret-a', now)
    expect(readState(state, 'secret-a', now + 60_000)).toBe('7')
    expect(readState(state, 'secret-a', now + 11 * 60_000)).toBeNull()
    expect(readState(state, 'secret-b', now)).toBeNull()
    const [body, sig] = state.split('.')
    expect(readState(`${body}x.${sig}`, 'secret-a', now)).toBeNull()
    expect(readState('nonsense', 'secret-a', now)).toBeNull()
  })

  it('asks Google only to make and share its own folders, and for a lasting connection', () => {
    process.env.GOOGLE_CLIENT_ID = 'client-123.apps.googleusercontent.com'
    const url = new URL(connectUrl(7, 'secret-a'))
    delete process.env.GOOGLE_CLIENT_ID
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('scope')!.split(' ')).toEqual([DRIVE_SCOPE, 'openid', 'email'])
    expect(DRIVE_SCOPE).toBe('https://www.googleapis.com/auth/drive.file')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('redirect_uri')).toBe(redirectUri())
    expect(redirectUri()).toMatch(/^https:\/\/team\.quademdigital\.com\/settings\/google-drive\/done$/)
    expect(readState(url.searchParams.get('state'), 'secret-a')).toBe('7')
  })

  it('names the folder for the client, and keeps no place for passwords', () => {
    expect(folderName('Mama Ade’s Kitchen ')).toBe('Mama Ade’s Kitchen · Quadem Digital')
    expect(folderName('')).toBe('New client · Quadem Digital')
    expect(SUBFOLDERS).toEqual(['Logo and brand', 'Photos and videos', 'Words and documents', 'Anything else'])
    expect(SUBFOLDERS.join(' ')).not.toMatch(/password|login|access/i)
  })
})
