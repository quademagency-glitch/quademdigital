# Responsive motion correction, 19 September 2026

The user reported that the preview was not working on a 27-inch desktop monitor.
The preceding motion pass had checked only 1440×900 desktop and 390×844 mobile.
Physical diagonal does not identify browser resolution, so this pass covers a
range of desktop CSS viewports, shorter browser windows, tablets and phones.

## Findings and changes

- The hero kept growing with viewport width while most sections remained capped
  at 1200px, and gallery images stayed 230px high. At 1600px and wider, the content
  container now grows from 1280px to 1800px, gallery images grow to 370px, and
  section headings, supporting copy and cards scale with the available space.
- Hero type now respects both viewport width and height. Hero content is capped
  at 2200px and the card at 1100px tall, retaining the original artwork and the
  raised-card motion. Inner-page artwork fills and centres within its media area.
- Process pinning measures the heading and tallest card together. It starts at
  1200px width only when the complete story fits vertically. Tablet windows use
  two columns; smaller screens retain the swipe rail. Work stack offsets now
  clear measured headings and filters. ResizeObservers update these measurements.
- The hero's old per-frame smoothing took longer on slower-rendering wide
  viewports. It now uses elapsed-time easing and snaps to its exact resting
  target. Gallery and card travel distances scale with viewport dimensions.
- Long animated words can wrap inside their masks. The mobile service summary
  uses a shrinkable title column and a 38px icon track. Only the plus glyph rotates; rotating its circular container had expanded its overflow bounds by 8px.

Implementation: `src/styles/marketinglab.css`, `src/styles/story-motion.css`,
`src/styles/studio-motion.css`, `src/scripts/studio-motion.js`, and `src/scripts/story-motion.js`.
Original CMS content, logo, media, prices and form bindings remain authoritative.
No real lead submissions, CMS writes or production deployment were performed.

## Verification

105/105 final browser assertions passed across twelve viewport sizes:
1920×1080, 2560×1440, 3440×1440, 3840×2160, 2560×1200, 1707×960,
1536×864, 1280×720, 1024×768, 768×1024, 390×844 and 320×568.

Checks cover hero text bounds, pointer response, scroll recession, exact return
to rest, eight major scroll sections, decoded original project imagery, complete
process assembly, work-stack fit, and six inner public pages at 2560×1440. Resizing
during the process sequence, pause/resume and OS reduced motion also passed.
No browser runtime errors were captured. Theme, copy and JS syntax checks passed.
The final production build passed in 23.85s; the existing unused docx imports
warning in the client-won API remains unrelated to this change.

Results: `docs/qa/responsive-motion-2026-09-19.json`.
Reproduce: `python3 docs/qa/responsive-motion-browser-checks.py`; optional arguments
such as `1280x720 768x1024` select targeted sizes. Preference/resize checks are in
`docs/qa/responsive-resize-browser-checks.py`. Screenshots are the three
`docs/qa/responsive-desktop-2560-*.png` artifacts.

The browser harness blocks analytics and all non-GET/HEAD requests. These are
Chromium CSS-viewport checks, not a claim that the user's exact monitor/browser
or every hardware configuration has been tested. Smaller CSS viewports cover
common window/scaling layouts; browser zoom itself was not automated.

The first matrix caught two mobile service-icon overflows; they were fixed and
those sizes were retested. Its 1280×720 process-row assertion incorrectly assumed
28px bottom padding, which only applies at taller sizes. The assertion now reads
the actual computed padding and the corrected case was retested. Tests wait for
rendered frames before checking scroll-driven text, and explicitly decode project
images before checking them. Early screenshots taken before image decoding did
not establish an image-rendering defect.
