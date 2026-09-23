# Homepage mobile scroll length, 21 September 2026

The user asked to reduce scroll fatigue in the homepage services and featured
work sections. The preceding arrangement fixed empty service rows on desktop,
but mobile still presented seven full illustrated service stories and four
lengthy case-study previews in succession.

## Current mobile arrangement

At widths up to 800px, and in short landscape windows up to 1000×500px:

- Services are seven named native disclosures, closed by default. Opening one
  closes the previous one. Each retains the complete illustration, provenance,
  description, deliverables and service action. The labels use the CMS service
  titles and the order remains controlled by the homepage promotions.
- The repeated service directory is replaced by one Explore all services link.
- Featured work shows all four projects as compact thumbnail/title previews,
  with their real client/internal classification, in-progress status and service
  category. Both image and title link to the full case study. The long excerpt
  and repeated facts remain in the desktop presentation and project detail page.
- Previews form one column on phones and two columns from 600px within this
  compact layout. Thumbnail download hints match their smaller display size.
- Services work natively without JavaScript. There is no automatic carousel,
  intercepted scrolling or new interaction dependency. Automatic decorative
  motion and the explicit site Pause/Resume control remain.

Service content is shared through ServiceStoryContent so the mobile disclosure
and desktop grid use the same CMS content, artwork, evidence and actions. Only
one presentation is visible or exposed to keyboard navigation at a time.
Desktop section heights are unchanged at 1440px.

## Measured reduction

Measurements include the section headers and spacing, with service disclosures
closed. They describe the overview, not the length after deliberately expanding
a service. Screen-height equivalents exclude the other homepage sections.

| Viewport | Services before / after | Work before / after | Combined reduction |
| --- | --- | --- | --- |
| 320×740 | 6417 / 944px | 4343 / 873px | 83.1% |
| 390×844 | 6224 / 850px | 4157 / 815px | 84.0% |
| 430×932 | 6200 / 850px | 4129 / 861px | 83.4% |
| 768×1024 | 3510 / 850px | 4129 / 527px | 82.0% |
| 1440×1000 | 3736 / 3736px | 2877 / 2877px | unchanged |

On the 390px phone viewport, the combined overview fell from 12.3 screen-heights
to 2.0. These are Chromium measurements, not a claim about every physical device
or browser.

## Verification

92 browser checks passed across 15 viewport sizes, including breakpoint edges,
short landscape, all seven disclosure panels, touch taps, keyboard activation,
exclusive opening, full project navigation and return navigation, no-JavaScript
behaviour, image decoding, text fit, real project statuses and motion controls.
Representative phone/tablet screenshots were visually reviewed. No browser
runtime errors, clipped text or document overflow were detected.

Three existing CMS public-settings regression tests passed. The production
Astro build passed in 35.48s; theme, JavaScript syntax and whitespace guards
passed. Browser submissions and analytics were blocked; no CMS records or
emails were created. A history-navigation assertion initially ran before the
Astro page swap completed; waiting for the rendered homepage resolved the test
race, with no application change needed.

Evidence: docs/qa/homepage-mobile-density-2026-09-21.json.
Portable checks: docs/qa/homepage-mobile-density-checks.py. Set DENSITY_BASE
(default http://127.0.0.1:4331) and optionally DENSITY_OUT.
The earlier homepage-services-checks.py records the previous mobile card grid;
use this newer suite for the current mobile arrangement.

Shipping changes are limited to the homepage Services and FeaturedWork
components, shared ServiceStoryContent and WorkCard components,
publicSettings.js and visual-story.css. No CMS content or schema changes.

## Release

Vercel deployment `dpl_7VpbjYnASzsxd3GZUsMdyBhJbtwc` is READY and assigned to
https://quademdigital.com. Deployment URL:
https://quademdigital-pdeunkp19-quademagency-glitchs-projects.vercel.app

The live homepage references this deployment. Production checks passed at
390×844, 768×1024 and 1440×1000, confirming compact mobile sections, all four
loaded project previews with their correct links/statuses, and the full desktop
presentation. Live touch checks opened the first service, switched exclusively
to the last service, loaded its artwork and exposed its action. There were no
browser runtime errors or document overflow. No records, emails, commits or
git pushes were created.
