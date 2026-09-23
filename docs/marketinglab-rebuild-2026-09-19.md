# MarketingLab rebuild, 19 September 2026

## Scope and correction

The user confirmed the whole public website and Quadem blue. They then supplied
https://marketinglab.framer.ai/ and rejected the earlier implementation because
it kept the Web-De layout and added only a limited motion layer. MarketingLab
is now the primary visual and behavioural reference. The earlier Web-De and
behaviour-extension reports are historical.

## Built result

- Full-screen original blue motion photography, wide navigation, self-hosted
  Urbanist and a monumental image-filled WEB DESIGN / italic AGENCY opening.
- A dark process section with four distinct photographic cards that rise into
  a pinned row on sufficiently large viewports.
- Alternating values panels over Quadem's glass artwork, with a central progress
  line driven by native scrolling.
- Warm cream services, work, pricing, FAQ and editorial sections. Expanded service
  rows include a large image, capability blocks and a separate project action.
- Real project panels overlap as the visitor scrolls. Listing copy is an excerpt;
  the full CMS description remains on the project page.
- Services uses the reference's offset introductory statement and three-panel
  composition. About uses an offset introduction and a framed facts composition,
  retaining Ernest's real portrait and full introduction below.
- Public page openings, navigation, type, buttons, forms and footer share the new
  system. The international funnel retains its market and contact restrictions.
- A transparent edit of Quadem's blue glass sculpture anchors the open footer CTA.

Primary implementation: `src/styles/marketinglab.css`, `src/pages/index.astro`,
`src/components/home/ValuesSection.astro`, the shared layouts and components.
The existing studio stylesheet remains a compatibility layer for detailed pages.
`src/scripts/studio-motion.js` handles disclosure continuity, native scroll
states, hover/click navigation, CTA labels and preference changes.

## Facts and adaptations

Quadem's blue replaces the reference's orange. Original decorative photographs
replace its stock imagery. Location and founder facts replace unsupported
metrics; Ernest's actual portrait and published work replace invented reviews.
The reference's unrelated sample FAQ answers are not copied. No new client count,
revenue result or testimonial is asserted. The hero names Quadem's website offer.

The old theme switch is removed: cream and dark are now deliberate section
palettes, stable even when an old light-mode preference is stored. Mobile,
reduced-motion and no-JavaScript visitors retain readable normal content flow.
No scrolling is hijacked. Timings are implemented in Astro/CSS/WAAPI; this is an
independent build using the reference, not a Framer source export.

Asset sources, exact generation/edit prompts and classifications are recorded in
`docs/marketinglab-assets.md`. Urbanist is self-hosted with its OFL licence under
`public/fonts/urbanist/`.

## Verification and release

See `docs/qa/marketinglab-rebuild-2026-09-19.json` for route, functional, motion,
review and build evidence. Form and newsletter requests were intercepted during
browser tests. No real enquiries or emails were submitted.

The independent review returned **ship** after one correction batch:

| Finding | Final status |
| --- | --- |
| Services page composition | Resolved |
| About page composition | Resolved |
| Expanded service rows | Resolved |

The review found no material regressions in the final screenshots. The screenshot
verdict does not establish identical timing; browser checks separately verify
pinning, disclosures, keyboard access and motion preference changes.

Local preview: http://127.0.0.1:4322/. Use explicit IPv4; an unrelated old app
serves a different site on IPv6 port 4322. This work has not been deployed,
committed, pushed or written to the CMS. Production publication is a separate
step. The unrelated `.claude/settings.json` changes remain untouched.
