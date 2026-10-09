import type { Endpoint, PayloadRequest } from 'payload'
import { hasRole } from '../access/roles'
import { audit } from './audit'
import { connectUrl, disconnect, driveConfigured, driveStatus, ensureClientFolder, finishConnect } from './googleDrive'

/*
  The portal's side of the Google Drive connection (lib/googleDrive.ts), for
  Ernest only: what state it is in, Google's approval page, keeping what
  Google sends back, disconnecting, and making a client's folder by hand (for
  a client whose onboarding ran before Drive was connected).
*/

const say = (error: string, status: number) => Response.json({ error }, { status })
const admin = (req: PayloadRequest) => (hasRole(req.user, 'admin') ? null : say('Only Ernest connects Google Drive.', 403))
const body = async (req: PayloadRequest) => ((await req.json?.().catch(() => null)) ?? {}) as Record<string, unknown>

export const googleDriveEndpoints: Endpoint[] = [
  {
    path: '/google-drive/status',
    method: 'get',
    handler: async (req) => admin(req) ?? Response.json(await driveStatus(req.payload)),
  },
  {
    path: '/google-drive/connect-url',
    method: 'post',
    handler: async (req) => {
      const refused = admin(req)
      if (refused) return refused
      if (!driveConfigured()) return say('Google Drive is not set up on the CMS yet: it needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.', 503)
      return Response.json({ url: connectUrl(req.user!.id, process.env.PAYLOAD_SECRET || '') })
    },
  },
  {
    path: '/google-drive/finish',
    method: 'post',
    handler: async (req) => {
      const refused = admin(req)
      if (refused) return refused
      const b = await body(req)
      if (typeof b.code !== 'string' || typeof b.state !== 'string') return say('Google did not send back an approval.', 400)
      try {
        const done = await finishConnect(req.payload, b.code, b.state, req.user!.id)
        await audit(req, { action: 'google-drive.connected', summary: `Google Drive connected${done.email ? ` as ${done.email}` : ''}` }).catch(() => {})
        return Response.json({ ok: true, ...done })
      } catch (error) {
        return say(error instanceof Error ? error.message : 'Google Drive could not be connected.', 400)
      }
    },
  },
  {
    path: '/google-drive/disconnect',
    method: 'post',
    handler: async (req) => {
      const refused = admin(req)
      if (refused) return refused
      await disconnect(req.payload)
      await audit(req, { action: 'google-drive.disconnected', summary: 'Google Drive disconnected' }).catch(() => {})
      return Response.json({ ok: true })
    },
  },
  {
    // A client's folder, made now (or found again) and saved on the client.
    path: '/google-drive/clients/:id/folder',
    method: 'post',
    handler: async (req) => {
      const refused = admin(req)
      if (refused) return refused
      const id = String(req.routeParams?.id ?? '')
      const client = /^\d+$/.test(id) ? await req.payload.findByID({ collection: 'clients', id: Number(id), depth: 0, overrideAccess: true, req }).catch(() => null) : null
      if (!client) return say('That client was not found.', 404)
      try {
        const f = await ensureClientFolder(req.payload, client as never)
        await req.payload.db.updateOne({ collection: 'clients', id: client.id, data: { driveFolder: { url: f.url, folderId: f.id, madeAt: new Date().toISOString(), problem: null } }, returning: false, req } as never)
        return Response.json({ url: f.url })
      } catch (error) {
        return say(error instanceof Error ? error.message : 'The folder could not be made.', 502)
      }
    },
  },
]
