# Omek storefront cover corrected, 27 September 2026

The portfolio cover still showed Omek's older blue navigation, plain text logo
and colourful-TV hero. It now uses an actual 1600 × 1000 browser screenshot of
https://www.omekgh.com/, showing the current Omek logo, white navigation and
“Big nights. Brilliant pictures.” hero. Essential cookies were selected and
the first carousel slide was selected through its normal control before capture.
The page content was not altered or generated.

The live CMS case study `omek-storefront` (ID 5) now references media 147,
`omek-storefront-current-2026-09-27.webp`. Payload generated responsive WebP and
AVIF versions. The stored original is 74,558 bytes; the largest responsive AVIF
is 37,336 bytes. The previous media record 69 remains available for rollback.
Only the `coverImage` relationship was patched. A fresh read confirmed every
other case-study field except `updatedAt` was unchanged.

This is a CMS content update. The homepage featured-work card, projects listing
and project detail page read the same relationship, so no frontend deployment
is required. The separate service/hero device mockup uses its own asset and
was not changed.

Source, previous cover, before/after records and browser evidence:
`output/omek-storefront-image-2026-09-27/`.
The scoped update script is `cms/scripts/update-omek-storefront-cover.mjs`;
its default mode previews the change and `--apply` writes it.

All six live browser checks passed: homepage, projects listing and Omek case
study at 390px and 1440px, using canonical URLs. Each selected the new image,
loaded successfully, used the updated responsive sources and had no horizontal
overflow. No application runtime errors occurred. The source screenshot and
live desktop/mobile presentations were visually reviewed. Script syntax and
Git whitespace checks passed. No application code or layout changed, so no
production build was needed.
