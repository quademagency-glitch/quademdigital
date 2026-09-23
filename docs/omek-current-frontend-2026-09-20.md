# Current Omek frontend in the shared mockup

The user requested the updated omekgh.com frontend in place of the older laptop
screen. The live site at https://www.omekgh.com/ was visited and captured at
1600x1000 with optional cookies declined. The current logo, white navigation and
living-room TV hero now replace the old colourful-TV design. QuajoSpeaks remains
on the rear monitor. The existing project classifications and captions remain.

The built-in image_gen tool edited the prior presentation. The exact prompt,
input paths and source URL are in [the edit record](omek-current-frontend-prompt-2026-09-20.json).
The saved image is [web-presentation-current-omek.png](../output/imagegen/quadem-work-based/web-presentation-current-omek.png).
The fresh source capture is [omek-live-2026-09-20.png](../output/work-based-sources/omek-live-2026-09-20.png).

Responsive 480/640/960/1536px WebPs live under `public/images/work-based/`, with
`web-presentation-current-omek` filenames; the largest variant is 101 KB. The
shared manifest applies the replacement to the homepage hero, web service card,
Services directory/introduction and Web Design hero. Provenance and previous
versions remain in `docs/work-based-image-assets-2026-09-20.json`.

18 focused browser checks passed across the three consuming pages at 390, 1440
and 2560px: correct loaded image, preserved captions, card/directory assignments,
no horizontal overflow and no runtime errors. The generated image and the final
1440px homepage were also visually inspected. Whitespace checks passed. This
asset-only update received focused browser/manifest verification rather than a
repeat of the full production build. No layout or motion code changed, and no
CMS write, real submission or deployment occurred.

Results: `docs/qa/omek-current-2026-09-20.json`.
Screenshots: `docs/qa/omek-current-home-desktop.png` and
`docs/qa/omek-current-home-mobile.png`.

Preview: http://127.0.0.1:4322/?preview=omek-current
