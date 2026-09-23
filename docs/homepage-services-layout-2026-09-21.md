# Homepage service arrangement, 21 September 2026

The mobile card grid recorded here was subsequently replaced by the compact
overview in [homepage mobile scroll length](homepage-mobile-density-2026-09-21.md).
The desktop pairing and CMS ordering described below remain current. Use the
newer mobile QA suite for present mobile behaviour.

The homepage forced Fieldwork to span both columns, although the CMS currently
places Digital Marketing after it. This left an empty half-row beside AI
Automation and another beside Digital Marketing. Uneven caption and copy
lengths also left paired actions at different heights. At 561px the layout
still squeezed two narrow cards beside one another.

The service component now groups entries into consecutive pairs in the CMS's
existing order. Only an unpaired final entry spans the complete row, with its
artwork beside its copy. The current sequence is:

- AI Video & Reels / Web Design
- Brand Identity / SEO & Content
- AI Automation / Fieldwork
- Digital Marketing across the final row

Each pair shares the height of its artwork/caption area. Titles begin together,
copy grows naturally, and actions align at the bottom. Captions no longer rely
on guessed fixed minimum heights. At 720px and below the cards form one column,
including the final entry. Cards retain their artwork, captions, evidence
links, service links and CMS order. Automatic motion and explicit Pause/Resume
remain available.

Shipping changes: `src/components/home/ServiceStories.astro` and
`src/styles/visual-story.css`. No CMS content or database changes.

## Verification

All 52 browser checks passed. The review uses published CMS content and blocks submissions and
analytics. Checks cover all seven services at 14 viewport sizes from 320×740
to 3840×2160, including both sides of the 720px stacking breakpoint. It checks
complete rows, title/action alignment, image loading, text fit, CMS order and
keyboard navigation. Automatic motion is checked at five viewport sizes with
OS Reduce Motion enabled, including short landscape.

Representative phone, tablet and desktop views were visually inspected after
scrolling their images into view and waiting for image decoding. Large full-
section screenshots alone can miss offscreen image painting in headless Chrome;
viewport captures were used to confirm the actual visible artwork.

These are Chromium viewport checks, not physical device or Safari/Firefox tests.
The production build, theme guard and whitespace checks passed.

Evidence: `docs/qa/homepage-services-layout-2026-09-21.json`.
Reproducible review: `docs/qa/homepage-services-checks.py`, using
`SERVICES_BASE` (default http://127.0.0.1:4330) and `SERVICES_OUT`. Its expected
service order records the current CMS content and should be updated if an
editor intentionally changes that order.

## Release

Vercel deployment `dpl_BFTxjxfYFWZDGavUsL2mu75Fdmf7` is READY and assigned to
https://quademdigital.com. Deployment URL:
https://quademdigital-bz9k8pyot-quademagency-glitchs-projects.vercel.app

The live homepage references this deployment. Production browser checks passed
at 390×844, 768×1024 and 1440×1000: all seven service links and images are present,
paired titles/actions align, the final service spans the row, phone cards stack,
and no horizontal overflow or browser runtime errors were detected. No records
or emails were created. No git commit or push was performed.
