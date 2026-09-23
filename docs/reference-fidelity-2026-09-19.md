# MarketingLab reference fidelity, 19 September 2026

The user rejected the previous rebuild because it did not fit the supplied reference. Passing functional checks had not established visual fidelity. This correction follows a fresh browser walkthrough of https://marketinglab.framer.ai/ rather than the older interpretation of its layout.

## Reference evidence

The live reference was opened in Chromium and scrolled through 28 desktop positions at 1440×1000, from hero to footer. Services, Work, About, Pricing, Blog and Contact were visited separately, an actual service disclosure was opened, and phone layouts were captured. Evidence is in `/tmp/quadem-reference-walkthrough/`; screenshot names and measured positions are in `scroll-frames.json` and `inner-pages.json`. The user's original Quadem imagery, logo, blue accent, raised hero and Ghana pricing override the template's assets and fictional proof.

## What changed

- The hero uses the original Reels artwork across the viewport, monumental WEB DESIGN above right-aligned italic AGENCY, bottom copy and factual location/working information. It retains pointer tilt, image depth and scroll recession. The four original image links follow the introduction instead of occupying the hero.
- A continuously moving service ribbon leads into the reference's cream, offset introduction with scroll-progress text. Original service artwork replaces the template's unsupported client-logo strip.
- Desktop process cards assemble across a 455px stagger with a pinned heading and row. On phones they form a horizontal swipe rail with the next card visible and a centred heading. Small or reduced-motion viewports retain readable content.
- Values use alternating 480px cards, a central progress line and visible original brand artwork at viewport scale. Expanded services use the assigned CMS artwork as both their actual image and dark background.
- Four published project panels form the homepage's work sequence. Split white panels include real project classification and services, without fabricated client results.
- Services opens directly into its opportunity statement and image triptych. Work retains category filters with tighter spacing. Blog uses two-column cards. Contact aligns its heading and existing enquiry wizard beside the founder portrait in the first viewport.
- The closing invitation retains the actual Quadem logo. A photographic dark footer places brand/newsletter above and CMS navigation/contact across the row below. Social symbols have corrected contrast; navigation, FAQ and submit icons use SVG strokes.

## Functional boundaries

Original CMS records, founder portrait, service imagery, project statuses, country selection, Ghana price lists, booking and enquiry logic are retained. No template testimonials, statistics, customer logos or prices were copied. POST requests were blocked during browser checks; no actual enquiries or emails were sent. No deployment, commit, push or CMS write was performed.

## Review and validation

The first desktop/mobile batch checked the homepage sequences and 13 public routes, including all seven service pages. One reported contact failure was a check using a nonexistent `data-step` attribute; the saved screenshot already showed the real wizard on step two. The corrected final check uses `#wizardStep2`.

An independent finish review identified seven bounded corrections: photographic depth, footer composition, mobile process rail, inner-page spacing, narrow-phone facts, social contrast and consistent SVG icons. Final results are recorded in `docs/qa/reference-fidelity-2026-09-19.json`. The corrected browser batch passed 16 checks, followed by six footer/overlay confirmations. All 14 regression tests and ten release guards passed. The final production build passed in 1m22s, with the existing unused docx-import warning. The emitted direction contract remains in the production bundle.

The reference's structure and behaviour are the authority, with intentional Quadem content and brand adaptations. This is not a pixel-identical copy of its imagery or business claims. The preview is http://127.0.0.1:4322/; the public domain has not been changed by this work.

## Final independent verdict

Disposition: **ship**. No remaining material findings in the reviewed regions.

| Finding | Verdict |
| --- | --- |
| Visible original artwork in dark sections | Resolved |
| Footer navigation/contact distribution | Resolved |
| Mobile process swipe rail | Resolved |
| Services/Work spacing and Contact alignment | Resolved |
| Hero facts at 320px | Resolved |
| Footer social contrast | Resolved |
| SVG controls and inactive video overlay | Resolved |

The corrected regions were returned to the same reviewer for confirmation. The mobile footer was explicitly recaptured after resizing, including its lower links; the closed video overlay has no visible orphan control. Screenshot evidence supports these visual findings; continuous motion was additionally checked in the actual browser and source. This verdict does not claim an independent review of every possible route state.
