# Inner-page heroes, 20 September 2026

The user chose **image-led services and cleaner editorial titles elsewhere**.
Preview: http://127.0.0.1:4322/.

## Result

- Services overview and the Web Design, Brand Identity, AI Video, SEO and Fieldwork pages now pair a left-aligned headline, introduction and action with their original artwork. CMS-driven service routes use the same component; video slots remain supported.
- Service art uses its original aspect ratio, a contained image, a 720px desktop width limit and height-aware sizing. It replaces the small portrait image previously centred in a broad empty image mat. Fieldwork uses its existing, redacted delivered record, retains its exact copy and keeps its single enquiry CTA and tracking event.
- Projects, About, Blog, Contact, Offers and Calculator use larger editorial headings with supporting copy aligned at the title base and a thin bottom rule. About adds a working Meet the founder anchor. Services adds an Explore the services anchor.
- The split becomes a single column at 800px. Long service titles have their own size scale; small-phone buttons stack. Original logo, CMS text, media alt text, prices, forms, filters and booking destinations remain connected.
- Homepage, Global, article, case-study and legal openings retain their existing compositions. This pass did not publish or change CMS records.

## Motion

Service artwork has a finite 1400ms aperture/lift entrance, with a separate native-scroll transform. It arrives from below on stacked mobile layouts, rests at full size, then moves upward by up to 70px with 2-degree rotation and .95 scale as it leaves. Reversing the scroll reverses the movement. Existing word-mask title entrances remain active.

The same motion preference controls the new effects: follow OS Reduce Motion until the visitor explicitly chooses Enable motion; preserve full/paused choice across navigation; cancel and restore the static presentation when paused. No wheel interception or hidden default content was added.

## Verification

107 browser assertions passed against the actual preview:

- 13 routes at 320×740, 390×844, 768×1024, 1024×768 and 2560×1440: no horizontal overflow or overlap between title, copy and artwork. One visible H1 per page and valid in-page hero anchors.
- All seven tested service/overview hero images loaded with alternative text and contained rendering.
- Native wheel movement under OS Reduce Motion plus explicit Enable motion changed desktop card displacement from 0 to approximately -58px; reverse scrolling restored its original matrix exactly. Mobile art moved from approximately +62px into its full-size resting pose.
- Pause restored static artwork and original text nodes. Client navigation preserved motion without duplicate word wrappers. The contact wizard advanced without submission.
- Web Design and Contact remained readable at 390px with JavaScript disabled. No browser runtime errors were observed.

The first harness run stopped on a quoted-selector syntax error; the corrected run passed the layout and motion checks. A requestAnimationFrame wait in the no-JavaScript test could not resolve, so that wait was removed and the two affected checks were run separately and appended to the evidence. These were test-harness corrections, not hidden application failures. The final script includes both corrections.

Theme literals and shipping-copy guards passed. The copy check initially lacked network access; its read-only network-enabled rerun passed against source, CMS and templates. JavaScript syntax and git diff whitespace checks passed. The production build passed; its only warning was the existing unused docx imports in the client-won API.

All browser non-GET/HEAD requests and analytics were blocked. No real enquiry, CMS write or deployment occurred. These are Chromium CSS viewport checks, not verification of every physical monitor or browser.

## Files and evidence

- `src/components/PageHero.astro`, `src/styles/page-hero.css`, `src/scripts/story-motion.js` and both public layouts.
- Page integrations: Services, About, Contact, Blog, Offers, Calculator, Fieldwork and dynamic services. Static service pages and Projects consume the shared component.
- `docs/qa/inner-page-hero-browser-checks.py`
- `docs/qa/inner-page-heroes-2026-09-20.json`
- `docs/qa/inner-hero-web-design-desktop.png`
- `docs/qa/inner-hero-projects-desktop.png`
- `docs/qa/inner-hero-video-mobile.png`

Additional before/after images remain in `/tmp/quadem-inner-heroes/`.
