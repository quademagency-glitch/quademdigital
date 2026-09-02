# Images and video: how they get optimised

Written 2026-08-21.

Pictures and video are the largest thing this site sends, and the failures are
invisible: nothing looks broken when a file is ten times heavier than it needs
to be, it just costs the visitor data and time. This is what now happens
automatically, and what still needs a person.

## The short version

Upload an image to the CMS and you get six WebP sizes plus AVIF at the two
largest, all at fixed quality settings, with the original capped at 2048px.
That was already true before this work, minus the AVIF and the cap.

Upload a video and you now get a poster frame, an MP4 capped at 1280px, a
720px MP4 for phones, and a VP9 WebM if the clip is short. Before this work
you got the file exactly as it came off the camera, served to every visitor.

## Where the settings live

`cms/src/lib/mediaPresets.ts` is the single source of truth: quality, effort,
sizes, the video ladder, the caps. Everything else reads from it.

Two files in this repo deliberately copy those constants, because this package
cannot import from the CMS package:

- `scripts/image-weight.mjs`
- `scripts/optimize-video.mjs`

Both carry a comment pointing back. **Change a number in `mediaPresets.ts` and
change it in those two in the same commit**, or the guard will argue with the
CMS about work the CMS itself did.

## Images

Handled synchronously on upload by Payload and sharp. Nothing to run.

| Size | Width | Format |
|---|---|---|
| thumb | 200 | WebP |
| thumbnail | 400 | WebP |
| card | 480 | WebP |
| medium | 800 | WebP + AVIF |
| large | 1200 | WebP + AVIF |
| og | 1200x630 | WebP |

AVIF exists only at 800 and 1200. Below that a quarter fewer bytes is a few
hundred bytes, and it is not worth several seconds of an editor's upload.

The site offers AVIF through `src/components/Picture.astro`, which emits a
`<picture>` with an AVIF `<source>` ahead of the WebP one. A browser that
cannot read AVIF ignores it and takes the WebP, so there is nothing to detect
and nothing to fall back to manually.

`npm run check:images` reports any picture that would be meaningfully smaller
if re-encoded at the current settings; `npm run fix:images` rewrites them.

### Getting AVIF onto images uploaded before today

Nothing regenerates derivatives on its own. An image uploaded before this
change has no AVIF copies, and `Picture.astro` will simply serve it WebP,
which is correct and is what happened before.

To backfill, re-upload the originals, which is what makes Payload regenerate
every size at the current settings:

```
node scripts/image-weight.mjs --cms --fix --yes
```

Do it in batches with `--only=` and look at the result between.

## Video

### What happens automatically

An uploaded video under 200MB is transcoded in the background by
`cms/src/lib/videoPipeline.ts`. The doc saves immediately with
`videoStatus: pending` and the derivatives appear when they are ready, usually
within a minute or two. **The site plays the original in the meantime**, which
is heavy but correct, and gets lighter on its own.

Transcoding never happens during the upload request. It is minutes of CPU and
the request would time out behind Railway's proxy, so the editor would see a
failure for an upload that actually succeeded.

Outputs, from a 3360x2100 65-second screen recording, measured:

| | Size | Note |
|---|---|---|
| source | 24.3MB | what came off the machine |
| poster.webp | 22KB | what paints before any video byte is fetched |
| 1280.mp4 | 2.1MB | 92% smaller than the source |
| 720.mp4 | 0.7MB | what phones get |
| 1280.webm | n/a here | only for clips of 30s or less |

For a 6-second clip the WebM came out 24% smaller than the MP4. VP9 is only
generated for short clips because encoding it is slow, and this runs on the
same single small instance that serves the site.

### The audio question

`videoUsage` on the media doc decides whether the audio track survives, and it
defaults to **background (silent)**. The two most prominent video slots on this
site, the homepage hero carousel and the service page heroes, both play muted:
an audio track there is bytes every visitor downloads and nobody ever hears.

Set it to "plays with sound" for a showreel someone presses play on. Changing
it re-runs the transcode.

### Anything over 200MB

The CMS refuses to transcode it and marks the doc `oversize` with a message
saying what to do. Refusing is deliberate: a 400MB transcode on that instance
is not a slow success, it is an out-of-memory kill that takes the admin panel
down with it, at the exact moment somebody is trying to work.

Run it through the CLI first:

```
npm run optimize:video -- showreel.mov
npm run optimize:video -- showreel.mov --keep-audio --crf=20
npm run optimize:video -- showreel.mov --dry-run
```

It produces exactly what the CMS produces, from the same settings. Upload the
resulting `-1280.mp4`; the CMS regenerates its own poster, mobile cut and WebM
from it, and by then it is far under the automatic limit.

Needs ffmpeg: `brew install ffmpeg`.

### Poster frames are encoded by sharp, not ffmpeg

ffmpeg extracts the frame as PNG and sharp encodes the WebP. WebP support in
ffmpeg is an optional build flag and plenty of builds ship without it. One such
build is on the machine this was written on, and it fails with "Default encoder
for format webp is probably disabled" only *after* decoding the frame, so the
work is already done by the time it gives up. Doing it in sharp also means the
poster comes out at exactly the same settings as every other image on the site.

## Two things that only showed up in production

Both were invisible to a passing build and a green typecheck, and both were
found by uploading one real video rather than reasoning about the code.

**The pipeline could not read its own upload.** It fetched the file back over
HTTP from the server's own public URL, built from `NEXT_PUBLIC_SERVER_URL`,
which falls back to `localhost:3000`. Railway binds whatever `PORT` it hands
the container, so the process asked a dead port for a file already sitting in
its own bucket. All it recorded was "fetch failed". It now reads through the
same store the derivatives are written to.

**Status writes reset the audio setting.** `payload.update` rebuilds the
document and reapplies every field's `defaultValue` for anything the data does
not name, so an async write of `videoStatus` alone sent `videoUsage` back to
"background". The transcode kept the audio, because that is read first, but
the doc said otherwise and the page would have shown a showreel as a silent
loop. Status writes now go through `payload.db.updateOne`, which touches only
the named columns.

## Delivery

Two things matter as much as the encoding, and both were wrong.

### Media had no cache headers at all

Neither the Payload file route nor the S3 bucket set `Cache-Control`. Browsers
fell back to heuristic freshness and no CDN placed in front could hold anything,
so every image on every page was refetched on every visit. `cms/next.config.ts`
now sends `public, max-age=31536000, immutable` for `/api/media/file/*`.

That is only safe because `buildPayloadImageUrl` in `src/lib/payload.ts` appends
`?v=` derived from the doc's `updatedAt`. Payload keeps a filename when the
artwork behind it is replaced (`image-weight.mjs --replace` does exactly that),
so without that parameter a swapped image would never reach anyone who had
already seen the old one.

### Video is never loaded until it is wanted

`src/components/Video.astro` has two modes:

- **background**: a silent decorative loop. Renders as a poster and nothing
  else until it is near the viewport, then attaches sources and plays. Pauses
  again when it leaves. With JavaScript off it stays a poster, which is the
  right answer for decoration. Honours `prefers-reduced-motion` by never
  fetching a video byte at all.
- **player**: something a person presses play on. Real `<source>` elements so
  it works with no JavaScript, plus `preload="none"` so pressing play is the
  first thing that costs anyone anything.

The homepage hero carousel does not use the component, because it has its own
tuned idea of when a slide should load and two mechanisms would fight. It
shares the source-selection logic through `src/scripts/videoSources.ts`.

Only the slide on screen plays. Attaching a source used to start playback with
it, so every video in the carousel decoded frames at once while three of the
four were translated out of sight: work that costs a phone battery and shows
nobody anything. The rest sit paused on their poster until their turn.

**Why source selection is in JavaScript at all**: the `media` attribute on
`<source>` is only honoured inside `<picture>`. Inside `<video>` every browser
ignores it, so there is no markup that says "the small one on a phone".

### The bucket is ready to be a CDN origin

Every image byte still takes an origin hop through the Railway container that
also serves the admin panel, and the files sit in S3 `us-east-1`, so a first
visit from Accra crosses the Atlantic twice. The code side of fixing that is
done; the AWS side is not.

**`MEDIA_CDN_URL` is the whole switch.** Set it on the CMS service and every
image URL Payload hands out points there instead. Unset, nothing changes. There
is no code to edit either way, and removing the variable undoes it.

**`disablePayloadAccessControl` is deliberately not used**, though the Payload
docs pair it with `generateFileURL`. Setting it removes Payload's own
`/api/media/file/*` route: the plugin only registers the static handler when
that option is absent. Two things still want the route. `videoPipeline.ts`
stores derivative URLs as `/api/media/file/...`, and it is the fallback if the
CDN is ever wrong. `generateFileURL` alone is enough to move the URLs, and the
afterRead hook checks it first, so the route can stay registered and unused.

**All 955 objects now carry `public, max-age=31536000, immutable`.** They
carried nothing before: the storage adapter sets ACL and Content-Type on upload
and no more, and the header on the CMS route was added by
`cms/next.config.ts`, which a CDN reading from the bucket never sees. An origin
with no `Cache-Control` gives a CDN nothing to hold and a browser nothing to
remember, so this had to be fixed before any of the rest was worth doing.
`cms/scripts/set-media-cache-headers.mjs` does it, dry run by default, and is
worth re-running after a large batch of uploads because the adapter still will
not set it. A CDN response headers policy makes that moot by supplying the
header itself, which is the better long-term answer.

**Check before switching, not after.** `npm run check:cdn <url>` fetches real
files, and their resized copies, through the candidate URL and compares the
bytes and the content type against what the CMS reports, then checks the cache
header a visitor would actually receive. Pointing every image on the site at a
new hostname has no half measures; this is what makes it a decision rather than
a gamble.

### Decided 2026-09-02: no CDN for now

Ernest's call: leave AWS as it is. No distribution, and `MEDIA_CDN_URL` stays
unset, so images continue to be served by the CMS exactly as they were. This is
not an open item and should not be raised again unless he asks.

Nothing is waiting on that decision. The plumbing is inert while the variable is
unset, and it costs nothing to leave in place:

- `MEDIA_CDN_URL` on the CMS service is the whole switch, in either direction.
- `npm run check:cdn <url>` proves a candidate address serves the real files
  correctly before anything points at it.
- The bucket's objects already carry the right cache header, which is worth
  having regardless: it is what a returning visitor's browser reads.

If it is ever revisited, the two shapes are CloudFront in front of
`quadem-cms-media-prod` under `media.quademdigital.com` (already allowed in the
site's CSP, so video would play from it), or the bucket URL directly, which is a
minute's work but needs the S3 hostname added to `media-src` in `vercel.json`
before video would play.

Measure any of this with PageSpeed Insights, not local Lighthouse.
