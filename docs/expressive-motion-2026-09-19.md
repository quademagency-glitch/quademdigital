# Expressive motion, 19 September 2026

The user explicitly rejected the restrained, one-time entrances and requested
stronger movement throughout the public website. Both local development origins
served the current code with reduced motion off; the previous effects mostly
completed soon after entering view. This pass replaces those generic arrivals
with a replayable scroll timeline across both public layouts.

## What moves

- The original Reels hero opens over 1.65 seconds. Pointer movement tilts its
  raised card by up to 4°/5°. Scrolling separates the title lines in opposite
  directions, tilts the card up to 8° and shrinks it to .83 scale. The original
  image has independent depth movement and a gentle, visible-only camera drift.
- Headings unfold word by word. Moving back up the page reverses the sequence;
  the effects are not spent after a single visit. Original text nodes, nested
  links and emphasis are restored when motion is disabled.
- The four original artwork links fan into a full-colour row from alternating
  rotations and .78 scale. Pricing, product, trust, article, About and service
  cards use a larger rise, perspective rotation and stagger.
- Service titles slide in. Opening a service preserves the existing image and
  text choreography, including cancellation during rapid repeated toggles.
- Values use stronger alternating entrances, rotating symbols and moving
  numbers. Process cards still assemble through native sticky positioning;
  projects stack with up to 9% recession and their images open through a crop.
- Supporting copy, portraits, contact sections and footer groups share the
  scroll choreography. Focused forms and links settle immediately.

The shared implementation is `src/scripts/story-motion.js`, mounted and cleaned
up by `src/scripts/studio-motion.js`. `src/styles/story-motion.css` loads after
MarketingLab styles in both layouts. `src/components/MotionControl.astro` supplies
the persistent Pause motion control. The contact wizard also respects this choice.

## Visitor controls and boundaries

The OS reduced-motion preference takes priority. Pausing removes split-word
wrappers and decorative animations, stops pinning and loops, and preserves exact
text and entered form values. Hero/ribbon loops stop offscreen and in a hidden
document. Content and native disclosures work without JavaScript. Scroll input
is not intercepted. One scheduled frame batches nearby target reads and writes;
there is no permanent JavaScript rendering loop for the section effects.

Original Quadem images, logo, blue palette, CMS settings, routes, prices and form
bindings remain. The work is local, with no production deployment or CMS write.
The IDE launch configuration now opens the actual Quadem preview at
http://127.0.0.1:4322/ instead of the stale port 8080 address.

## Verification

- 32 browser assertions passed, including measured intermediate transforms,
  reverse scrolling, pointer response, idle hero movement, offscreen suspension,
  persistent pause/resume, exact text preservation and typed form values.
- Desktop 1440×900 and mobile 390×844 were inspected. All sampled mobile sections
  fit horizontally. The mobile process remains swipeable without pinning.
- About client navigation, service text/cards, Ghana cedi prices, the global
  layout, interrupted service disclosures and the contact wizard passed.
- OS preference changes and the no-JavaScript fallback passed. No browser
  runtime errors were captured. The browser harness blocked analytics and all
  non-GET/HEAD requests, including real form submissions.
- 17 existing regression tests passed. Theme and copy guards passed. The final
  production build completed successfully in 1m26s. Its only compiler warning
  was the existing unused docx imports in the client-won API.

Browser results: `docs/qa/expressive-motion-2026-09-19.json`.
Reproducible checks: `docs/qa/story-motion-browser-checks.py`.
Actual browser walkthrough: `docs/qa/quadem-expressive-motion-preview.mp4`.
This records a warm-page reload and native scrolling, with the initial asset
loading trimmed out; it is a motion demonstration, not a cold-load benchmark.

The initial text-parity test used innerText and incorrectly counted an
aria-hidden rolling-button copy which pause intentionally hides. The corrected
check compares normalized textContent, every heading and the typed input. All
matched. Wizard pause was then checked separately after extending the control.
