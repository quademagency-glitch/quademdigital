# Responsive display fixes, 21 September 2026

The user requested that the website display properly across screen sizes. This
pass reviewed every published sitemap route against the current CMS content,
including articles, projects, service details, offers and legal pages.

## Fixes

- The full CMS navigation and booking button were squeezed around 1100px, with
  the booking label wrapping and extending beyond the available header space.
  The mobile drawer now remains available below 1200px. The booking action keeps
  its width and single-line label.
- The footer switched to four columns too early. At 801–900px the email address
  overflowed its contact column and could be clipped by the page boundary.
  The footer now retains two columns through 1100px, with contact and newsletter
  areas spanning the row. Contact links can wrap unusually long addresses.
- Opening mobile navigation and then widening the window left an invisible
  drawer active and the page's scroll lock enabled. The controller now closes
  the drawer and clears the lock when CSS switches to desktop navigation.
  The resize listener is replaced on client navigation to prevent duplicates.

Shipping changes are limited to `src/styles/marketinglab.css` and
`src/scripts/main.js`. The existing visual direction, CMS content, pricing,
forms and automatic motion default remain.

## Verification

All checks below passed against a local preview, using read-only published CMS
content. Test browsers blocked submissions and analytics. No live enquiry,
client, subscriber or email was created.

- **400 page/size states:** all 40 published routes at 320×740, 390×844,
  768×1024, 844×390, 1024×768, 1280×720, 1440×900, 1920×1080, 2560×1440 and
  3440×1440. All returned 200, with no detected page overflow, text clipping,
  navigation collision or broken loaded image.
- **44 boundary states:** homepage, contact, web design and international
  landing page at 560, 561, 800, 801, 900, 901, 1100, 1101, 1199, 1200 and
  1600px widths.
- **39 interaction checks:** visible navigation, short landscape drawers,
  reaching the final navigation action, Escape, resizing an open menu,
  phone form sizing, focused fields with a short viewport, and footer links
  remaining reachable beside the fixed controls.
- **45 motion checks:** eleven viewports from 320×568 through 3840×2160.
  Hero text fits, scrolled section text settles, short/narrow windows use
  normal-flow process/project cards, and pinned cards fit the available screen.
- No browser runtime errors. Representative phone, tablet, laptop and large
  desktop screenshots were visually inspected.
- JavaScript syntax, theme and whitespace checks passed. Astro's production
  build passed in 1m 38s.

These are Chromium viewport tests, including simulated phone and landscape
sizes. They are not a claim to have tested every physical device or browser.
The client portal, invoice payment pages, CMS admin and generated pitch sites
are separate operational surfaces, outside this public-site pass.

Evidence: [responsive results](qa/responsive-display-2026-09-21.json).
Reproducible checks: `docs/qa/responsive-layout-checks.py`,
`docs/qa/responsive-interaction-checks.py`, `docs/qa/responsive-scroll-checks.py`.
Set `RESPONSIVE_BASE` to the local preview; the default is port 4330. The layout
script uses `docs/qa/responsive-routes-2026-09-21.json` and accepts optional
`RESPONSIVE_ROUTES`, `RESPONSIVE_SIZES` and `RESPONSIVE_OUT` overrides.

## Release

Vercel deployment `dpl_Dm78pjW7utgyvgnfDRnx1Duc4dMn` is READY and assigned to
https://quademdigital.com. Deployment URL:
https://quademdigital-l5dm9imxc-quademagency-glitchs-projects.vercel.app

The live homepage references this deployment. Its delivered CSS contains the
new navigation and footer breakpoints and contact wrapping; its main script
contains the drawer resize handler. Four additional read-only browser checks
passed on the live homepage and contact page at 390×844 and 1024×768, with
zero detected layout issues or runtime errors. Verified at 13:37 UTC on
21 September 2026. Submissions and analytics remained blocked.

No CMS deployment or database migration was required for these frontend
changes. No commit or git push was performed.
