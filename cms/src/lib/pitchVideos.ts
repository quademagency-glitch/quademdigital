import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import type { Endpoint, PayloadRequest } from 'payload'

import { hasRole } from '../access/roles'
import { slugify } from '../collections/Pitches'
import { audit } from './audit'
import { pitchWatched } from './leadRules'
import { notify } from './notify'
import { cleanSlides, extensionFor, MAX_BYTES } from './pitchVideoPlan'
import { kickPitchVideos } from './pitchVideoWorker'
import { completeMultipart, copyObject, deleteObject, downloadLink, headObject, partLink, signed, startMultipart, store, abortMultipart, type Store } from './privateBucket'

/*
  Recording a video pitch from the team portal (9 October 2026).

  The video never passes through the portal's server, which refuses anything
  over about 4 MB, nor through this one. The browser sends it straight to the
  private bucket in 8 MB pieces while the presenter is still talking, so
  pressing Stop leaves only the last piece to go:

    POST /api/pitch-videos/start     {purpose: 'video', mimeType}         -> ticket
                                     {purpose: 'deck', mimeType, size}    -> ticket and one upload link
    POST /api/pitch-videos/parts     {ticket, parts: [{n, size}]}         -> an upload link for each piece
    POST /api/pitch-videos/complete  {ticket, parts: [{n, etag}], deckTicket?, data}
                                     -> the pitch, made and queued to be prepared
    POST /api/pitch-videos/abort     {ticket}
    POST /api/pitch-videos/:id/replace   the same, for recording an existing pitch again
    POST /api/pitch-videos/:id/approve   {decision: 'approve' | 'send-back', note}   Ernest only
    GET  /api/pitch-videos/:id/links     signed links to play and download it
    POST /api/pitch-videos/:id/watch     {event: 'play' | 'progress', percent}       the website only

  A ticket is signed with the CMS secret and names the holding place, the
  person and the upload, so nobody can finish another person's recording or
  pick up a file already stored. It lasts 20 hours: a recording interrupted by
  a dropped connection or a closed laptop can be carried on the same day. The
  bucket clears an unfinished upload after a day.

  Team members record for the leads they work (Pitches.ts holds them to it as
  well), and their video waits for Ernest; his own go live when ready.
*/

export const PART_BYTES = 8 * 1024 * 1024
const MAX_PART_BYTES = 64 * 1024 * 1024
const MAX_PARTS = 1000
export const DECK_MAX_BYTES = 100 * 1024 * 1024
const TICKET_SECONDS = 20 * 3600

type Ticket = { k: string; u: string; p: 'video' | 'deck'; t: string; i?: string; s?: number; e: number }

const mac = (body: string, secret: string) => createHmac('sha256', secret).update(`pitch-video:${body}`).digest('base64url')

export function signVideoTicket(t: Ticket, secret: string) {
  const body = Buffer.from(JSON.stringify(t), 'utf8').toString('base64url')
  return `${body}.${mac(body, secret)}`
}

export function readVideoTicket(token: unknown, secret: string, now = Date.now()): Ticket | null {
  if (typeof token !== 'string' || !secret) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const want = Buffer.from(mac(body, secret))
  const got = Buffer.from(sig)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  try {
    const t = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Ticket
    return t.e * 1000 > now && (t.p === 'video' || t.p === 'deck') ? t : null
  } catch {
    return null
  }
}

const say = (error: string, status: number) => Response.json({ error }, { status })
const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const digits = (v: unknown) => (typeof v === 'string' ? v.replace(/\D/g, '') : '')

async function body(req: PayloadRequest): Promise<Record<string, any>> {
  try {
    return ((await req.json?.()) ?? {}) as Record<string, any>
  } catch {
    return {}
  }
}

type User = { id: number | string; role?: string | null; name?: string | null }
const userOf = (req: PayloadRequest) => req.user as User | null
const mayRecord = (u: User | null) => hasRole(u, 'admin', 'team')

/** The ticket, if it is good and the person's own. */
function ticketFor(req: PayloadRequest, token: unknown, purpose: 'video' | 'deck'): Ticket | Response {
  const u = userOf(req)
  const t = readVideoTicket(token, process.env.PAYLOAD_SECRET ?? '')
  if (!t || t.p !== purpose) return say(purpose === 'deck' ? 'The slides upload has run out of time. Choose the PDF again.' : 'This recording has run out of time to finish uploading. Record it again.', 400)
  if (!u || t.u !== String(u.id) || !t.k.startsWith(`incoming/${u.id}/`)) return say('That upload is not yours.', 403)
  return t
}

/** The pieces the browser says it sent, in order, each once. */
function partsList(raw: unknown): { n: number; etag: string }[] | null {
  if (!Array.isArray(raw) || !raw.length || raw.length > MAX_PARTS) return null
  const seen = new Set<number>()
  const out: { n: number; etag: string }[] = []
  for (const p of raw) {
    const n = Number((p as { n?: unknown })?.n)
    const etag = String((p as { etag?: unknown })?.etag ?? '')
    if (!Number.isInteger(n) || n < 1 || n > MAX_PARTS || seen.has(n) || !etag || etag.length > 200) return null
    seen.add(n)
    out.push({ n, etag })
  }
  return out.sort((a, b) => a.n - b.n)
}

/** Put the pieces together. A second try after a lost answer finds it already done. Returns its size. */
async function finishUpload(s: Store, t: Ticket, parts: { n: number; etag: string }[]): Promise<number | Response> {
  try {
    await completeMultipart(s, t.k, t.i!, parts)
  } catch {
    // Already put together, or a piece is missing: the stored file says which.
  }
  const head = await headObject(s, t.k)
  if (!head || !head.bytes) return say('The recording did not finish uploading. Keep the page open and press Send again.', 400)
  if (head.bytes > MAX_BYTES) {
    await deleteObject(s, t.k)
    return say(`That recording is ${mb(head.bytes)}. The most a video can be is ${mb(MAX_BYTES)}.`, 400)
  }
  return head.bytes
}

/** A deck uploaded for this recording, checked to be whole. */
async function deckFrom(req: PayloadRequest, s: Store, token: unknown): Promise<Ticket | Response> {
  const t = ticketFor(req, token, 'deck')
  if (t instanceof Response) return t
  const head = await headObject(s, t.k)
  if (!head || head.bytes !== t.s) return say('The slides did not finish uploading. Choose the PDF again.', 400)
  return t
}

const SLUG_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'
const suffix = () => [...randomBytes(4)].map((b) => SLUG_CHARS[b % SLUG_CHARS.length]).join('')

/** `<business>-<4 letters>`: readable, and not guessable from the business name alone. */
async function freeSlug(req: PayloadRequest, name: string) {
  const stem = slugify(name).replace(/\//g, '-').slice(0, 48).replace(/-+$/, '') || 'video'
  for (let i = 0; i < 6; i++) {
    const slug = `${stem}-${suffix()}`
    const taken = await req.payload.find({ collection: 'pitches', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true, req })
    if (!taken.docs.length) return slug
  }
  return `${stem}-${randomUUID().slice(0, 8)}`
}

const findPitch = async (req: PayloadRequest, id: unknown) => {
  if (!/^\d+$/.test(String(id ?? ''))) return null
  return (await req.payload.findByID({ collection: 'pitches', id: Number(id), depth: 0, overrideAccess: true, req }).catch(() => null)) as Record<string, any> | null
}

const findLead = async (req: PayloadRequest, id: unknown) =>
  Number(id) ? ((await req.payload.findByID({ collection: 'leads', id: Number(id), depth: 0, overrideAccess: true, req }).catch(() => null)) as Record<string, any> | null) : null

const businessOf = (lead: Record<string, any> | null) => (lead ? String(lead.businessName || lead.name || lead.title || '').trim() || null : null)

const summary = (p: Record<string, any>) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  live: p.live,
  approval: p.approval,
  video: { status: p.video?.status ?? 'pending' },
})

/** Wake the worker once the request that made the pitch has finished writing it. */
const wake = (req: PayloadRequest) => {
  setTimeout(() => void kickPitchVideos(req.payload), 1500).unref?.()
}

const backgroundWrite = (req: PayloadRequest, id: number | string, data: Record<string, unknown>, quiet = false) =>
  req.payload.db.updateOne({ collection: 'pitches', id, data: quiet ? { ...data, updatedAt: null } : data, returning: false, req } as never)

/** Who the client's WhatsApp button reaches: the sender's WhatsApp, else their phone, else Quadem's number. */
async function senderOf(req: PayloadRequest, pitch: Record<string, any>) {
  const id = Number(idOf(pitch.sentBy)) || null
  const user = id ? ((await req.payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true, req }).catch(() => null)) as Record<string, any> | null) : null
  let whatsapp = digits(user?.whatsapp) || digits(user?.phone)
  if (!whatsapp) {
    const settings = (await req.payload.findGlobal({ slug: 'siteSettings', depth: 0, overrideAccess: true, req }).catch(() => null)) as Record<string, any> | null
    whatsapp = digits(settings?.whatsappNumber)
  }
  const name = String(user?.name || 'Quadem Digital').trim()
  return { name, firstName: name.split(/\s+/)[0], whatsapp: whatsapp || null }
}

export const pitchVideoEndpoints: Endpoint[] = [
  {
    path: '/pitch-videos/start',
    method: 'post',
    handler: async (req) => {
      const user = userOf(req)
      if (!user) return say('Sign in first.', 401)
      if (!mayRecord(user)) return say('Only Ernest and the team record video pitches.', 403)
      const s = store()
      if (!s) return say('Video needs the storage bucket, which is not set up here.', 503)
      const secret = process.env.PAYLOAD_SECRET
      if (!secret) return say('The CMS is missing its secret.', 503)
      const b = await body(req)
      const type = clip(b.mimeType, 120).toLowerCase()
      const folder = `incoming/${user.id}/${randomUUID()}`
      const e = Math.floor(Date.now() / 1000) + TICKET_SECONDS
      if (b.purpose === 'deck') {
        if (type !== 'application/pdf') return say('Slides go in as a PDF. In PowerPoint: File, Export, PDF.', 400)
        const size = Number(b.size)
        if (!Number.isInteger(size) || size <= 0) return say('That file is empty.', 400)
        if (size > DECK_MAX_BYTES) return say(`That PDF is ${mb(size)}. The most is ${mb(DECK_MAX_BYTES)}; export it again with smaller pictures.`, 400)
        const key = `${folder}/deck.pdf`
        const url = signed(s, 'PUT', key, 3600, { headers: { 'content-type': type, 'content-length': String(size) } })
        return Response.json({ ticket: signVideoTicket({ k: key, u: String(user.id), p: 'deck', t: type, s: size, e }, secret), url, headers: { 'Content-Type': type } })
      }
      const ext = extensionFor(type)
      if (!ext) return say('This browser records in a format the CMS cannot take. Use Chrome, Edge or Safari.', 400)
      const base = type.split(';')[0].trim()
      const key = `${folder}/recording.${ext}`
      const uploadId = await startMultipart(s, key, base)
      return Response.json({ ticket: signVideoTicket({ k: key, u: String(user.id), p: 'video', t: base, i: uploadId, e }, secret), partBytes: PART_BYTES, maxBytes: MAX_BYTES })
    },
  },
  {
    path: '/pitch-videos/parts',
    method: 'post',
    handler: async (req) => {
      if (!userOf(req)) return say('Sign in first.', 401)
      const s = store()
      if (!s) return say('Video needs the storage bucket, which is not set up here.', 503)
      const b = await body(req)
      const t = ticketFor(req, b.ticket, 'video')
      if (t instanceof Response) return t
      const asked = Array.isArray(b.parts) ? b.parts : []
      if (!asked.length || asked.length > 20) return say('Ask for between 1 and 20 pieces at a time.', 400)
      const urls: { n: number; url: string }[] = []
      for (const p of asked) {
        const n = Number(p?.n)
        const size = Number(p?.size)
        if (!Number.isInteger(n) || n < 1 || n > MAX_PARTS) return say('That piece number is out of range.', 400)
        if (!Number.isInteger(size) || size < 1 || size > MAX_PART_BYTES) return say('That piece is the wrong size.', 400)
        urls.push({ n, url: partLink(s, t.k, t.i!, n, size, 3600) })
      }
      return Response.json({ urls })
    },
  },
  {
    path: '/pitch-videos/abort',
    method: 'post',
    handler: async (req) => {
      if (!userOf(req)) return say('Sign in first.', 401)
      const s = store()
      const b = await body(req)
      const t = ticketFor(req, b.ticket, 'video')
      if (t instanceof Response) return t
      if (s) await abortMultipart(s, t.k, t.i!)
      return Response.json({ ok: true })
    },
  },
  {
    path: '/pitch-videos/complete',
    method: 'post',
    handler: async (req) => {
      const user = userOf(req)
      if (!user) return say('Sign in first.', 401)
      if (!mayRecord(user)) return say('Only Ernest and the team record video pitches.', 403)
      const s = store()
      if (!s) return say('Video needs the storage bucket, which is not set up here.', 503)
      const b = await body(req)
      const t = ticketFor(req, b.ticket, 'video')
      if (t instanceof Response) return t

      // Sent twice (the answer to the first was lost on the way back): the same pitch.
      const before = await req.payload.find({ collection: 'pitches', where: { 'video.sourceKey': { equals: t.k } }, limit: 1, depth: 0, overrideAccess: true, req })
      if (before.docs[0]) return Response.json({ pitch: summary(before.docs[0]) })

      const d = (b.data && typeof b.data === 'object' ? b.data : {}) as Record<string, unknown>
      const admin = hasRole(user, 'admin')
      const lead = await findLead(req, d.lead)
      if (d.lead && !lead) return say('That lead was not found.', 404)
      if (!admin && (!lead || String(idOf(lead.assignedTo)) !== String(user.id))) return say('You can record videos only for leads you work.', 403)

      const parts = partsList(b.parts)
      if (!parts) return say('The recording\'s pieces are missing. Press Send again.', 400)
      let deck: Ticket | null = null
      if (b.deckTicket) {
        const dk = await deckFrom(req, s, b.deckTicket)
        if (dk instanceof Response) return dk
        deck = dk
      }
      const bytes = await finishUpload(s, t, parts)
      if (bytes instanceof Response) return bytes

      const business = businessOf(lead)
      const title = clip(d.title, 120) || (business ? `Video for ${business}` : 'Video pitch')
      const deckPages = Number(d.deckPages)
      const pitch = (await req.payload.create({
        collection: 'pitches',
        data: {
          kind: 'video',
          title,
          slug: await freeSlug(req, business || title),
          message: clip(d.message, 600) || null,
          lead: lead ? Number(lead.id) : null,
          // Ernest's own go live once ready; a team member's are made off and waiting by Pitches.ts.
          ...(admin ? { sentBy: Number(user.id), approval: 'not-needed', live: true } : {}),
          video: { status: 'pending', sourceKey: t.k, mime: t.t, bytes, attempts: 0 },
          slides: cleanSlides(d.slides),
          deck: { downloadable: d.deckDownloadable !== false, pages: deck && Number.isInteger(deckPages) && deckPages > 0 ? deckPages : null },
        } as never,
        overrideAccess: true,
        user: req.user,
        depth: 0,
        req,
      })) as Record<string, any>

      if (deck) {
        const key = `pitch-videos/${pitch.id}/${t.k.split('/').at(-2)}/deck.pdf`
        try {
          await copyObject(s, deck.k, key)
          await backgroundWrite(req, pitch.id, { deck: { key } }, true)
          await deleteObject(s, deck.k)
        } catch (err) {
          req.payload.logger.error({ err, id: pitch.id }, 'pitch video: the slides could not be kept')
        }
      }
      await audit(req, { action: 'pitch.video-recorded', summary: `${user.name || 'Someone'} recorded "${title}"${admin ? '' : ', waiting for approval'}`, subjectType: 'pitches', subjectId: pitch.id })
      wake(req)
      return Response.json({ pitch: summary(pitch) }, { status: 201 })
    },
  },
  {
    path: '/pitch-videos/:id/replace',
    method: 'post',
    handler: async (req) => {
      const user = userOf(req)
      if (!user) return say('Sign in first.', 401)
      const s = store()
      if (!s) return say('Video needs the storage bucket, which is not set up here.', 503)
      const pitch = await findPitch(req, req.routeParams?.id)
      if (!pitch || pitch.kind !== 'video') return say('That video pitch was not found.', 404)
      const admin = hasRole(user, 'admin')
      if (!admin && !(hasRole(user, 'team') && String(idOf(pitch.sentBy)) === String(user.id))) return say('Only the person who recorded it, or Ernest, can record it again.', 403)
      if (!admin && pitch.approval === 'approved') return say('Ernest has approved this video. Ask him to send it back if it needs recording again.', 409)
      const b = await body(req)
      const t = ticketFor(req, b.ticket, 'video')
      if (t instanceof Response) return t
      if (pitch.video?.sourceKey === t.k) return Response.json({ pitch: summary(pitch) })

      const parts = partsList(b.parts)
      if (!parts) return say('The recording\'s pieces are missing. Press Send again.', 400)
      let deck: Ticket | null = null
      if (b.deckTicket) {
        const dk = await deckFrom(req, s, b.deckTicket)
        if (dk instanceof Response) return dk
        deck = dk
      }
      const bytes = await finishUpload(s, t, parts)
      if (bytes instanceof Response) return bytes

      // The slide times and deck wait with the recording, and are swapped in when it is ready.
      const incoming: Record<string, unknown> = { slides: cleanSlides(b.slides) }
      if (deck) {
        const key = `pitch-videos/${pitch.id}/${t.k.split('/').at(-2)}/deck.pdf`
        await copyObject(s, deck.k, key)
        await deleteObject(s, deck.k)
        const pages = Number(b.deckPages)
        Object.assign(incoming, { deckKey: key, deckPages: Number.isInteger(pages) && pages > 0 ? pages : null })
      } else if (b.deck === 'none') {
        Object.assign(incoming, { deckKey: null, deckPages: null })
      }
      const data: Record<string, unknown> = {
        video: { status: 'pending', sourceKey: t.k, mime: t.t, bytes, attempts: 0, error: null, progress: null, heartbeatAt: null, incoming },
        // A team member's new recording goes back to Ernest, and the link is off until he approves it.
        ...(admin ? {} : { approval: 'waiting', live: false }),
      }
      if (typeof b.deckDownloadable === 'boolean') data.deck = { downloadable: b.deckDownloadable }
      await backgroundWrite(req, pitch.id, data)
      await audit(req, { action: 'pitch.video-rerecorded', summary: `${user.name || 'Someone'} recorded "${pitch.title}" again`, subjectType: 'pitches', subjectId: pitch.id })
      wake(req)
      return Response.json({ pitch: summary({ ...pitch, ...data, video: { status: 'pending' } }) })
    },
  },
  {
    path: '/pitch-videos/:id/approve',
    method: 'post',
    handler: async (req) => {
      const user = userOf(req)
      if (!hasRole(user, 'admin')) return say('Only Ernest approves videos.', user ? 403 : 401)
      const pitch = await findPitch(req, req.routeParams?.id)
      if (!pitch || pitch.kind !== 'video') return say('That video pitch was not found.', 404)
      const b = await body(req)
      const sender = Number(idOf(pitch.sentBy)) || null
      const business = businessOf(await findLead(req, idOf(pitch.lead))) || pitch.title
      if (b.decision === 'approve') {
        if (pitch.video?.status !== 'ready' || !pitch.video?.mp4Key) return say('It is still being prepared. Approve it once you have watched it.', 409)
        await req.payload.update({ collection: 'pitches', id: pitch.id, data: { approval: 'approved', live: true, approvalNote: null } as never, overrideAccess: true, depth: 0, req })
        if (sender && sender !== Number(user!.id)) {
          await notify(req, { to: [sender], kind: 'pitch-video', title: `Ernest approved your video for ${business}`, body: 'It is live. Copy the link, or send it on WhatsApp.', link: `/pitches/${pitch.id}`, key: `pitch-approved:${pitch.id}:${pitch.video?.sourceKey ?? ''}`, action: 'Send it' })
        }
        await audit(req, { action: 'pitch.video-approved', summary: `Approved "${pitch.title}"`, person: sender, subjectType: 'pitches', subjectId: pitch.id })
        return Response.json({ ok: true, approval: 'approved', live: true })
      }
      if (b.decision === 'send-back') {
        const note = clip(b.note, 1000)
        if (note.length < 3) return say('Say what to change, so they know what to record.', 400)
        await req.payload.update({ collection: 'pitches', id: pitch.id, data: { approval: 'sent-back', live: false, approvalNote: note } as never, overrideAccess: true, depth: 0, req })
        if (sender && sender !== Number(user!.id)) {
          await notify(req, { to: [sender], kind: 'pitch-video', title: `Ernest sent back your video for ${business}`, body: note, link: `/pitches/${pitch.id}`, action: 'Record it again' })
        }
        await audit(req, { action: 'pitch.video-sent-back', summary: `Sent back "${pitch.title}"`, reason: note, person: sender, subjectType: 'pitches', subjectId: pitch.id })
        return Response.json({ ok: true, approval: 'sent-back', live: false })
      }
      return say('Approve it, or send it back with a note.', 400)
    },
  },
  {
    path: '/pitch-videos/:id/links',
    method: 'get',
    handler: async (req) => {
      const user = userOf(req)
      if (!user) return say('Sign in first.', 401)
      const site = hasRole(user, 'site')
      const s = store()
      if (!s) return say('Video needs the storage bucket, which is not set up here.', 503)
      // The website sees any live one; a person sees what the collection lets them read.
      const pitch = (site || hasRole(user, 'admin')
        ? await findPitch(req, req.routeParams?.id)
        : await req.payload.findByID({ collection: 'pitches', id: Number(req.routeParams?.id), depth: 0, overrideAccess: false, user: req.user, req }).catch(() => null)) as Record<string, any> | null
      if (!pitch || pitch.kind !== 'video') return say('That video pitch was not found.', 404)
      const expired = pitch.expiresAt && Date.parse(pitch.expiresAt) < Date.now()
      if (site && (!pitch.live || expired || pitch.approval === 'waiting' || pitch.approval === 'sent-back')) return say('That video pitch was not found.', 404)
      const v = pitch.video ?? {}
      const state = { status: v.status ?? 'pending', progress: v.progress ?? null, error: v.error ?? null }
      // Not ready yet: the website shows "nearly ready" and looks again.
      if (!v.mp4Key) return Response.json({ ...state, ready: false, business: businessOf(await findLead(req, idOf(pitch.lead))) }, { headers: { 'Cache-Control': 'no-store' } })

      const ttl = site ? 6 * 3600 : 1800
      const lead = await findLead(req, idOf(pitch.lead))
      const business = businessOf(lead)
      const name = `${(business || pitch.title || 'Video').replace(/[^\w .&'()-]+/g, ' ').trim().slice(0, 80)} - Quadem`
      const deckKey = pitch.deck?.key as string | undefined
      const showDeck = Boolean(deckKey) && (pitch.deck?.downloadable !== false || !site)
      return Response.json(
        {
          ...state,
          ready: true,
          title: pitch.title,
          business,
          message: pitch.message ?? null,
          durationSeconds: v.durationSeconds ?? null,
          width: v.width ?? null,
          height: v.height ?? null,
          slides: Array.isArray(pitch.slides) ? pitch.slides : [],
          mp4: signed(s, 'GET', v.mp4Key, ttl),
          poster: v.posterKey ? signed(s, 'GET', v.posterKey, ttl) : null,
          share: v.shareKey ? signed(s, 'GET', v.shareKey, ttl) : null,
          download: downloadLink(s, v.mp4Key, `${name}.mp4`, ttl),
          deck: showDeck ? downloadLink(s, deckKey!, `${name} - slides.pdf`, ttl) : null,
          deckDownloadable: pitch.deck?.downloadable !== false,
          sender: await senderOf(req, pitch),
          expiresIn: ttl,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    },
  },
  {
    path: '/pitch-videos/:id/watch',
    method: 'post',
    handler: async (req) => {
      if (!hasRole(userOf(req), 'site')) return say('Only the website reports viewing.', 403)
      const pitch = await findPitch(req, req.routeParams?.id)
      if (!pitch || pitch.kind !== 'video' || !pitch.live) return new Response(null, { status: 204 })
      const b = await body(req)
      const now = new Date().toISOString()
      const w = pitch.watch ?? {}
      if (b.event === 'play') {
        // Read then write, like the open count: one prospect at a time, so a lost count in the same second does not matter.
        await backgroundWrite(req, pitch.id, { watch: { playCount: Number(w.playCount || 0) + 1, lastPlayedAt: now, ...(w.firstPlayedAt ? {} : { firstPlayedAt: now }) } }, true)
        await pitchWatched(req, pitch as never, 'play')
      } else if (b.event === 'progress') {
        const p = Number(b.percent)
        if (p !== 25 && p !== 50 && p !== 75 && p !== 100) return say('25, 50, 75 or 100.', 400)
        if (p > Number(w.watchedPercent || 0)) await backgroundWrite(req, pitch.id, { watch: { watchedPercent: p, lastPlayedAt: now } }, true)
        await pitchWatched(req, pitch as never, p)
      } else return say('Play or progress.', 400)
      return new Response(null, { status: 204 })
    },
  },
]
