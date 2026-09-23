# Reference rebuild asset manifest

## Current image restoration, 19 September 2026

The user's latest correction requires the original site imagery. Homepage hero images now come from `homepage.heroServices[*].rawMedia` (falling back to its assigned mockup media), and service images come from each CMS service record's featured/raw assignment. The original Reels image now fills the raised hero and the photographic footer. Brands artwork fills the display lettering and the values background. Websites, Brands, Campaigns and Reels also remain in the gallery after the cream introduction; the five service images include digital marketing. Process panels reuse the original hero artwork decoratively; the closing invitation and navigation retain the actual logo. Expanded service rows reuse their assigned service artwork as a backdrop. Shared PageHero no longer hides assigned media on the page variant. The Services overview now presents its original image in the reference triptych, and Contact places the founder portrait beside the existing wizard. The sculpture recommendation below is historical and superseded. Exact filenames and validation: `docs/original-images-motion-2026-09-19.md`.

Inspected 17 September 2026 for the public-site rebuild using Web-De's composition and Quadem blue. Every recommended image is already in Quadem's repository or its public CMS. No reference-site artwork, logos, customer avatars or proof claims are reused.

## Primary five

| Use | Exact source | Classification and alt text | Crop and presentation |
| --- | --- | --- | --- |
| Homepage sculpture | `/images/quadem-prop-2.webp` (source: `public/images/quadem-prop-2.webp`; identical source asset at `src/images/quadem-prop-2.webp`) | Existing Quadem decorative artwork. Use `alt=""` because it does not add factual content. If standalone in an asset gallery: “Sculptural blue glass loops against a black background.” | 1024 × 1024, 50,864 bytes. Keep the complete form using `object-fit: contain`, centred within a square or near-square right hero column. The black background works with the reference's near-black surface; avoid a visible rectangular edge against a lighter panel. Prefer this rounded form to the angular prop-1. |
| First client project | `https://cms.quademdigital.com/api/media/file/cover-omek-storefront.webp` | **Client work, build in progress.** Alt: “Omek Gigs Appliance storefront homepage.” Link to `/projects/omek-storefront/`. | 1600 × 1000. Preserve the full 8:5 screenshot in a large card, ideally 2-column desktop and full-width mobile. Do not crop off the shop name or product. A light screen surround is appropriate; a browser-frame overlay is unnecessary. |
| Second client project | `https://cms.quademdigital.com/api/media/file/cover-san-collection.webp` | **Client work, build in progress.** Alt: “SAN Collection storefront showing a black handbag.” Link to `/projects/san-collection/`. | 1600 × 1000. Preserve the full 8:5 screenshot. A subtle border separates the screenshot's dark edge from the page. Keep the gold/black project colours as image content rather than recolouring the client's work blue. |
| Brand identity service or internal work | `https://cms.quademdigital.com/api/media/file/qd-identity-cover.webp` | **Internal work.** Alt: “Quadem Digital business cards, brochure, letterhead and colour palette.” Link to `/projects/quadem-brand-identity/`. | 1600 × 1063. Use native ratio or 3:2 with negligible crop, centred. All six palette chips and the three stationery groups should remain visible. Suitable for a branding service card as well as the internal project. |
| Founder and contact trust | `https://cms.quademdigital.com/api/media/file/founder-portrait.webp` | **Founder portrait supplied through Quadem's CMS.** Alt: “Ernest Avorwlanu, founder of Quadem Digital.” | 857 × 1200. For a major portrait, keep the native 5:7 ratio. For a small FAQ/avatar crop, use `object-position: 42% 20%` and verify the face is fully visible. Do not substitute `founder-mock.webp` or `avatar-mock.webp`. |

## Supporting assets

- `/images/quadem-prop-3.webp`: 1024 × 1024, 46,038 bytes, a simpler silver and blue ribbon. Reserve for one secondary CTA illustration if needed; repeating sculptures in every section would compete with the actual work. Decorative empty alt.
- `https://cms.quademdigital.com/api/media/file/hero-websites-stack.webp`: 1200 × 1500 collage of Quajo Speaks, SAN Collection, QuadERP and Omek. Useful for a website service card that needs a portrait crop. Alt: “Selected websites built by Quadem Digital, including client and internal projects.” Do not label the whole collage as client work. Use `contain`; the four pages are already intentionally stacked.
- `/images/logo-104.webp`: 2,678-byte small existing mark suited to the navigation. The 1600px `qd-logo.webp` includes wide empty margins and embedded full wordmark, so it is inefficient for a small navigation icon.
- The CMS also provides generated sizes at 480, 800 and 1200px plus AVIF for project covers. Use existing media helpers and `sizes`/`srcset` rather than downloading every original at small display sizes. Original aspect ratios should be retained.

## Published project classification

The public `caseStudies` API currently marks all six records published. Its classification is the authority; appearances and project names alone are not evidence of client work.

| Slug | Public CMS `projectType` | Required presentation |
| --- | --- | --- |
| `omek-storefront` | `client` | Client project; build in progress |
| `san-collection` | `client` | Client project; build in progress |
| `quadem-brand-identity` | `self` | Internal brand identity |
| `quadbrand` | `self` | Internal product; beta |
| `quajo-speaks` | `self` | Internal project |
| `quaderp-landing` | `self` | Internal product |

Do not turn the project names into an unqualified “Trusted by” customer logo strip. Do not present product counts, performance scores or before/after metrics as revenue or conversion results.

## Source and usage context

The local sculpture and logo assets belong to the existing user-provided Quadem workspace. The project covers and portrait are already published through Quadem's CMS for this website, with corresponding project records or founder fields. Reusing them in the requested rebuild stays within their existing website context. No independent copyright or client-release audit was performed, and the CMS media `credit` fields are empty. No stock licence, new testimonial, client endorsement or ownership claim should be invented.

Generic images such as `service-web-design.webp` depict a styled workstation, not a verified client result. Existing mock-named portraits and case-study placeholders are excluded from the recommended set. The real portfolio screenshots give this redesign stronger evidence than generic workstations.

## Inspection records

Public API snapshots saved for implementation reference:

- `/tmp/quadem-rebuild-case-studies.json`
- `/tmp/quadem-rebuild-homepage.json`
- `/tmp/quadem-rebuild-about.json`

Viewed local copies of CMS assets:

- `/tmp/quadem-rebuild-omek.webp`
- `/tmp/quadem-rebuild-san.webp`
- `/tmp/quadem-rebuild-identity.webp`
- `/tmp/quadem-rebuild-founder.webp`
- `/tmp/quadem-rebuild-web-stack.webp`

These temporary files are inspection aids. Production should reference the existing local public asset or CMS media helper, not `/tmp`.
