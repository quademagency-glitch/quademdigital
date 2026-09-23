# Cinematic homepage hero, 20 September 2026

The user rejected the previous homepage image and chose a cinematic studio
image based on Quadem’s work. A dedicated homepage image now replaces the
previous shared device mockup. Omek’s current frontend occupies the main
screen, QuajoSpeaks is on the foreground laptop, and Quadem’s existing identity
artwork appears on stationery beside a video camera. Warm side lighting,
wood texture and deep navy copy space give the scene a stronger focal point.

This is a conceptual AI-assisted studio scene, not a photograph of actual Quadem
premises. The visible caption retains Omek’s in-progress and QuajoSpeaks’ internal
project classifications. Other service images and project records retain their
previous assets.

## Asset and integration

Generated once using the built-in image_gen tool from the saved current Omek,
QuajoSpeaks and Quadem identity references. No external generation API was used.

- Source: `output/imagegen/quadem-hero/cinematic-studio-v1.png`.
- Exact prompt and inputs: `docs/cinematic-home-hero-prompt-2026-09-20.json`.
- Provenance: `docs/work-based-image-assets-2026-09-20.json`, home-studio entry.
- Responsive WebPs: `public/images/work-based/home-cinematic-studio-v1-480.webp`,
  `public/images/work-based/home-cinematic-studio-v1-640.webp`,
  `public/images/work-based/home-cinematic-studio-v1-960.webp`,
  `public/images/work-based/home-cinematic-studio-v1-1536.webp`.
- Largest derivative: 144,494 bytes. The original generation remains preserved.
- Shared manifest: `src/lib/workImageManifest.json`, new home-studio entry.
- Homepage consumer: `src/pages/index.astro`.
- Framing: `src/styles/visual-story.css`.

A dedicated clipped image wrapper preserves the existing entrance zoom, pointer
parallax and scroll motion. Desktop uses a lighter scrim and a higher image focal
point. At tablet widths the copy is narrower to avoid the main screen. Below
800px, the photograph and caption have their own flow after the copy, so the
image cannot obscure body text. No copy, booking destination or pricing rule was
changed.

## Verification

28 focused browser assertions passed at 320, 390, 768, 1024, 1440 and 2560px:
loaded versioned artwork, no horizontal overflow, one H1, eager/high-priority
image loading, caption/project status, CTA targets, mobile separation, actual
work-anchor navigation, automatic Ghana pricing and absence of the retired
country box. Pointer tilt, native scroll movement and Pause motion passed;
reduced-motion and no-JavaScript states remain readable. No browser runtime
errors. Desktop, tablet and complete mobile screenshots reviewed visually.

Production build passed in 6m 8s, including the existing market prebuild guard.
The existing unused docx import warning remains. Theme guard and focused
whitespace checks passed. No real form submissions,
CMS writes, push or deployment occurred.

Harness: `docs/qa/cinematic-home-hero-checks.py`.
Results: `docs/qa/cinematic-home-hero-2026-09-20.json`.
Screenshots: `docs/qa/cinematic-home-hero-desktop.png`,
`docs/qa/cinematic-home-hero-large-desktop.png`,
`docs/qa/cinematic-home-hero-tablet.png`,
`docs/qa/cinematic-home-hero-mobile.png`.

Preview: http://127.0.0.1:4322/?preview=cinematic-studio
