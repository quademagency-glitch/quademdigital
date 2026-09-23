# Motion refinement, 19 September 2026

The live MarketingLab reference was scrolled through 27 desktop positions before this pass. Its key behaviours are staggered rising content, pinned process cards, alternating value cards, expanding services and moving work panels. The existing Quadem controller already covered the major stories, but the restored trust highlights, products, contact form and footer groups had no entrance hooks.

## Changes

- The two hero headline lines reveal independently over 1100ms, 170ms apart. Supporting copy and the three facts follow in an 850ms sequence. Original image depth, pointer tilt and scroll recession remain.
- Headings and supporting copy now rise and fade over 850ms. Sibling items stagger by 100ms, capped at 240ms; delays restart for each parent. Delayed animations apply their starting frame immediately, avoiding a flash before the movement starts.
- Trust highlights, both original product cards, product copy, About values, contact portraits/forms, footer groups and the final invitation join the same viewport observer. Work-panel text and facts enter in sequence; work images settle over 1050ms.
- Service panels keep their interruptible 380ms opening and 250ms closing. Artwork reveals over 800ms; the configured body, badges, capabilities and CTA enter over 650ms with a short stagger. Rapid closing/reopening cancels obsolete child animations.
- Product, project and original-image links get consistent directional arrow feedback. Submit labels remain ordinary mutable text.
- The contact wizard uses a finite 400ms transition instead of a timer that sets opacity to zero. Reduced-motion users get an immediate, readable step change.
- Values scroll updates batch geometry reads before style writes. No animation dependency was added.

The major reference behaviours stay in place: raised hero, service ribbon, reading-progress introduction, pinned desktop process, mobile process swipe rail, alternating values and stacked work. CMS settings, prices, images, routes and form endpoints remain intact.

## Verification

26 browser assertions passed in Chromium: real animation playback and completion; distinct hero timings; pointer response; restored section coverage; process/values/work stories; interrupted accordion toggling; 390px layout and swipe rail; wizard progression; preference changes; client navigation without duplicate wrappers; no-JavaScript content and native disclosures. No browser runtime errors. All non-read requests and analytics were blocked; no real enquiry was submitted.

17 regression tests passed, along with theme/copy checks and the production build (1m25s). Existing unrelated unused `docx` import warnings remain. A short native-scroll frame sample is recorded separately in the QA JSON; it is not a performance guarantee for every device. Physical iOS/Android testing was not performed.

Reduced motion removes scripted arrivals, hero transforms and pinned stories, stops product hover zoom, and preserves the native mobile rail. Content remains visible without JavaScript. A focused form or link is not moved by a newly triggered entrance.

Evidence: [QA results](qa/motion-refinement-2026-09-19.json). A local browser walkthrough is saved beside this report as `qa/quadem-motion-preview.mp4`. The source captures and detailed reference inspection are in `/tmp/quadem-motion-refinement/`. No deployment was performed.
