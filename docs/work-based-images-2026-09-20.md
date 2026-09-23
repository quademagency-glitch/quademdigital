# Work-based service images, 20 September 2026

The user identified missing AI Automation and Fieldwork imagery and asked for
realistic visuals drawn from Quadem's own work. The preceding four-image family
left these services out and used generic service illustrations. This pass replaces
that family with seven complete service stories and source-linked imagery.

## What changed

- AI Automation has a realistic phone demo based on Quadem's implemented WhatsApp
  intake. It is labelled as an internal workflow with sample messages. The actual
  implementation runs on a Meta test number; the image does not imply a client
  deployment or expose a customer conversation.
- Fieldwork now has a dedicated homepage visual and a directory image. Both use
  the original redacted delivered-record exhibit. The link opens the existing
  full-resolution reader. The original service hero, verbatim page copy, CTA and
  three evidence exhibits are preserved.
- Web design and the homepage hero use an AI-assisted device presentation based
  on the existing Omek and SAN’S BAG website designs. In-progress labels and links
  to the project library remain visible.
- Branding uses the actual Quadem identity presentation. Search uses the existing
  published research chart, keeping its source, date range and distinction from
  client results. Video and marketing use frames from existing portfolio films.
  Those frames show creative work, not documentary photography.
- All seven services have visual cards with a customer need, deliverables and
  destination. Fieldwork spans the last desktop row; cards stack on phones.
  Native proportions are preserved for vertical video and documentary evidence.
- Shared source captions appear on service cards, directory panels and relevant
  heroes. AI image links land on the service explanation; Fieldwork links to the
  evidence reader. A stronger hero scrim keeps the copy readable over the devices.

## Assets and provenance

Nine published source assets have responsive WebP derivatives in
`public/images/work-based/`, with largest variants between 31 and 173 KB. Actual
sizes and width descriptors are stored in `src/lib/workImageManifest.json`.
Prompts, source URLs, frame timestamps, hashes and factual qualifications are
recorded in `docs/work-based-image-prompts-2026-09-20.json` and
`docs/work-based-image-assets-2026-09-20.json`. Original generation results live in
`output/imagegen/quadem-work-based/`; inspected source copies live in
`output/work-based-sources/`.

Three images were generated. Two are used. The generated Fieldwork staging is
retained for review but not published: the original document avoids AI-rendered
text in factual evidence. Original client screenshots remain in the project
library. Existing video opening posters did not match their CMS alt descriptions,
so actual frames were inspected and described by what they show. No CMS data was
changed. The previous generic files remain as historical assets and have no
remaining public-template consumers.

## Verification

107 unique browser assertions passed (108 recorded, including one repeated check
when resuming the harness). Coverage: 16 public routes at 390 and 2560px; targeted
320, 768, 1440 and 2560px homepage checks; all seven image cards, both previously
missing directory images, source qualifications, full-resolution Fieldwork dialog,
Escape, AI explanation anchor, existing project/founder evidence, Ghana currency,
hero/card scroll transforms, explicit full motion overriding OS reduction, pause,
and no-JavaScript rendering. No browser runtime errors were observed. Analytics
and all non-GET/HEAD requests were blocked; no real forms were submitted.

One test-harness assumption required correction: its image decoder expected a
single image per card, while the new video cards contain two source frames. The
remaining checks resumed after fixing that selector. No application defect was
involved. No physical-device frame-rate measurement was performed.

Production build passed in 27.70s. Theme and whitespace checks passed; three
existing public-settings helper tests passed. The pre-existing unused docx-import
warning in `src/pages/api/client-won.ts` remains. There were no CMS writes, pushes,
deployments or publications.

Preview: http://127.0.0.1:4322/?preview=work-based#services
AI: http://127.0.0.1:4322/services/ai-automation/
Fieldwork: http://127.0.0.1:4322/services/fieldwork/

Verification source: `docs/qa/work-based-images-checks.py`.
Results: `docs/qa/work-based-images-2026-09-20.json`.
Screenshots: `docs/qa/work-based-home-desktop.png`,
`docs/qa/work-based-home-large-desktop.png`, `docs/qa/work-based-home-mobile.png`,
`docs/qa/work-based-automation-card.png`, `docs/qa/work-based-fieldwork-card.png`
and `docs/qa/work-based-automation-hero.png`.

## Follow-up: QuajoSpeaks replaces SAN’S BAG

At the user's request, the current web mockup now shows QuajoSpeaks on the rear
monitor, using a fresh capture of https://quajospeaks.com/. Omek remains on the
laptop. The built-in image generator edited the existing composition. The
updated image is saved at `output/imagegen/quadem-work-based/web-presentation-quajo.png`
and served as 480/640/960/1536px WebPs named `web-presentation-quajo` under
`public/images/work-based/`. The largest file is 102 KB. The shared manifest
updates the homepage hero, service card, service directory and Web Design hero.
Captions distinguish Omek's in-progress client work from QuajoSpeaks' internal
project. Original SAN portfolio entries remain available; only the selected
mockup is replaced. Earlier screenshots and report text above record the prior
version.

Exact prompt and reference: `docs/quajo-website-swap-prompt-2026-09-20.json`.
The provenance manifest retains the previous version. Eighteen focused browser
checks passed across the three consuming pages at 390/1440/2560px, including
loaded versioned images, captions, directory/card use and absence of overflow
and runtime errors. Evidence: `docs/qa/quajo-swap-2026-09-20.json`,
`docs/qa/quajo-swap-home-desktop.png`, `docs/qa/quajo-swap-home-mobile.png`.
No CMS write, form submission or deployment occurred.

The follow-up production build passed in 3m 23s; whitespace checks passed.
The existing unused docx-import warning is unchanged.
