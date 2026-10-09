import { spawn } from 'node:child_process'
import { mkdtemp, rm, stat, statfs } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'
import sharp from 'sharp'

import { adminIds, notify } from './notify'
import { reportProblem } from './problems'
import { copyObject, deleteObject, downloadToFile, headObject, store, uploadFile } from './privateBucket'
import { cleanSlides, encodeArgs, encodeTimeoutMs, MAX_SECONDS, planEncode, posterArgs, posterAt, progressFrom, readProbe } from './pitchVideoPlan'
import { serialise } from './videoPipeline'

/*
  Turns a recorded pitch into the MP4 the client watches (9 October 2026).

  Not a Payload job, on purpose. The job queue's timer will not start a new
  round while the last is still running, so an hour-long encode inside it would
  hold every reminder, onboarding step and health check for that hour. This is
  its own worker, one video at a time, and everything it knows is written on
  the pitch itself: `video.status`, how many times it has started
  (`video.attempts`) and when it last said it was alive (`video.heartbeatAt`,
  every minute). A push restarts the server mid-encode; five minutes after the
  heartbeat stops, the recording is picked up again from the start, three
  times at most, and then the sender and Ernest are told it failed.

  It wakes when a recording is finished (lib/pitchVideos.ts), when the server
  starts, and every two minutes after that.

  Steps: copy the upload into the pitch's own folder (inside the bucket,
  nothing through this server), check the disk has room, download it to /tmp,
  read it with ffprobe, rewrite or encode it (lib/pitchVideoPlan.ts), take a
  poster and a WhatsApp preview, upload the three, and only then swap them in,
  so a re-recording never leaves the client looking at nothing.
*/

export const HEARTBEAT_MS = 60_000
export const STALE_MS = 5 * 60_000
export const MAX_ATTEMPTS = 3

type VideoState = {
  status?: string | null
  sourceKey?: string | null
  originalKey?: string | null
  mp4Key?: string | null
  posterKey?: string | null
  shareKey?: string | null
  mime?: string | null
  attempts?: number | null
  heartbeatAt?: string | null
  incoming?: { slides?: unknown; deckKey?: string | null; deckPages?: number | null } | null
}
type PitchRow = { id: number | string; title?: string | null; lead?: unknown; sentBy?: unknown; approval?: string | null; video?: VideoState | null; deck?: { key?: string | null } | null }

/** Where the files go. The private bucket in production; the tests hand in a folder on disk. */
export type Files = {
  copy: (from: string, to: string) => Promise<unknown>
  exists: (key: string) => Promise<boolean>
  size: (key: string) => Promise<number | null>
  download: (key: string, path: string) => Promise<unknown>
  upload: (path: string, key: string, type: string) => Promise<unknown>
  remove: (key: string) => Promise<unknown>
}

export function bucketFiles(): Files | null {
  const s = store()
  if (!s) return null
  return {
    copy: (from, to) => copyObject(s, from, to),
    exists: async (key) => Boolean(await headObject(s, key)),
    size: async (key) => (await headObject(s, key))?.bytes ?? null,
    download: (key, path) => downloadToFile(s, key, path),
    upload: (path, key, type) => uploadFile(s, path, key, type, 'private, max-age=31536000, immutable'),
    remove: (key) => deleteObject(s, key),
  }
}

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)

/** A program run to the end, its output kept; `onOut` sees stdout as it comes. Stopped after `timeoutMs`. */
function runTool(bin: string, args: string[], { timeoutMs = 10 * 60_000, onOut }: { timeoutMs?: number; onOut?: (chunk: string) => void } = {}) {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      reject(new Error(`${bin} took longer than ${Math.round(timeoutMs / 60_000)} minutes and was stopped.`))
    }, timeoutMs)
    proc.stdout.on('data', (d: Buffer) => {
      const s = d.toString()
      if (onOut) onOut(s)
      else out += s
    })
    proc.stderr.on('data', (d: Buffer) => {
      err = (err + d.toString()).slice(-4000)
    })
    proc.on('error', (e) => {
      clearTimeout(timer)
      reject(new Error(`${bin} could not be started (is it installed?): ${e.message}`))
    })
    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(out)
      else reject(new Error(`${bin} stopped (${code}): ${err.trim().split('\n').slice(-4).join(' | ')}`))
    })
  })
}

const probe = async (file: string) => readProbe(JSON.parse(await runTool('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file])))

/** A play button over the middle of the picture: the preview WhatsApp shows when the link is shared. */
const PLAY = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><circle cx="600" cy="315" r="78" fill="rgba(10,15,30,0.62)"/><circle cx="600" cy="315" r="78" fill="none" stroke="#fff" stroke-width="5"/><path d="M574 270 L574 360 L652 315 Z" fill="#fff"/></svg>`,
)

/** The pitch's state, written without hooks or defaults (a background write; see cms/CLAUDE.md). The heartbeat leaves updatedAt alone. */
const write = (payload: Payload, id: number | string, data: Record<string, unknown>, quiet = false) =>
  payload.db.updateOne({ collection: 'pitches', id, data: quiet ? { ...data, updatedAt: null } : data, returning: false } as never)

const findPitch = (payload: Payload, id: number | string) =>
  payload.findByID({ collection: 'pitches', id, depth: 0, overrideAccess: true }).catch(() => null) as Promise<PitchRow | null>

/**
 * The next recording waiting, claimed for this server: one never started, or
 * one whose worker has gone quiet for five minutes. Claimed by writing a
 * heartbeat and reading it back after a second, so two servers overlapping
 * during a deploy cannot both take it.
 */
export async function claimNext(payload: Payload, skip: (number | string)[] = []): Promise<PitchRow | null> {
  const stale = new Date(Date.now() - STALE_MS).toISOString()
  const found = await payload.find({
    collection: 'pitches',
    where: {
      and: [
        { kind: { equals: 'video' } },
        ...(skip.length ? [{ id: { not_in: skip } }] : []),
        { or: [{ 'video.status': { equals: 'pending' } }, { and: [{ 'video.status': { equals: 'processing' } }, { or: [{ 'video.heartbeatAt': { less_than: stale } }, { 'video.heartbeatAt': { exists: false } }] }] }] },
      ],
    },
    sort: 'createdAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const pitch = found.docs[0] as PitchRow | undefined
  if (!pitch) return null
  const mark = new Date(Date.now() + Math.floor(Math.random() * 999)).toISOString()
  const attempts = Number(pitch.video?.attempts || 0) + 1
  await write(payload, pitch.id, { video: { status: 'processing', heartbeatAt: mark, attempts, error: null, progress: null } }, true)
  await new Promise((r) => setTimeout(r, 1000))
  const mine = await findPitch(payload, pitch.id)
  if (!mine || new Date(String(mine.video?.heartbeatAt)).toISOString() !== mark) return null
  return mine
}

/** Tell the people a video concerns. Never throws. */
async function tellReady(req: PayloadRequest, pitch: PitchRow) {
  const sender = Number(idOf(pitch.sentBy)) || null
  const leadId = Number(idOf(pitch.lead)) || null
  const lead = leadId ? await req.payload.findByID({ collection: 'leads', id: leadId, depth: 0, overrideAccess: true, req }).catch(() => null) : null
  const business = (lead as { businessName?: string; title?: string } | null)?.businessName || (lead as { title?: string } | null)?.title || pitch.title || 'a prospect'
  const key = `pitch-video-ready:${pitch.id}:${pitch.video?.sourceKey ?? ''}`
  if (pitch.approval === 'waiting') {
    const user = sender ? await req.payload.findByID({ collection: 'users', id: sender, depth: 0, overrideAccess: true, req }).catch(() => null) : null
    const name = (user as { name?: string } | null)?.name?.split(' ')[0] || 'A team member'
    await notify(req, { to: await adminIds(req), kind: 'pitch-video', title: `${name} recorded a video for ${business}: watch and approve`, body: 'It reaches the client only once you approve it.', link: `/pitches/${pitch.id}`, key: `${key}:approve`, action: 'Watch it' })
    if (sender) await notify(req, { to: [sender], kind: 'pitch-video', title: `Your video for ${business} is ready`, body: 'Ernest watches it before it can be sent. You will hear when he has.', link: `/pitches/${pitch.id}`, key, email: false })
    return
  }
  if (sender) await notify(req, { to: [sender], kind: 'pitch-video', title: `Your video for ${business} is ready to send`, body: 'Copy the link, or send it on WhatsApp.', link: `/pitches/${pitch.id}`, key, action: 'Send it' })
}

async function tellFailed(req: PayloadRequest, pitch: PitchRow, reason: string) {
  const sender = Number(idOf(pitch.sentBy)) || null
  const key = `pitch-video-failed:${pitch.id}:${pitch.video?.sourceKey ?? ''}`
  const kept = pitch.video?.mp4Key ? ' The video sent before is still the one clients see.' : ''
  if (sender) await notify(req, { to: [sender], kind: 'pitch-video', title: `"${pitch.title}" could not be prepared`, body: `${reason}${kept} Try recording it again; Ernest has been told.`, link: `/pitches/${pitch.id}`, key })
  await reportProblem(req, `pitch-video:${pitch.id}`, `A video pitch could not be prepared: "${pitch.title}"`, reason)
}

/**
 * One claimed recording, start to finish. Exported for the tests, which give
 * it a folder for storage; everything else goes through `kickPitchVideos`.
 */
export async function processPitchVideo(payload: Payload, pitch: PitchRow, files: Files | null = bucketFiles()): Promise<'ready' | 'failed' | 'retry'> {
  const id = pitch.id
  const v = pitch.video ?? {}
  const req = (await createLocalReq({}, payload)) as PayloadRequest
  let progress: number | null = null
  const beat = setInterval(() => {
    write(payload, id, { video: { heartbeatAt: new Date().toISOString(), progress } }, true).catch(() => {})
  }, HEARTBEAT_MS)
  beat.unref?.()
  let dir: string | null = null
  try {
    if (!files) throw Object.assign(new Error('The private storage is not set up on the server (S3_DOCUMENTS_BUCKET).'), { final: true })
    if (!v.sourceKey) throw Object.assign(new Error('This pitch has no recording to prepare.'), { final: true })
    // Started this many times and never finished: something about it stops the server every time.
    if (Number(v.attempts || 0) > MAX_ATTEMPTS) throw Object.assign(new Error(`It was started ${v.attempts} times and never finished.`), { final: true })
    const result = await serialise(async () => {
      // A folder per recording, so a re-recording never overwrites what the client is watching.
      const run = v.sourceKey!.split('/').at(-2) || Date.now().toString(36)
      const ext = (v.sourceKey!.match(/\.([a-z0-9]+)$/i)?.[1] || 'mp4').toLowerCase()
      const base = `pitch-videos/${id}/${run}`
      const originalKey = `${base}/original.${ext}`
      if (!(await files.exists(originalKey))) {
        if (!(await files.exists(v.sourceKey!))) throw Object.assign(new Error('The recording was not found in storage. It may have been cleared before it was finished; record it again.'), { final: true })
        await files.copy(v.sourceKey!, originalKey)
      }
      const bytes = (await files.size(originalKey)) || 0

      dir = await mkdtemp(join(tmpdir(), 'pitch-video-'))
      // Room for the recording, the new file and the stills, with some to spare.
      const disk = await statfs(dir)
      const free = Number(disk.bavail) * Number(disk.bsize)
      if (free < bytes * 2.5) throw new Error(`The server has ${Math.round(free / 1e6)} MB free and needs ${Math.round((bytes * 2.5) / 1e6)} MB to prepare this video.`)
      const input = join(dir, `in.${ext}`)
      const output = join(dir, 'video.mp4')
      await files.download(originalKey, input)

      const before = await probe(input)
      if (before.durationSeconds > MAX_SECONDS) throw Object.assign(new Error(`The video is ${Math.round(before.durationSeconds / 60)} minutes long; the limit is ${MAX_SECONDS / 60}.`), { final: true })
      const plan = planEncode(before)
      payload.logger.info({ id, plan, bytes }, 'pitch video: preparing')
      await runTool('ffmpeg', encodeArgs(plan, input, output), {
        timeoutMs: encodeTimeoutMs(before.durationSeconds || MAX_SECONDS / 3),
        onOut: (chunk) => {
          const p = progressFrom(chunk, before.durationSeconds)
          if (p !== null) progress = p
        },
      })
      // The new file's own length: a browser's recording often states none.
      const after = await probe(output)
      if (after.durationSeconds > MAX_SECONDS) throw Object.assign(new Error(`The video is ${Math.round(after.durationSeconds / 60)} minutes long; the limit is ${MAX_SECONDS / 60}.`), { final: true })

      const frame = join(dir, 'frame.png')
      await runTool('ffmpeg', posterArgs(output, frame, posterAt(after.durationSeconds)))
      const poster = join(dir, 'poster.jpg')
      const share = join(dir, 'share.jpg')
      await sharp(frame).resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(poster)
      await sharp(frame).resize(1200, 630, { fit: 'cover', position: 'attention' }).composite([{ input: PLAY }]).jpeg({ quality: 80, mozjpeg: true }).toFile(share)

      const keys = { mp4Key: `${base}/video.mp4`, posterKey: `${base}/poster.jpg`, shareKey: `${base}/share.jpg` }
      await files.upload(output, keys.mp4Key, 'video/mp4')
      await files.upload(poster, keys.posterKey, 'image/jpeg')
      await files.upload(share, keys.shareKey, 'image/jpeg')
      const size = (await stat(output)).size
      return { plan, after, keys, originalKey, size }
    })

    // Swap in, and only then let go of what it replaces.
    const fresh = await findPitch(payload, id)
    if (!fresh || fresh.video?.sourceKey !== v.sourceKey) {
      // Deleted, or recorded again, while this was being prepared: the files just made are not wanted.
      for (const key of [...Object.values(result.keys), result.originalKey]) await files.remove(key).catch(() => {})
      return fresh ? 'retry' : 'failed'
    }
    const old = fresh.video ?? {}
    const incoming = old.incoming ?? null
    const data: Record<string, unknown> = {
      video: {
        status: 'ready', error: null, progress: 100, heartbeatAt: null, attempts: 0,
        originalKey: result.originalKey, ...result.keys,
        mime: 'video/mp4', bytes: result.size, durationSeconds: Math.round(result.after.durationSeconds * 10) / 10,
        width: result.plan.width || result.after.width, height: result.plan.height || result.after.height,
        processedAt: new Date().toISOString(), incoming: null,
      },
    }
    if (incoming) {
      data.slides = cleanSlides(incoming.slides, result.after.durationSeconds)
      if (incoming.deckKey !== undefined) data.deck = { key: incoming.deckKey ?? null, pages: incoming.deckPages ?? null }
    } else {
      const slides = (fresh as { slides?: unknown }).slides
      if (Array.isArray(slides)) data.slides = cleanSlides(slides, result.after.durationSeconds)
    }
    await write(payload, id, data)
    const replaced = [old.originalKey, old.mp4Key, old.posterKey, old.shareKey].filter((k): k is string => Boolean(k) && !Object.values(result.keys).includes(k!) && k !== result.originalKey)
    if (incoming && incoming.deckKey !== undefined && fresh.deck?.key && fresh.deck.key !== incoming.deckKey) replaced.push(fresh.deck.key)
    for (const key of [...replaced, v.sourceKey!]) await files.remove(key).catch(() => {})
    await tellReady(req, { ...fresh, video: { ...old, ...(data.video as VideoState) } })
    return 'ready'
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    const attempts = Number(v.attempts || 1)
    const final = (err as { final?: boolean }).final || attempts >= MAX_ATTEMPTS
    payload.logger.error({ err, id, attempts }, 'pitch video: could not prepare')
    if (!final) {
      // Back in the queue; the next wake tries again.
      await write(payload, id, { video: { status: 'pending', error: reason.slice(0, 500), heartbeatAt: null } }, true).catch(() => {})
      return 'retry'
    }
    await write(payload, id, { video: { status: 'failed', error: reason.slice(0, 500), heartbeatAt: null } }).catch(() => {})
    await tellFailed(req, pitch, reason)
    return 'failed'
  } finally {
    clearInterval(beat)
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

let running: Promise<void> | null = null
let again = false

/** Work through every recording waiting, one at a time. Safe to call as often as wanted: a call while it is busy just makes it look again. */
export function kickPitchVideos(payload: Payload): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    try {
      do {
        again = false
        // A recording that fails and goes back in the queue waits for the next wake rather than being retried in a loop.
        const seen: (number | string)[] = []
        for (let pitch = await claimNext(payload); pitch; pitch = await claimNext(payload, seen)) {
          seen.push(pitch.id)
          await processPitchVideo(payload, pitch)
        }
      } while (again)
    } catch (err) {
      payload.logger.error({ err }, 'pitch video: the worker stopped')
    } finally {
      running = null
    }
  })()
  return running
}

let timer: NodeJS.Timeout | null = null

/** From server start: look now, and every two minutes. */
export function startPitchVideoWorker(payload: Payload) {
  if (timer) return
  timer = setInterval(() => void kickPitchVideos(payload), 2 * 60_000)
  timer.unref?.()
  void kickPitchVideos(payload)
}
