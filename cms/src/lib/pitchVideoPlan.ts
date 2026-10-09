/*
  What to do with a recorded pitch video, decided from what ffprobe says about
  it. Pure, so it is tested without ffmpeg (tests/int/pitch-video-plan).

  Most recordings need almost nothing. Chrome, Edge and Safari record H.264
  with AAC sound, which every phone and browser already plays, so the file is
  only rewritten with its index at the front (`+faststart`, so playback starts
  before the whole file has downloaded). That takes seconds for an hour of
  video. Sound recorded as Opus is the one part re-encoded. Anything else (a
  WebM from Firefox, a 4K or HEVC phone video) is encoded in full, which takes
  about as long as the video itself.
*/

/** The most a pitch video may run, and the most it may weigh. Only there to protect the server. */
export const MAX_SECONDS = 2 * 60 * 60
export const MAX_BYTES = 3 * 1024 ** 3

/** Never larger than full HD. A slide deck is drawn at exactly 1920 by 1080. */
const LONG_EDGE = 1920
const SHORT_EDGE = 1080

export type VideoProbe = {
  durationSeconds: number
  width: number
  height: number
  rotation: number
  videoCodec: string | null
  pixelFormat: string | null
  audioCodec: string | null
  hasAudio: boolean
}

export type EncodePlan = { mode: 'copy' | 'audio' | 'full'; width: number; height: number; reason: string }

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** ffprobe's JSON (`-show_format -show_streams`) in the shape the plan needs. */
export function readProbe(json: unknown): VideoProbe {
  const parsed = (json ?? {}) as { format?: { duration?: unknown }; streams?: Record<string, any>[] }
  const streams = parsed.streams ?? []
  const video = streams.find((s) => s.codec_type === 'video' && !s.disposition?.attached_pic)
  if (!video) throw new Error('There is no picture in this file.')
  const audio = streams.find((s) => s.codec_type === 'audio')
  // Phones store a portrait video as landscape plus a rotation; newer ffprobe reports it in side data, older in a tag.
  const side = (video.side_data_list ?? []).find((d: { rotation?: unknown }) => d.rotation !== undefined)
  const rotation = Math.abs(num(side?.rotation ?? video.tags?.rotate)) % 360
  const durations = [parsed.format?.duration, video.duration, audio?.duration].map(num).filter((n) => n > 0)
  return {
    durationSeconds: durations.length ? Math.max(...durations) : 0,
    width: num(video.width),
    height: num(video.height),
    rotation,
    videoCodec: video.codec_name ?? null,
    pixelFormat: video.pix_fmt ?? null,
    audioCodec: audio?.codec_name ?? null,
    hasAudio: Boolean(audio),
  }
}

/** The size as it is shown, after any rotation. */
const shown = (p: VideoProbe) => (p.rotation === 90 || p.rotation === 270 ? { w: p.height, h: p.width } : { w: p.width, h: p.height })

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

/** The output size: no edge past full HD, the shape kept, both sides even (H.264 needs it). */
export function fitSize(width: number, height: number) {
  if (!width || !height) return { width: 0, height: 0 }
  const long = Math.max(width, height)
  const short = Math.min(width, height)
  const factor = Math.min(1, LONG_EDGE / long, SHORT_EDGE / short)
  return { width: even(width * factor), height: even(height * factor) }
}

export function planEncode(p: VideoProbe): EncodePlan {
  const { w, h } = shown(p)
  const size = fitSize(w, h)
  const playable = p.videoCodec === 'h264' && (p.pixelFormat === 'yuv420p' || p.pixelFormat === 'yuvj420p')
  const fits = Math.max(w, h) <= LONG_EDGE && Math.min(w, h) <= SHORT_EDGE
  if (!playable) return { mode: 'full', ...size, reason: `${p.videoCodec ?? 'unknown'} picture${p.pixelFormat ? ` (${p.pixelFormat})` : ''}` }
  if (!fits) return { mode: 'full', ...size, reason: `${w}×${h} is larger than full HD` }
  if (p.hasAudio && p.audioCodec !== 'aac') return { mode: 'audio', ...size, reason: `${p.audioCodec} sound` }
  return { mode: 'copy', ...size, reason: 'already plays everywhere' }
}

/** ffmpeg's arguments for the plan. `-progress pipe:1` reports how far it has got on stdout. */
export function encodeArgs(plan: EncodePlan, input: string, output: string): string[] {
  const head = ['-hide_banner', '-nostats', '-loglevel', 'error', '-progress', 'pipe:1', '-y', '-i', input, '-map', '0:v:0', '-map', '0:a:0?']
  const tail = ['-movflags', '+faststart', '-max_muxing_queue_size', '4096', output]
  if (plan.mode === 'copy') return [...head, '-c', 'copy', ...tail]
  const sound = ['-c:a', 'aac', '-b:a', '128k', '-ac', '2']
  if (plan.mode === 'audio') return [...head, '-c:v', 'copy', ...sound, ...tail]
  return [
    ...head,
    '-vf', `scale=${plan.width}:${plan.height}:flags=lanczos`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
    '-profile:v', 'high', '-level:v', '4.1', '-pix_fmt', 'yuv420p',
    // A keyframe at least every two seconds, so a chapter jump lands where it was asked to.
    '-force_key_frames', 'expr:gte(t,n_forced*2)',
    ...sound,
    ...tail,
  ]
}

/** A still for the player before it starts: early, but past the first black frames of a camera warming up. */
export const posterAt = (durationSeconds: number) => (durationSeconds > 4 ? 2 : durationSeconds > 1 ? durationSeconds / 2 : 0)

export function posterArgs(input: string, output: string, at: number): string[] {
  return ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(at), '-i', input, '-frames:v', '1', output]
}

/** How far ffmpeg has got, from its `-progress` output, as a whole percent, or null when the length is unknown. */
export function progressFrom(chunk: string, durationSeconds: number): number | null {
  if (!durationSeconds) return null
  const matches = [...chunk.matchAll(/out_time_(?:us|ms)=(\d+)/g)]
  const last = matches.at(-1)
  if (!last) return null
  return Math.max(0, Math.min(99, Math.floor((Number(last[1]) / 1e6 / durationSeconds) * 100)))
}

/** How long ffmpeg is given before it is stopped: three times the video's length, and never under half an hour. */
export const encodeTimeoutMs = (durationSeconds: number) => Math.max(30 * 60, 3 * durationSeconds) * 1000

/** The file extension a recording is kept under, from its type. */
export function extensionFor(mime: string): 'mp4' | 'webm' | 'mov' | 'mkv' | null {
  const base = mime.split(';')[0].trim().toLowerCase()
  if (base === 'video/mp4') return 'mp4'
  if (base === 'video/webm') return 'webm'
  if (base === 'video/quicktime') return 'mov'
  if (base === 'video/x-matroska') return 'mkv'
  return null
}

export type Chapter = { n: number; at: number }

/**
 * Slide times from the recorder, cleaned: whole slide numbers, seconds in
 * order from zero, nothing past the end, and a slide shown twice in a row
 * counted once. At most 500.
 */
export function cleanSlides(raw: unknown, durationSeconds?: number): Chapter[] {
  if (!Array.isArray(raw)) return []
  const out: Chapter[] = []
  for (const item of raw.slice(0, 2000)) {
    const n = Math.floor(num((item as Chapter)?.n))
    const at = Math.round(num((item as Chapter)?.at) * 10) / 10
    if (n < 1 || n > 1000 || at < 0) continue
    if (durationSeconds && at > durationSeconds) continue
    if (out.length && at < out[out.length - 1].at) continue
    if (out.length && out[out.length - 1].n === n) continue
    out.push({ n, at })
  }
  return out.slice(0, 500)
}
