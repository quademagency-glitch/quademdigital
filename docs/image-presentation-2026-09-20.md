# Public image presentation, 20 September 2026

Request: work on images across the entire website and how they are displayed.
Local preview: http://127.0.0.1:4322/.

## Changes

- Home artwork now uses its actual portrait shape, rather than a short landscape mat. The gallery shares the page container, forms four columns on desktop and two on tablet, and retains native phone swiping.
- Project screenshots are complete framed images with status badges outside the artwork. Service portfolio stills and case-study galleries keep their original proportions. Existing case-study dialogs now provide an Open full-size image link that follows the selected image; service and CMS-block still-image galleries link directly to their original.
- Service illustrations use frames based on their actual shape. The service introduction separates its caption from the artwork. Product screenshots are contained and rounded consistently, including the plain-img fallback.
- Founder portraits use a 5:7 frame, capped at 560px (440px on Global). The Global portrait had been stretched into a square; its Picture child now receives the intended style. Existing editor focal points are respected where supplied.
- Blog thumbnails use a consistent 4:3 editorial crop. Full article covers grow to their natural height. Offer graphics keep the complete image without a hover crop or glow obscuring it.
- Picture reserves intrinsic CMS dimensions and exposes the actual aspect ratio. Responsive download hints now follow the 1200–1800px container. Derivative srcset descriptors use recorded widths instead of assuming that every file matches its nominal size. Small marks use the smaller WebP ladder. Lower service images remain lazy-loaded.

Original CMS/local assets, logo, wording, project classifications and service destinations remain. No original image was replaced, generated or re-encoded; no CMS writes or deployment occurred. Background scenes retain their deliberate cover treatment. Portal, invoice and transactional layouts were not redesigned; the shared image component still supplies correct intrinsic dimensions wherever used.

## Verification

133 browser assertions passed across 18 public routes, with repeated image layout checks at 390, 768 and 2560px; targeted checks also cover 320px. Complete-image checks wait for each inspected image to finish loading before screenshots. The review covered the homepage, service overview and detail pages, projects and case studies, About, Contact, Global, blog index and an illustrated article, plus offers and an offer detail.

Native wheel scrolling still moves the original-art gallery. Pause restores the static presentation, the phone rail still swipes, and project image dialogs retain arrow-key navigation, Escape and focus restoration. The full-size link updates with the selected image. Web Design and Global images render without JavaScript. No browser runtime errors were observed.

The first layout run reported five offscreen-image findings inside intentional horizontal project/reel rails. The check was corrected to distinguish a local scroll container from page overflow and to ignore hidden player elements. All affected sizes were rerun successfully. Four final loaded-image screenshots, four 320px checks and two no-JavaScript checks completed the evidence. Early exploratory captures made before image decoding finished are not treated as evidence of missing files.

Production build passed in 28.69s. Theme and whitespace guards passed; the three existing public-settings regression tests passed. The build retains the existing unused docx-import warning in the client-won API. These are Chromium viewport and interaction checks, not a claim that every physical device or unpublished CMS block was exercised. Available source resolution still limits maximum sharpness; no synthetic upscaling was used.

Browser analytics and non-GET/HEAD requests were blocked. No real form was submitted.

## Implementation and evidence

- `src/components/Picture.astro`, `src/lib/payload.ts`, `src/lib/mediaPresentation.ts`
- `src/styles/media-presentation.css`, loaded after the existing hero stylesheet in both layouts
- WorkCard, ServiceProjects, PortfolioTile, ProductsSection, ImageGalleryBlock and MediaAndTextBlock; updated page image sizing and case-study viewer link
- `docs/qa/image-display-browser-checks.py` (main suite)
- `docs/qa/image-display-followup-checks.py` (targeted follow-up, run after the main suite)
- `docs/qa/image-presentation-2026-09-20.json`
- `docs/qa/image-gallery-desktop.png`
- `docs/qa/image-gallery-mobile.png`
- `docs/qa/image-project-display.png`
- `docs/qa/image-global-portrait.png`

Additional exploratory and final images remain in `/tmp/quadem-image-display/`.
