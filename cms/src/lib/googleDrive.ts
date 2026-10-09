import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Payload } from 'payload'
import { TEAM_PORTAL_URL } from './teamEmails'

/*
  A Google Drive folder for each new client (Ernest, 9 October 2026): "If we
  get a new client as won, the email requesting what we need from them should
  come with an auto-generated google drive link which they can drop all things
  that would go in."

  Quadem's Drive is Google Workspace (ernest@quademdigital.com). Ernest
  connects it once from the portal (Settings, Google Drive): Google asks him to
  approve, and the CMS keeps the refresh token, sealed with PAYLOAD_SECRET. The
  scope is drive.file, so the CMS sees and changes only the folders it made
  itself, never the rest of his Drive. It makes "Quadem clients" in his Drive
  and in it one folder per client, with four subfolders, that anyone with the
  link can add to (his choice). The folders are his.

  A Google key was not used: new Workspace accounts refuse service account keys
  by default since 2024. No package either: Google's sign-in and Drive APIs are
  plain HTTPS. Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the CMS.
*/

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const DRIVE = 'https://www.googleapis.com/drive/v3'
const FOLDER = 'application/vnd.google-apps.folder'
const SLUG = 'google-drive'

export const ROOT_NAME = 'Quadem clients'
/** One for each kind of thing the setup checklist asks for. Logins and passwords are never put in a folder: they come by reply. */
export const SUBFOLDERS = ['Logo and brand', 'Photos and videos', 'Words and documents', 'Anything else'] as const

export const redirectUri = () => `${TEAM_PORTAL_URL}/settings/google-drive/done`
export const driveConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

/** The folder's name, as the client sees it in their own Drive too. */
export const folderName = (clientName: unknown) => `${String(clientName || 'New client').trim().slice(0, 120)} · Quadem Digital`

// ── Sealing the refresh token, and the state that carries Ernest through Google and back ──

const sealKey = (secret: string) => createHash('sha256').update(`quadem-google-drive:${secret}`).digest()

export function sealToken(plain: string, secret: string) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', sealKey(secret), iv)
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return `v1.${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${body.toString('base64url')}`
}

export function unsealToken(sealed: unknown, secret: string): string | null {
  const [v, iv, tag, body] = String(sealed ?? '').split('.')
  if (v !== 'v1' || !iv || !tag || !body) return null
  try {
    const d = createDecipheriv('aes-256-gcm', sealKey(secret), Buffer.from(iv, 'base64url'))
    d.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8')
  } catch {
    return null
  }
}

const stateSig = (body: string, secret: string) => createHmac('sha256', secret).update(`google-drive-state:${body}`).digest('base64url')

/** Who asked to connect, for ten minutes: checked when Google sends them back. */
export function connectState(userId: string | number, secret: string, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ u: String(userId), e: now + 10 * 60_000, n: randomBytes(9).toString('base64url') })).toString('base64url')
  return `${body}.${stateSig(body, secret)}`
}

export function readState(state: unknown, secret: string, now = Date.now()): string | null {
  const [body, sig] = String(state ?? '').split('.')
  if (!body || !sig) return null
  const want = Buffer.from(stateSig(body, secret))
  const got = Buffer.from(sig)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  try {
    const s = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    return typeof s.u === 'string' && Number(s.e) > now ? s.u : null
  } catch {
    return null
  }
}

/** Google's approval page. Offline access and a fresh consent, so Google always hands back a lasting refresh token. */
export function connectUrl(userId: string | number, secret: string) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: `${DRIVE_SCOPE} openid email`,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: connectState(userId, secret),
  })
  return `${AUTH_URL}?${q}`
}

// ── Talking to Google ──

export class DriveNotConnected extends Error {
  constructor(message = 'Google Drive is not connected. Connect it in the portal: Settings, Google Drive.') {
    super(message)
  }
}

type TokenReply = { access_token?: string; expires_in?: number; refresh_token?: string; scope?: string; id_token?: string; error?: string; error_description?: string }

async function tokenRequest(body: Record<string, string>): Promise<TokenReply> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '', ...body }),
    signal: AbortSignal.timeout(20_000),
  })
  const reply = (await res.json().catch(() => ({}))) as TokenReply
  if (!res.ok || !reply.access_token) {
    if (reply.error === 'invalid_grant') throw new DriveNotConnected('The Google Drive connection was removed or has expired. Connect it again in the portal: Settings, Google Drive.')
    throw new Error(`Google sign-in refused: ${reply.error_description || reply.error || res.status}`)
  }
  return reply
}

type Connection = { email?: string | null; refreshToken?: string | null; rootFolderId?: string | null; rootFolderUrl?: string | null; connectedAt?: string | null; lastError?: string | null }

export const readConnection = async (payload: Payload) => (await payload.findGlobal({ slug: SLUG as never, depth: 0, overrideAccess: true })) as Connection

const writeConnection = (payload: Payload, data: Connection) => payload.updateGlobal({ slug: SLUG as never, data: data as never, depth: 0, overrideAccess: true })

let cached: { token: string; until: number; sealed: string } | null = null

/** A short-lived Google access token, from the sealed refresh token; kept until a minute before it expires. */
async function accessToken(payload: Payload) {
  if (!driveConfigured()) throw new DriveNotConnected('Google Drive is not set up on the CMS (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET).')
  const c = await readConnection(payload)
  const refresh = unsealToken(c.refreshToken, process.env.PAYLOAD_SECRET || '')
  if (!refresh) throw new DriveNotConnected()
  if (cached && cached.sealed === c.refreshToken && cached.until > Date.now()) return cached.token
  try {
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refresh })
    cached = { token: t.access_token!, until: Date.now() + ((t.expires_in || 3600) - 60) * 1000, sealed: c.refreshToken! }
    return t.access_token!
  } catch (error) {
    if (error instanceof DriveNotConnected) await writeConnection(payload, { lastError: error.message }).catch(() => {})
    throw error
  }
}

/** Google's words when a Workspace setting stops a folder being shared by link, in Ernest's. */
function plainDriveError(status: number, message: string, reason: string) {
  if (/publishOutNotPermitted|sharingRateLimit|cannotShare|teamDrivesSharingRestrictionNotAllowed/.test(reason) || /not (allowed|permitted).*shar|shar.*not (allowed|permitted)/i.test(message)) {
    return 'Your Google Workspace does not let files be shared by link outside quademdigital.com. In the Google Admin console: Apps, Google Workspace, Drive and Docs, Sharing settings: allow sharing outside quademdigital.com, with anyone who has the link.'
  }
  if (status === 401) return 'Google did not accept the Drive connection. Connect it again in the portal: Settings, Google Drive.'
  if (status === 403 && /rateLimit|userRateLimit/.test(reason)) return 'Google asked us to slow down. Try again in a minute.'
  return `Google Drive: ${message || `error ${status}`}`
}

async function drive<T>(payload: Payload, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await accessToken(payload)
  const res = await fetch(`${DRIVE}${path}`, {
    method: init.method || 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  })
  if (res.ok) return (await res.json().catch(() => ({}))) as T
  const err = (await res.json().catch(() => ({}))) as { error?: { message?: string; errors?: { reason?: string }[] } }
  throw new Error(plainDriveError(res.status, err.error?.message || '', (err.error?.errors ?? []).map((e) => e.reason).join(' ')))
}

type DriveFile = { id: string; webViewLink?: string; name?: string; trashed?: boolean }

const makeFolder = (payload: Payload, name: string, parent: string | null, appProperties?: Record<string, string>) =>
  drive<DriveFile>(payload, '/files?fields=id,webViewLink,name&supportsAllDrives=true', { method: 'POST', body: { name, mimeType: FOLDER, ...(parent ? { parents: [parent] } : {}), ...(appProperties ? { appProperties } : {}) } })

/** A folder this app made, found by the mark it left on it (so a retry never makes two). */
async function findMarked(payload: Payload, key: string, value: string) {
  const q = `appProperties has { key='${key}' and value='${value.replace(/['\\]/g, '')}' } and mimeType='${FOLDER}' and trashed=false`
  const r = await drive<{ files: DriveFile[] }>(payload, `/files?q=${encodeURIComponent(q)}&fields=files(id,webViewLink,name)&pageSize=5&supportsAllDrives=true&includeItemsFromAllDrives=true`)
  return r.files?.[0] ?? null
}

const folderUrl = (f: DriveFile) => f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`

/** "Quadem clients" in Ernest's Drive: the one he connected with, or made now. */
async function ensureRoot(payload: Payload) {
  const c = await readConnection(payload)
  if (c.rootFolderId) {
    const f = await drive<DriveFile>(payload, `/files/${encodeURIComponent(c.rootFolderId)}?fields=id,webViewLink,trashed&supportsAllDrives=true`).catch(() => null)
    if (f && !f.trashed) return { id: f.id, url: folderUrl(f) }
  }
  const f = (await findMarked(payload, 'quademRoot', 'clients')) ?? (await makeFolder(payload, ROOT_NAME, null, { quademRoot: 'clients' }))
  await writeConnection(payload, { rootFolderId: f.id, rootFolderUrl: folderUrl(f) })
  return { id: f.id, url: folderUrl(f) }
}

/** Ernest came back from Google's approval page: keep the refresh token and make sure "Quadem clients" exists. */
export async function finishConnect(payload: Payload, code: string, state: string, userId: string | number) {
  if (!driveConfigured()) throw new Error('Google Drive is not set up on the CMS yet (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET).')
  const secret = process.env.PAYLOAD_SECRET || ''
  if (readState(state, secret) !== String(userId)) throw new Error('That approval has expired or was for someone else. Press Connect Google Drive again.')
  const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() })
  if (!t.refresh_token) throw new Error('Google did not give a lasting connection. Press Connect Google Drive again.')
  // Google lets a person untick a permission on its approval page; without this one, no folder can be made.
  if (!String(t.scope || '').split(/\s+/).includes(DRIVE_SCOPE)) throw new Error('Google was not allowed to let the portal make folders in your Drive. Press Connect Google Drive again and leave that box ticked.')
  let email: string | null = null
  try {
    email = JSON.parse(Buffer.from(String(t.id_token).split('.')[1], 'base64url').toString('utf8')).email ?? null
  } catch {
    email = null
  }
  cached = null
  await writeConnection(payload, { email, refreshToken: sealToken(t.refresh_token, secret), connectedAt: new Date().toISOString(), lastError: null })
  const root = await ensureRoot(payload)
  return { email, rootUrl: root.url }
}

/** Forget the connection, and tell Google to forget it too. */
export async function disconnect(payload: Payload) {
  const c = await readConnection(payload)
  const refresh = unsealToken(c.refreshToken, process.env.PAYLOAD_SECRET || '')
  if (refresh) await fetch(`${REVOKE_URL}?token=${encodeURIComponent(refresh)}`, { method: 'POST', signal: AbortSignal.timeout(15_000) }).catch(() => null)
  cached = null
  await writeConnection(payload, { email: null, refreshToken: null, connectedAt: null, lastError: null })
}

/** What the portal's settings page shows. Never the token. */
export async function driveStatus(payload: Payload) {
  const c = await readConnection(payload).catch(() => ({}) as Connection)
  return {
    configured: driveConfigured(),
    connected: Boolean(c.refreshToken),
    email: c.email ?? null,
    rootUrl: c.rootFolderUrl ?? null,
    connectedAt: c.connectedAt ?? null,
    lastError: c.lastError ?? null,
    redirectUri: redirectUri(),
  }
}

type ClientLike = { id: string | number; clientName?: string | null; driveFolder?: { id?: string | null; url?: string | null } | null }

/**
 * The client's folder, with its four subfolders, open to anyone with the link
 * to add to. Safe to call again: it finds the folder it made before by its mark,
 * fills in any missing subfolder, and shares it again.
 */
export async function ensureClientFolder(payload: Payload, client: ClientLike) {
  const root = await ensureRoot(payload)
  const mark = String(client.id)
  let f: DriveFile | null = client.driveFolder?.id
    ? await drive<DriveFile>(payload, `/files/${encodeURIComponent(client.driveFolder.id)}?fields=id,webViewLink,trashed&supportsAllDrives=true`).catch(() => null)
    : null
  if (f?.trashed) f = null
  f ||= (await findMarked(payload, 'quademClient', mark)) ?? (await makeFolder(payload, folderName(client.clientName), root.id, { quademClient: mark }))
  const inside = await drive<{ files: DriveFile[] }>(payload, `/files?q=${encodeURIComponent(`'${f.id}' in parents and mimeType='${FOLDER}' and trashed=false`)}&fields=files(id,name)&pageSize=50&supportsAllDrives=true&includeItemsFromAllDrives=true`)
  const have = new Set((inside.files ?? []).map((x) => x.name))
  for (const name of SUBFOLDERS) if (!have.has(name)) await makeFolder(payload, name, f.id)
  // Anyone with the link may add to it (Ernest's choice), and it never shows in anyone's search.
  await drive(payload, `/files/${f.id}/permissions?supportsAllDrives=true`, { method: 'POST', body: { type: 'anyone', role: 'writer', allowFileDiscovery: false } })
  return { id: f.id, url: folderUrl(f) }
}
