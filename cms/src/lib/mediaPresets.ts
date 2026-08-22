/**
 * Every encoding decision this site makes about a picture or a video, in one
 * place.
 *
 * Three things read these numbers and they must agree, or the guard will
 * argue with the CMS about work the CMS itself did:
 *   - cms/src/collections/Media.ts, which encodes on upload
 *   - cms/src/lib/videoPipeline.ts, which transcodes video after upload
 *   - scripts/image-weight.mjs and scripts/optimize-video.mjs in the site
 *     repo, which check and re-render the same files from outside
 *
 * The site repo cannot import from this package, so those two scripts copy
 * the constants with a comment pointing back here. Change a number here and
 * change it there in the same commit.
 */

// ── Images ───────────────────────────────────────────────────────
/*
  quality 72 is the point where these illustrations stop losing anything a
  visitor can see. effort 6 spends more time searching for a smaller encoding
  and changes nothing about how the picture looks; it costs upload time once
  and saves bytes on every visit afterwards.
*/
export const WEBP = { format: 'webp' as const, options: { quality: 72, effort: 6 } }

/*
  AVIF beats webp by roughly a quarter at matching visual quality, but it costs
  several seconds per encode instead of a fraction of one. So it is generated
  only for the three sizes big enough for that quarter to be worth real bytes:
  at 200px wide the whole file is 2KB and a saving of 500 bytes is not worth
  four seconds of an editor's upload. quality 50 in AVIF is not quality 50 in
  webp; the scales are unrelated, and 50 here is the rough visual match for
  webp 72. effort 4 is sharp's default and already slow; going higher turns a
  four second upload into a twenty second one for about 3% fewer bytes.
*/
export const AVIF = { format: 'avif' as const, options: { quality: 50, effort: 4 } }

/*
  No visitor is ever served the original. It exists so a derivative can be
  regenerated when these settings change, and so an editor can download what
  they uploaded. Capping it at 2048 keeps that purpose intact while stopping a
  24 megapixel phone photo from sitting in the bucket forever: there are
  already 2048px files in this bucket that only got that way by luck.
*/
export const ORIGINAL_MAX_DIMENSION = 2048

/*
  Widths, not heights. Every layout on this site constrains width and lets
  height follow, so a height here would crop artwork nobody asked to crop. The
  one exception is `og`, which social platforms require at exactly 1200x630.
*/
export const IMAGE_WIDTHS = {
  thumb: 200,
  thumbnail: 400,
  card: 480,
  medium: 800,
  large: 1200,
} as const

/** The sizes big enough for AVIF's slower encode to pay for itself. */
export const AVIF_WIDTHS = ['medium', 'large'] as const

/**
 * What the file picker will offer, and what the server refuses. SVG is allowed
 * because the logo is one, and it needs no encoding at all.
 */
export const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
]

export const ALLOWED_VIDEO_MIMES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
]

// ── Video ────────────────────────────────────────────────────────
/*
  A video is the only thing an editor can upload that is capable of being
  worse than the whole rest of the page put together. A phone camera writes
  roughly 50MB per minute at 1080p and about four times that at 4K, and none
  of it is encoded for delivery: it is encoded for editing, which means huge
  keyframe intervals and bitrates a browser has no use for. Nothing here
  changes what the video looks like at the size it is actually painted. It
  changes how many bytes that costs, and the difference is routinely 10x.
*/

/**
 * Longest edge of the largest transcode. 1280 covers every place this site
 * paints a video: the homepage hero carousel is at most 720px wide on a
 * desktop, the service hero the same, and the case study gallery is capped by
 * its 16:9 container inside a text column. 1280 leaves headroom for a 2x
 * display without paying for pixels no layout can show.
 */
export const VIDEO_MAX_EDGE = 1280

/** The narrow-viewport cut. A phone painting a 390px column has no use for 1280. */
export const VIDEO_MOBILE_MAX_EDGE = 720

/*
  CRF is a quality target, not a bitrate: the encoder spends whatever bits each
  scene needs to hit it. 24 is visually clean for the screen recordings and
  motion graphics this site actually shows. Real camera footage with grain
  would want a lower number, which is what the CLI's --crf is for.
*/
export const VIDEO_CRF = 24
export const VIDEO_MOBILE_CRF = 28

/*
  x264 presets trade encode time for compression. `slow` is the usual advice
  and it is wrong here: this runs on the same single small instance that serves
  the site, and a preset that takes four times as long is four times as long
  spent starving page requests of CPU. `faster` gives up a few percent of file
  size to stay out of the way.
*/
export const VIDEO_PRESET = 'faster'

/*
  VP9 is meaningfully smaller than H.264, and meaningfully slower to produce.
  Generating it for a 3 second hero loop is seconds of work for a real saving
  on the one video every visitor downloads. Generating it for a 3 minute
  showreel that a handful of people press play on is many minutes of a shared
  CPU for a saving nobody waits on. So it is generated by duration, not by
  preference.
*/
export const WEBM_MAX_DURATION_SECONDS = 30
export const VIDEO_WEBM_CRF = 34

/**
 * Above this, the CMS will not transcode in the background: it stores the
 * upload, marks it `oversize`, and tells the editor to run the CLI instead.
 * Refusing to try is deliberate. A 400MB transcode on this instance is not a
 * slow success, it is an out of memory kill that takes the admin panel down
 * with it, and it would happen at the exact moment someone is trying to work.
 */
export const VIDEO_AUTO_TRANSCODE_MAX_BYTES = 200 * 1024 * 1024

/** Hard refusal, at any size, by either path. Nothing on this site needs it. */
export const VIDEO_ABSOLUTE_MAX_BYTES = 2 * 1024 * 1024 * 1024

/*
  Where in the clip to grab the poster. Not frame zero: videos routinely open
  on a fade from black, and a black poster looks like a broken image sitting
  in the layout until playback starts.
*/
export const POSTER_TIMESTAMP_SECONDS = 1

/** The poster is a picture, so it gets the picture settings. */
export const POSTER_FORMAT = WEBP
