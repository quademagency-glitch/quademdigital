# Original images and section motion correction

Completed 19 September 2026 against the local preview at http://127.0.0.1:4322/.

## What went wrong

The rebuild stopped reading `homepage.heroServices` and the assigned CMS service images. Generated photographic and sculpture treatments displaced the original artwork, although the original files remained in the CMS. `PageHero.astro` also suppressed assigned images whenever its variant was `page`. Earlier CSS neutralised generic section animation, while the replacement motion controller only covered a few areas and desktop pinning depended on a tall viewport.

The user's request for their existing imagery now takes precedence over the previous generated treatments. MarketingLab remains the composition and behaviour reference, with Quadem blue, the visible original logo and the requested raised-card hero.

## Restored media

The homepage reads the existing CMS assignments at render time. `Picture.astro` supplies the CMS AVIF/WebP derivatives, responsive sizes, dimensions and image alts. No CMS records were changed and no new artwork was generated.

| Placement | Original CMS file |
| --- | --- |
| Hero: Websites | `hero-websites-stack.webp` |
| Hero: Brands | `hero-brand-identity-real-r3.webp` |
| Hero: Campaigns | `hero-seo-black.webp` |
| Hero: Reels | `hero-ai-video.webp` |
| Web design service | `service-web-design-row.webp` |
| Brand identity service | `service-branding-real-r3.webp` |
| SEO service | `service-seo-black.webp` |
| Video service | `service-ai-video.webp` |
| Digital marketing service | `service-social-real-r3.webp` |

The four hero images link to their corresponding services by label. They appear as a contained desktop row and a native horizontal swipe gallery on phones. The process panels reuse those original images under a dark readability scrim. Five homepage service disclosures expose the assigned artwork, including digital marketing. The services overview uses the assigned web-design image and the real founder portrait. Shared PageHero renders supplied images on all its variants, restoring the services/contact media. Service-page alts come from the assigned image instead of generic illustration labels.

Actual portfolio, founder, blog and existing video content remain in their CMS-backed contexts. The footer displays the Quadem logo; the international hero retains the founder portrait, with the actual logo as its missing-portrait fallback. Generated hero/process photos and sculpture files remain on disk as historical assets but are no longer referenced in the active public source. Historical prompts remain in `docs/marketinglab-assets.md`, now explicitly marked superseded.

## Motion now visible

- Raised hero: existing fine-pointer tilt and native-scroll recession remain; four image links arrive with a staggered rise, slight rotation and scale.
- Section headings: viewport-triggered crop and vertical reveals across the homepage and shared inner pages.
- Services: rows enter from the side; disclosures animate their measured height, artwork crop/scale and capability items.
- Process: fit-gated sticky arrivals on large screens, ordinary-flow arrivals on phones and short laptops.
- Values: the line scales with scroll progress and alternating cards move into place.
- Founder, introductory artwork, work and blog images: crop or scale reveals as they enter view; existing work stacking remains.
- Pricing and other inner-page section hooks: one-time arrivals controlled by the same IntersectionObserver.

The controller owns lifecycle cleanup and removes temporary animation state on navigation or preference changes. The old generic studio observer defers to it. Reduced motion leaves all content visible, disables the transforms and sticky sequences, and fills the values line. There is no scroll hijacking or perpetual decorative loop.

## Validation

The browser batch passed 24 checks, including the four original hero images, all five service images, real animation calls, hero pointer response, values scrolling, service-opening motion, shared-page media, mobile swiping, route overflow and reduced-motion cleanup. No JavaScript errors were recorded. Eight final checks confirmed the heading fits at 320/360/390px, image links match the services, and service images clear the headings at 1024/1280/1440px. Four additional image checks explicitly awaited responsive-image decoding; the desktop/mobile hero, service and all process artwork loaded with no failed CMS media requests. Early blank screenshots were captured before image decoding, then replaced with loaded-image captures.

Fourteen unit/regression tests passed during this correction. All ten release guards passed across the initial run and targeted reruns. The theme guard initially flagged the intentionally dark image scrim; it now has a documented theme exemption because white process text must remain readable over artwork in either stored theme. The blog check's sandboxed fetch was retried successfully with network access. The global guard defaults to port 4321, so all five funnel URLs were additionally checked explicitly against the actual port-4322 preview and passed.

The production build passed in 4m 14s. It reports an existing unused `docx` import warning in the client-won endpoint. The only source edit after that build was the explanatory CSS comment and theme-exemption marker; rendered CSS behaviour is unchanged. The build's prebuild optimizer recompressed an unused historical sculpture PNG. No additional production build was needed for the comment-only change.

Machine-readable evidence: `docs/qa/original-images-motion-2026-09-19.json`. Screenshots and browser evidence are in /tmp/quadem-originals-motion/. Final captures include hero-desktop-final.png, hero-mobile-final.png, services-desktop-final.png and process-desktop-final.png. CMS inspection snapshots and the inspected contact sheet are in /tmp/quadem-original-images/.

This verifies the local implementation, not pixel-identical Framer timing or production publication. No deployment, commit, push, CMS write, real enquiry or email submission occurred; browser POST requests were blocked. The unrelated IPv6 app and `.claude/settings.json` were left untouched.
