#!/usr/bin/env node
/**
 * Turn a video into something worth uploading.
 *
 * The CMS does this by itself for anything under 200MB. This is for the rest:
 * a 4K export, a long showreel, or any time you want to see the numbers before
 * committing to them. It produces exactly what the CMS pipeline produces, from
 * the same settings, so a file put through here and uploaded is indistinguishable
 * from one the CMS handled.
 *
 *   node scripts/optimize-video.mjs showreel.mov
 *   npm run optimize:video -- showreel.mov
 *   ... --out=dist/video          where to write (default: alongside the source)
 *   ... --crf=20                  higher quality, bigger file (default 24)
 *   ... --keep-audio              keep the audio track (default: removed)
 *   ... --max-edge=1920           allow a larger longest edge (default 1280)
 *   ... --no-webm                 skip the VP9 copy
 *   ... --dry-run                 report what it would do, write nothing
 *
 * Audio is removed unless asked for, because the two places this site shows
 * video most prominently, the homepage hero and the service page heroes, both
 * play muted. An audio track there is bytes every visitor downloads and nobody
 * ever hears. Pass --keep-audio for a showreel someone presses play on.
 *
 * Needs ffmpeg on PATH:  brew install ffmpeg
 */
import { spawn } from 'node:child_process';
import { statSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';

/*
  The poster is encoded by sharp, not by ffmpeg. ffmpeg's webp support is an
  optional build flag and plenty of builds ship without it, including the one
  on this machine, which fails with "Default encoder for format webp is
  probably disabled" only once it has already done the work of decoding the
  frame. sharp is a dependency here anyway, it is the same encoder that made
  every other image on this site, and using it means the poster comes out at
  exactly the settings the CMS uses rather than approximately them.
*/
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('sharp is not installed, so a poster frame cannot be encoded. Run npm install.');
  process.exit(2);
}

// ── The standard ─────────────────────────────────────────────────
// Kept identical to cms/src/lib/mediaPresets.ts. If that changes, change this
// with it, or a file put through here will not match one the CMS made.
const VIDEO_MAX_EDGE = 1280;
const VIDEO_MOBILE_MAX_EDGE = 720;
const VIDEO_CRF = 24;
const VIDEO_MOBILE_CRF = 28;
const VIDEO_PRESET = 'faster';
const VIDEO_WEBM_CRF = 34;
const WEBM_MAX_DURATION_SECONDS = 30;
const POSTER_TIMESTAMP_SECONDS = 1;
const WEBP_QUALITY = 72;
const WEBP_EFFORT = 6;
// ─────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const inputs = argv.filter((a) => !a.startsWith('--'));
const dryRun = has('dry-run');
const keepAudio = has('keep-audio');
const noWebm = has('no-webm');
const maxEdge = Number(flag('max-edge', VIDEO_MAX_EDGE));
const crf = Number(flag('crf', VIDEO_CRF));
const outDirFlag = flag('out', null);

if (!inputs.length) {
  console.error('Usage: node scripts/optimize-video.mjs <video> [--out=dir] [--crf=24] [--keep-audio] [--no-webm] [--dry-run]');
  process.exit(2);
}

// A poster is tens of kilobytes and reporting it as "0.0MB" hides exactly the
// number someone runs this to see.
const size = (n) => (n < 1048576 ? `${Math.round(n / 1024)}KB` : `${(n / 1048576).toFixed(1)}MB`);

const run = (bin, args) =>
  new Promise((resolvePromise, reject) => {
    const proc = spawn(bin, args);
    let stderr = '';
    let stdout = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('error', (err) =>
      reject(new Error(`${bin} could not be started. Install it with "brew install ffmpeg". (${err.message})`)),
    );
    proc.on('close', (code) =>
      code === 0
        ? resolvePromise(stdout)
        : reject(new Error(`${bin} exited ${code}: ${stderr.trim().split('\n').slice(-6).join(' | ')}`)),
    );
  });

const scaleFilter = (edge) =>
  `scale='if(gt(iw,ih),min(${edge},iw),-2)':'if(gt(iw,ih),-2,min(${edge},ih))':flags=lanczos,` +
  `scale=trunc(iw/2)*2:trunc(ih/2)*2`;

const h264Args = (input, output, edge, quality, audio) => [
  '-i', input,
  '-vf', scaleFilter(edge),
  '-c:v', 'libx264',
  '-profile:v', 'high',
  '-level:v', '4.0',
  '-preset', VIDEO_PRESET,
  '-crf', String(quality),
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-g', '60',
  ...(audio ? ['-c:a', 'aac', '-b:a', '128k', '-ac', '2'] : ['-an']),
  '-y', output,
];

const webmArgs = (input, output, edge, audio) => [
  '-i', input,
  '-vf', scaleFilter(edge),
  '-c:v', 'libvpx-vp9',
  '-crf', String(VIDEO_WEBM_CRF),
  '-b:v', '0',
  '-row-mt', '1',
  '-deadline', 'good',
  '-cpu-used', '4',
  '-pix_fmt', 'yuv420p',
  ...(audio ? ['-c:a', 'libopus', '-b:a', '96k'] : ['-an']),
  '-y', output,
];

const probe = async (file) => {
  const out = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  const parsed = JSON.parse(out);
  const video = (parsed.streams || []).find((s) => s.codec_type === 'video');
  if (!video) throw new Error('that file contains no video stream');
  return {
    durationSeconds: Number(parsed.format?.duration) || 0,
    width: Number(video.width) || 0,
    height: Number(video.height) || 0,
    hasAudio: (parsed.streams || []).some((s) => s.codec_type === 'audio'),
  };
};

let failures = 0;

for (const raw of inputs) {
  const input = resolve(raw);
  if (!existsSync(input)) {
    console.error(`  not found: ${raw}`);
    failures++;
    continue;
  }

  try {
    const sourceBytes = statSync(input).size;
    const info = await probe(input);
    const stem = basename(input, extname(input));
    const outDir = outDirFlag ? resolve(outDirFlag) : dirname(input);
    if (!dryRun && !existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    const longest = Math.max(info.width, info.height) || maxEdge;
    const edge = Math.min(maxEdge, longest);
    const mobileEdge = Math.min(VIDEO_MOBILE_MAX_EDGE, longest);
    const audio = keepAudio && info.hasAudio;
    const wantsWebm = !noWebm && info.durationSeconds > 0 && info.durationSeconds <= WEBM_MAX_DURATION_SECONDS;

    console.log(`\n${basename(input)}  ${size(sourceBytes)}  ${info.width}x${info.height}  ${info.durationSeconds.toFixed(1)}s${info.hasAudio ? '  has audio' : ''}`);

    const planned = [
      `${stem}-poster.webp`,
      `${stem}-${edge}.mp4`,
      ...(mobileEdge < edge ? [`${stem}-${mobileEdge}.mp4`] : []),
      ...(wantsWebm ? [`${stem}-${edge}.webm`] : []),
    ];

    if (dryRun) {
      console.log(`  would write to ${outDir}:`);
      for (const name of planned) console.log(`    ${name}`);
      if (!audio && info.hasAudio) console.log('    (audio removed, pass --keep-audio to keep it)');
      if (!wantsWebm && !noWebm) console.log(`    (no webm: longer than ${WEBM_MAX_DURATION_SECONDS}s, VP9 would cost more time than it saves)`);
      continue;
    }

    const posterPath = join(outDir, `${stem}-poster.webp`);
    // ffmpeg extracts the frame losslessly, sharp encodes it. See the note by
    // the sharp import for why this is two steps rather than one.
    const framePath = join(outDir, `${stem}-poster.frame.png`);
    await run('ffmpeg', [
      '-ss', String(Math.min(POSTER_TIMESTAMP_SECONDS, Math.max(0, info.durationSeconds - 0.1))),
      '-i', input,
      '-frames:v', '1',
      '-vf', scaleFilter(edge),
      '-y', framePath,
    ]);
    await sharp(framePath).webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT }).toFile(posterPath);
    rmSync(framePath, { force: true });
    console.log(`  poster   ${basename(posterPath)}  ${size(statSync(posterPath).size)}`);

    const mp4Path = join(outDir, `${stem}-${edge}.mp4`);
    await run('ffmpeg', h264Args(input, mp4Path, edge, crf, audio));
    const mp4Bytes = statSync(mp4Path).size;
    console.log(`  mp4      ${basename(mp4Path)}  ${size(mp4Bytes)}  ${Math.round((1 - mp4Bytes / sourceBytes) * 100)}% smaller`);

    if (mobileEdge < edge) {
      const mobilePath = join(outDir, `${stem}-${mobileEdge}.mp4`);
      await run('ffmpeg', h264Args(input, mobilePath, mobileEdge, VIDEO_MOBILE_CRF, audio));
      console.log(`  mobile   ${basename(mobilePath)}  ${size(statSync(mobilePath).size)}`);
    }

    if (wantsWebm) {
      const webmPath = join(outDir, `${stem}-${edge}.webm`);
      await run('ffmpeg', webmArgs(input, webmPath, edge, audio));
      const webmBytes = statSync(webmPath).size;
      console.log(`  webm     ${basename(webmPath)}  ${size(webmBytes)}  ${Math.round((1 - webmBytes / mp4Bytes) * 100)}% smaller than the mp4`);
    }

    /*
      The mp4 is the one to upload. The CMS regenerates its own poster, mobile
      cut and webm from whatever it is given, so uploading the mp4 alone is
      enough, and it is small enough by then to be well under the automatic
      limit.
    */
    console.log(`  upload ${basename(mp4Path)} to the CMS.`);
  } catch (err) {
    console.error(`  failed: ${basename(input)}: ${err.message}`);
    failures++;
  }
}

process.exit(failures ? 1 : 0);
