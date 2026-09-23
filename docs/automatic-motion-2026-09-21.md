# Automatic website motion, 21 September 2026

The user explicitly requested that website motion bypass the Mac's Reduce
Motion setting. The website now starts full motion automatically, regardless
of the device preference. An explicit Pause on this site is still remembered;
Resume re-enables motion. No system settings were changed.

The shared controller in `src/scripts/studio-motion.js` defaults to full motion
and no longer subscribes to device preference changes. The smooth-scroll and
form-transition helper in `src/scripts/main.js` now follows the same site pause
state. Existing CSS already permits full motion through its device media-query
fallbacks. With JavaScript disabled, the static readable fallback remains.

Validation:

- 21 browser checks passed with a local read-only CMS fixture. They cover OS
  reduction enabled, hero scrolling and camera drift, the service ribbon,
  desktop/mobile, the international layout, pause/reload/navigation/resume,
  wizard transitions, device preference changes, blocked storage and no JS.
- No browser runtime errors. All submissions and analytics were blocked.
- The production build passed in 29.23 seconds. Syntax, theme, copy and
  whitespace checks passed.
- Comparing the prior deployment upload manifest to disk identified exactly
  two changed deployment files: the shared motion controller and main script.

The initial browser run pointed at an old preview belonging to another project.
The isolated rerun also identified outdated artwork selectors in the older
motion test. The test now checks the current page and new default behaviour.
Evidence: [browser results](qa/automatic-motion-2026-09-21.json).

Production deployment `dpl_BF4EgyuyncoamwTz5grC6CSkGhD8` is READY and assigned
to https://quademdigital.com. Deployment URL:
https://quademdigital-9fb5adyfe-quademagency-glitchs-projects.vercel.app

The live homepage references the new `CzvWpsGP` script and deployment ID.
The CMS deployment and schema are unchanged. No live enquiry or email was
created, and no commit or git push was performed.
