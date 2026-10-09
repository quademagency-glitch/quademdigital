// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { cleanSlides, encodeArgs, extensionFor, fitSize, planEncode, progressFrom, readProbe, type VideoProbe } from '../../src/lib/pitchVideoPlan'

/*
  Video pitches (9 October 2026): what the server does with each kind of
  recording. The endpoints and the worker are tested on the database in
  api.int.spec.ts, the one file that uses it, so test files never wait on
  each other's writes.
*/

const probe = (p: Partial<VideoProbe>): VideoProbe => ({ durationSeconds: 60, width: 1920, height: 1080, rotation: 0, videoCodec: 'h264', pixelFormat: 'yuv420p', audioCodec: 'aac', hasAudio: true, ...p })

describe('what happens to a recording', () => {
  it('rewrites what already plays, re-encodes only Opus sound, and encodes the rest in full at no more than full HD', () => {
    expect(planEncode(probe({}))).toMatchObject({ mode: 'copy', width: 1920, height: 1080 })
    expect(planEncode(probe({ audioCodec: 'opus' }))).toMatchObject({ mode: 'audio' })
    expect(planEncode(probe({ hasAudio: false, audioCodec: null }))).toMatchObject({ mode: 'copy' })
    expect(planEncode(probe({ videoCodec: 'vp9', audioCodec: 'opus' }))).toMatchObject({ mode: 'full', width: 1920, height: 1080 })
    expect(planEncode(probe({ videoCodec: 'hevc' }))).toMatchObject({ mode: 'full' })
    expect(planEncode(probe({ pixelFormat: 'yuv420p10le' }))).toMatchObject({ mode: 'full' })
    expect(planEncode(probe({ width: 3840, height: 2160 }))).toMatchObject({ mode: 'full', width: 1920, height: 1080 })
    // A phone held upright: stored landscape with a quarter turn, shown portrait, already small enough.
    expect(planEncode(probe({ width: 1920, height: 1080, rotation: 90 }))).toMatchObject({ mode: 'copy', width: 1080, height: 1920 })
    expect(planEncode(probe({ width: 3840, height: 2160, rotation: 270, videoCodec: 'hevc' }))).toMatchObject({ mode: 'full', width: 1080, height: 1920 })
    expect(fitSize(1281, 721)).toEqual({ width: 1282, height: 722 })
    expect(fitSize(2560, 1440)).toEqual({ width: 1920, height: 1080 })
  })

  it('reads ffprobe as it comes from a browser recording: no length on the file, rotation in side data or a tag', () => {
    const p = readProbe({
      format: { duration: 'N/A' },
      streams: [
        { codec_type: 'video', codec_name: 'h264', pix_fmt: 'yuv420p', width: 1280, height: 720, side_data_list: [{ rotation: -90 }] },
        { codec_type: 'audio', codec_name: 'opus', duration: '12.5' },
      ],
    })
    expect(p).toMatchObject({ durationSeconds: 12.5, width: 1280, height: 720, rotation: 90, videoCodec: 'h264', audioCodec: 'opus', hasAudio: true })
    expect(readProbe({ streams: [{ codec_type: 'video', codec_name: 'h264', tags: { rotate: '270' } }] }).rotation).toBe(270)
    expect(() => readProbe({ streams: [{ codec_type: 'audio' }] })).toThrow(/no picture/)
  })

  it('asks ffmpeg for a file that starts playing before it has all downloaded', () => {
    const copy = encodeArgs(planEncode(probe({})), 'in.webm', 'out.mp4')
    expect(copy).toEqual(expect.arrayContaining(['-c', 'copy', '-movflags', '+faststart', '-progress', 'pipe:1']))
    const full = encodeArgs(planEncode(probe({ videoCodec: 'vp8', width: 3840, height: 2160 })), 'in.webm', 'out.mp4')
    expect(full.join(' ')).toContain('-vf scale=1920:1080:flags=lanczos -c:v libx264 -preset veryfast -crf 23')
    expect(full.join(' ')).toContain('-c:a aac -b:a 128k -ac 2')
    expect(full.at(-1)).toBe('out.mp4')
    expect(progressFrom('frame=10\nout_time_us=15000000\nprogress=continue\nout_time_us=30000000\n', 60)).toBe(50)
    expect(progressFrom('out_time_us=90000000', 60)).toBe(99)
    expect(progressFrom('out_time_us=1', 0)).toBeNull()
    expect(extensionFor('video/webm;codecs=vp9,opus')).toBe('webm')
    expect(extensionFor('video/mp4;codecs=avc1.42E01E,mp4a.40.2')).toBe('mp4')
    expect(extensionFor('video/quicktime')).toBe('mov')
    expect(extensionFor('image/png')).toBeNull()
  })

  it('cleans the slide times the recorder sends', () => {
    expect(cleanSlides([{ n: 1, at: 0 }, { n: 1, at: 3 }, { n: 2, at: 10.04 }, { n: 0, at: 12 }, { n: 3, at: 9 }, { n: 4, at: 200 }, 'x', { n: 5, at: 40 }], 100)).toEqual([
      { n: 1, at: 0 },
      { n: 2, at: 10 },
      { n: 5, at: 40 },
    ])
    expect(cleanSlides('nonsense')).toEqual([])
  })
})

describe('which decks are taken', () => {
  it('a PDF as it is, PowerPoint and OpenDocument to be turned into one, nothing else', async () => {
    const { deckKind } = await import('../../src/lib/deckConvert')
    expect(deckKind('application/pdf')).toBe('pdf')
    expect(deckKind('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe('pptx')
    expect(deckKind('application/vnd.ms-powerpoint')).toBe('ppt')
    expect(deckKind('application/vnd.oasis.opendocument.presentation')).toBe('odp')
    expect(deckKind('application/vnd.ms-powerpoint.presentation.macroEnabled.12')).toBeNull()
    expect(deckKind('application/zip')).toBeNull()
  })
})
