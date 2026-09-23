# A clearer visual sales story

The user found the image-framing pass too subtle and explicitly requested new
images and a more professional, coherent sales story. This pass changes the
visible design, its imagery and the homepage reading sequence.

## What changed

- New outcome-led hero: “Make your business / the clear choice.” It includes the
  existing booking CTA, a work link, the founder-led proposition and a new still
  life connecting website, mobile and identity materials.
- Four coordinated service illustrations with customer-centred copy and concrete
  deliverables. Real projects follow services; process follows project evidence.
  All seven CMS service destinations are still accessible.
- Relevant service heroes and the service directory use the same image family.
  Fieldwork records, videos, projects, logos and founder portraits stay original.
- Removed repeated photos from process, service-disclosure and footer backdrops.
  Removed the duplicate home gallery/accordion and long values sequence. The
  clearer process cards retain their native scrolling and use verified contrast.
- Preserved raised hero motion, persistent Enable/Pause/Resume, section motion,
  CMS pricing and the original enquiry system. The new service image and its copy
  animate together rather than separately.

The curated homepage headline and service-story copy live in code. Earlier CMS
promotion records are preserved but no longer generate a second homepage service
section. Other CMS content, contact data, prices and business settings remain
connected. No CMS records were changed.

## Generated assets and prompts

Used the built-in `image_gen` tool, four independent generation calls. The full
prompt set, generation paths, project paths and optimized sizes are recorded in
[the asset manifest](visual-story-assets-2026-09-20.json).

Original deliverables:

- `output/imagegen/quadem-studio/digital-presence.png`
- `output/imagegen/quadem-studio/brand-system.png`
- `output/imagegen/quadem-studio/content-studio.png`
- `output/imagegen/quadem-studio/local-discovery.png`

The site consumes corresponding 640, 960 and 1536px WebP versions in
`public/images/studio/`. The largest files range from 58 to 116 KB. Original PNGs
are retained outside the public site. Sharp performs format/size optimization,
not content generation or compositing. Generated scenes are illustrative service
artwork, not client portfolio evidence or photographs of Quadem personnel.

## Validation

- 93 browser assertions passed across 16 routes at 390 and 2560px, plus targeted
  homepage checks at 320, 768 and 1440px. No document overflow or image stretching.
- New image selection and loading, service destinations, actual project/portrait
  sources, Ghana currency, service disclosure, work-anchor navigation, hero scroll
  motion, service-card motion, pause and no-JavaScript rendering passed.
- Process body, heading and number contrast all exceed 4.5:1. Darkened the hero's
  top scrim after wide-screen inspection to keep navigation readable.
- Production build passed in 23.14s. Theme literal check: zero. Whitespace check
  passed. Three existing public-settings helper tests passed.
- Existing build warning: unused docx imports in the client-won API route.

Evidence is in `docs/qa/visual-story-2026-09-20.json`; the rerunnable browser
script is `docs/qa/visual-story-checks.py`. Screenshots:
`docs/qa/visual-story-home-desktop.png`, `docs/qa/visual-story-home-mobile.png`,
`docs/qa/visual-story-services.png`, `docs/qa/visual-story-process.png`.

An initial test selected a hidden price from another market; it now targets the
visible price. Another incorrectly required a URL hash even though the site's
existing smooth-scroll handler scrolls without setting it; the corrected test
measures the actual destination. Neither required application changes. A stale
development import was refreshed after the new stylesheet was created.

Checks use headless Chromium; they do not assert performance on every physical
device or browser. All non-GET/HEAD requests and analytics were blocked in browser
testing. No real lead submission, deployment, push or CMS mutation occurred.
The review remains at http://127.0.0.1:4322/?preview=visual-story.
