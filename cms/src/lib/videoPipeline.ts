/**
 * Turns an uploaded video into something a browser should actually be asked to
 * download.
 *
 * A video arrives from a camera or an editor encoded for editing: high
 * bitrate, sparse keyframes, and its moov atom at the end of the file, which
 * means a browser cannot start playing until it has downloaded all of it. None
 * of that is a delivery format. This produces one:
 *
 *   poster  a still frame, so the layout paints instantly and zero video
 *           bytes are fetched until someone actually wants the video
 *   mp4     H.264, capped at VIDEO_MAX_EDGE, faststart, plays everywhere
 *   mobile  the same at VIDEO_MOBILE_MAX_EDGE, for narrow viewports
 *   webm    VP9, only for clips short enough to be worth the encode time
 *
 * It runs after the upload is already saved, never during it. Transcoding is
 * minutes of CPU and the editor's browser will not wait that long: the request
 * would time out behind Railway's proxy and the editor would see a failure for
 * an upload that actually succeeded. So the doc saves immediately with
 * videoStatus 'pending', and the derivatives appear when they are ready.
 *
 * Requires ffmpeg and ffprobe on PATH. See cms/Dockerfile.
 */
import { spawn } from 'child_process'
import { mkdtemp, rm, readFile, writeFile, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { Payload } from 'payload'
import sharp from 'sharp'

import {
  POSTER_FORMAT,
  POSTER_TIMESTAMP_SECONDS,
  VIDEO_CRF,
  VIDEO_MAX_EDGE,
  VIDEO_MOBILE_CRF,
  VIDEO_MOBILE_MAX_EDGE,
  VIDEO_PRESET,
  VIDEO_WEBM_CRF,
  WEBM_MAX_DURATION_SECONDS,
} from './mediaPresets'

export type VideoVariant = {
  url: string
  filename: string
  mimeType: string
  filesize: number
  width?: number
  height?: number
}

type Probe = {
  durationSeconds: number
  width: number
  height: number
  hasAudio: boolean
}

/*
  One transcode at a time, process wide. ffmpeg will happily saturate every
  core it is given, and this process is also the web server: two concurrent
  encodes do not finish twice as fast, they make the admin panel unusable for
  as long as they run. Uploads are rare and nobody is watching the queue, so
  serialising costs nothing that matters.
*/
let chain: Promise<unknown> = Promise.resolve()
const serialise = <T>(task: () => Promise<T>): Promise<T> => {
  const next = chain.then(task, task)
  chain = next.catch(() => {})
  return next
}

const run = (bin: string, args: string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    const proc = spawn(bin, args)
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d) => {
      stdout += d
    })
    proc.stderr.on('data', (d) => {
      stderr += d
    })
    proc.on('error', (err) =>
      reject(new Error(`${bin} could not be started (is it installed?): ${err.message}`)),
    )
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout)
      // ffmpeg writes everything to stderr including progress, so only the
      // tail is useful and the rest is noise in a log nobody can search.
      else reject(new Error(`${bin} exited ${code}: ${stderr.trim().split('\n').slice(-6).join(' | ')}`))
    })
  })

export const hasFfmpeg = async (): Promise<boolean> => {
  try {
    await run('ffmpeg', ['-version'])
    return true
  } catch {
    return false
  }
}

const probe = async (file: string): Promise<Probe> => {
  const out = await run('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    file,
  ])
  const parsed = JSON.parse(out)
  const streams: any[] = parsed.streams || []
  const video = streams.find((s) => s.codec_type === 'video')
  if (!video) throw new Error('file contains no video stream')
  return {
    durationSeconds: Number(parsed.format?.duration) || 0,
    // Rotated phone footage carries its rotation in metadata rather than in
    // the stored dimensions, so a portrait clip reports 1920x1080. ffmpeg's
    // own resolved size accounts for it where present.
    width: Number(video.width) || 0,
    height: Number(video.height) || 0,
    hasAudio: streams.some((s) => s.codec_type === 'audio'),
  }
}

/*
  Scale so the longest edge lands on `edge`, never enlarging, and force both
  dimensions even. Odd dimensions are not a rounding detail: yuv420p, the only
  pixel format Safari will play, cannot represent them, and ffmpeg fails
  outright rather than rounding for you.
*/
const scaleFilter = (edge: number) =>
  `scale='if(gt(iw,ih),min(${edge},iw),-2)':'if(gt(iw,ih),-2,min(${edge},ih))':flags=lanczos,` +
  `scale=trunc(iw/2)*2:trunc(ih/2)*2`

const h264Args = (input: string, output: string, edge: number, crf: number, keepAudio: boolean) => [
  '-i', input,
  '-vf', scaleFilter(edge),
  '-c:v', 'libx264',
  '-profile:v', 'high',
  // 4.0 is the ceiling that still decodes in hardware on older Android
  // phones. Above it they fall back to software and drop frames.
  '-level:v', '4.0',
  '-preset', VIDEO_PRESET,
  '-crf', String(crf),
  '-pix_fmt', 'yuv420p',
  // Without this the index sits at the end of the file and playback cannot
  // begin until the entire download finishes. It is the single most important
  // flag here and it costs nothing.
  '-movflags', '+faststart',
  // A keyframe every 2 seconds. Long GOPs compress better but make seeking
  // land seconds away from where the viewer clicked.
  '-g', '60',
  ...(keepAudio ? ['-c:a', 'aac', '-b:a', '128k', '-ac', '2'] : ['-an']),
  '-y', output,
]

const webmArgs = (input: string, output: string, edge: number, keepAudio: boolean) => [
  '-i', input,
  '-vf', scaleFilter(edge),
  '-c:v', 'libvpx-vp9',
  '-crf', String(VIDEO_WEBM_CRF),
  // CRF alone is ignored by libvpx unless bitrate is 0. This is the documented
  // way to ask VP9 for constant quality and it is easy to get wrong.
  '-b:v', '0',
  '-row-mt', '1',
  '-deadline', 'good',
  '-cpu-used', '4',
  '-pix_fmt', 'yuv420p',
  ...(keepAudio ? ['-c:a', 'libopus', '-b:a', '96k'] : ['-an']),
  '-y', output,
]

/*
  ffmpeg extracts the frame as PNG and sharp encodes it, rather than asking
  ffmpeg for webp directly. webp support in ffmpeg is an optional build flag
  and plenty of builds ship without it; one such build failed here with
  "Default encoder for format webp is probably disabled", and it failed only
  after decoding the frame, so the work was already done. sharp is already how
  every other image on this site is encoded, so this also means a poster comes
  out at exactly the settings in mediaPresets rather than approximately them.
*/
const posterArgs = (input: string, output: string, at: number) => [
  // Seeking before -i is orders of magnitude faster: ffmpeg jumps to the
  // keyframe rather than decoding every frame up to that point.
  '-ss', String(at),
  '-i', input,
  '-frames:v', '1',
  '-vf', scaleFilter(VIDEO_MAX_EDGE),
  '-y', output,
]

type StorageWriter = (filename: string, body: Buffer, mimeType: string) => Promise<string>

/**
 * Derivatives have to land wherever the original landed, and this collection
 * writes to S3 in production and to the local media directory in development.
 * Payload's storage plugin owns that decision for files it creates itself and
 * offers no way to hand it one, so this mirrors the same choice from the same
 * environment variable.
 */
const getWriter = async (): Promise<StorageWriter> => {
  const bucket = process.env.S3_BUCKET
  if (!bucket) {
    const dir = join(process.cwd(), 'media')
    return async (filename, body) => {
      await writeFile(join(dir, filename), body)
      return `/api/media/file/${filename}`
    }
  }

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
  const client = new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
  })

  return async (filename, body, mimeType) => {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: filename,
        Body: body,
        ContentType: mimeType,
        // These filenames embed the variant and never change meaning, so a
        // long cache is safe and is the whole point of producing them.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
    return `/api/media/file/${filename}`
  }
}

const baseName = (filename: string) => filename.replace(/\.[^.]+$/, '')

/**
 * Fetch the original back out of storage. Reading it from the incoming request
 * instead would avoid this round trip, but it would also mean holding a
 * hundred megabytes of buffer in memory across an async boundary on an
 * instance that is also serving pages.
 */
const download = async (payload: Payload, url: string, to: string) => {
  const base =
    process.env.NEXT_PUBLIC_SERVER_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const absolute = url.startsWith('http') ? url : `${base}${url}`
  const res = await fetch(absolute)
  if (!res.ok) throw new Error(`could not read the uploaded file back (${res.status}) from ${absolute}`)
  await writeFile(to, Buffer.from(await res.arrayBuffer()))
}

/**
 * Produce every derivative for one uploaded video and write them onto the doc.
 * Never throws: a transcode that fails must leave the doc usable, with the
 * original still playable and a status an editor can see, rather than taking
 * down whatever triggered it.
 */
export const processVideo = async ({
  payload,
  id,
  filename,
  url,
  keepAudio,
}: {
  payload: Payload
  id: string | number
  filename: string
  url: string
  keepAudio: boolean
}): Promise<void> =>
  serialise(async () => {
    const setStatus = async (data: Record<string, unknown>) => {
      try {
        await payload.update({ collection: 'media', id, data, context: { skipVideoPipeline: true } })
      } catch (err) {
        payload.logger.error(`media ${id}: could not record video status: ${(err as Error).message}`)
      }
    }

    let workDir: string | undefined
    try {
      await setStatus({ videoStatus: 'processing', videoError: null })
      workDir = await mkdtemp(join(tmpdir(), 'quadem-video-'))
      const source = join(workDir, `source-${filename}`)
      await download(payload, url, source)

      const info = await probe(source)
      const stem = baseName(filename)
      const write = await getWriter()

      const emit = async (
        localPath: string,
        outName: string,
        mimeType: string,
        dims?: { width: number; height: number },
      ): Promise<VideoVariant> => {
        const body = await readFile(localPath)
        const outUrl = await write(outName, body, mimeType)
        return {
          url: outUrl,
          filename: outName,
          mimeType,
          filesize: body.length,
          ...dims,
        }
      }

      // Longest edge of the output, so a portrait clip is capped on its height
      // rather than being blown up to 1280 wide.
      const longest = Math.max(info.width, info.height) || VIDEO_MAX_EDGE
      const cappedEdge = Math.min(VIDEO_MAX_EDGE, longest)
      const mobileEdge = Math.min(VIDEO_MOBILE_MAX_EDGE, longest)
      const audio = keepAudio && info.hasAudio

      // Poster first. It is seconds of work and it is what makes the page look
      // finished, so if a long transcode is later killed the doc is still
      // better off than it was.
      const framePath = join(workDir, `${stem}-poster-frame.png`)
      const posterPath = join(workDir, `${stem}-poster.${POSTER_FORMAT.format}`)
      await run('ffmpeg', posterArgs(
        source,
        framePath,
        Math.min(POSTER_TIMESTAMP_SECONDS, Math.max(0, info.durationSeconds - 0.1)),
      ))
      await sharp(framePath).toFormat(POSTER_FORMAT.format, POSTER_FORMAT.options).toFile(posterPath)
      const poster = await emit(
        posterPath,
        `${stem}-poster.${POSTER_FORMAT.format}`,
        `image/${POSTER_FORMAT.format}`,
      )
      await setStatus({ videoPoster: poster })

      const mp4Path = join(workDir, `${stem}-${cappedEdge}.mp4`)
      await run('ffmpeg', h264Args(source, mp4Path, cappedEdge, VIDEO_CRF, audio))
      const mp4 = await emit(mp4Path, `${stem}-${cappedEdge}.mp4`, 'video/mp4')

      let mobile: VideoVariant | undefined
      // Only worth a second encode when it is actually smaller than the first.
      if (mobileEdge < cappedEdge) {
        const mobilePath = join(workDir, `${stem}-${mobileEdge}.mp4`)
        await run('ffmpeg', h264Args(source, mobilePath, mobileEdge, VIDEO_MOBILE_CRF, audio))
        mobile = await emit(mobilePath, `${stem}-${mobileEdge}.mp4`, 'video/mp4')
      }

      let webm: VideoVariant | undefined
      if (info.durationSeconds > 0 && info.durationSeconds <= WEBM_MAX_DURATION_SECONDS) {
        const webmPath = join(workDir, `${stem}-${cappedEdge}.webm`)
        await run('ffmpeg', webmArgs(source, webmPath, cappedEdge, audio))
        webm = await emit(webmPath, `${stem}-${cappedEdge}.webm`, 'video/webm')
      }

      const originalBytes = (await stat(source)).size
      const deliveredBytes = mp4.filesize
      payload.logger.info(
        `media ${id}: video ready, ${(originalBytes / 1048576).toFixed(1)}MB source to ` +
          `${(deliveredBytes / 1048576).toFixed(1)}MB mp4` +
          (webm ? ` and ${(webm.filesize / 1048576).toFixed(1)}MB webm` : '') +
          ` (${Math.round((1 - deliveredBytes / originalBytes) * 100)}% smaller)`,
      )

      await setStatus({
        videoStatus: 'ready',
        videoPoster: poster,
        videoMp4: mp4,
        videoMobile: mobile ?? null,
        videoWebm: webm ?? null,
        videoDuration: Math.round(info.durationSeconds),
        videoWidth: info.width,
        videoHeight: info.height,
      })
    } catch (err) {
      const message = (err as Error).message
      payload.logger.error(`media ${id}: video processing failed: ${message}`)
      await setStatus({ videoStatus: 'failed', videoError: message.slice(0, 500) })
    } finally {
      if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {})
    }
  })
