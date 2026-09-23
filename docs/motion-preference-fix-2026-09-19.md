# Motion preference fix, 19 September 2026

Superseded on 21 September by the user's explicit request for
[automatic website motion](automatic-motion-2026-09-21.md). The site now defaults
to full motion independently of device settings and retains an explicit pause.
The results below describe the earlier policy.

The user confirmed the local preview at http://127.0.0.1:4322/. A read-only check
of this Mac returned `reduceMotion = 1`. Reproducing that preference in Chromium
showed `body[data-motion="reduced"]`, zero story targets, a disabled “Motion
reduced” button, and no hero transform after real wheel scrolling. Previous
full-motion tests explicitly selected `no-preference`, missing this setup.

The default still follows the OS. The control now offers **Enable motion** when
reduction is inherited, and **Pause motion** / **Resume motion** after a choice.
Explicit site choices persist in localStorage. A session fallback preserves the
choice through client navigation when storage is unavailable. No Mac settings
were modified.

CSS and JavaScript now use the same resolved full/paused/reduced state. Universal
reduced-motion CSS no longer cancels an explicit opt-in; pinning, the ribbon,
hero, word reveals, image fan and wizard transitions honor that choice. Without
JavaScript or without an explicit opt-in, OS reduction remains respected.

26 browser checks passed with real wheel scrolling, including 2560px desktop,
390px mobile, default reduction, explicit opt-in, hero/text/gallery movement,
CSS loop/pinning activation, reload, client navigation, the global layout,
pause/resume, wizard transitions, system changes, blocked storage and no-JS.
Gallery screenshots before and after wheel input were visually inspected.
Analytics and non-GET/HEAD requests were blocked; no real lead was submitted.
Theme, JS syntax and diff checks passed. Production build passed in 1m03s.

The browser test now waits for the asynchronous preference-change event rather
than assuming it arrives within 100ms. The two older executable motion checks
were updated to reflect explicit site choice taking precedence. Historical QA
reports retain their original results; this report supersedes their old policy.

Implementation: the shared studio controller and main.js preference helper,
plus style.css, studio.css, studio-motion.css, marketinglab.css and story-motion.css.
Evidence: `docs/qa/motion-preference-fix-2026-09-19.json` and reproducible checks in
`docs/qa/motion-preference-browser-checks.py`. Local source only; no deployment.

Refresh the preview. If the bottom-left control offers Enable motion or Resume
motion, activate it once. Pause motion indicates effects are enabled.
