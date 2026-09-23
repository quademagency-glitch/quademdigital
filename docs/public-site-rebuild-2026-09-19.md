# Quadem public website rebuild

The public site now follows the user's supplied [Web-De reference](https://web-de.framer.website/) with Quadem blue. Scope and colour were explicitly confirmed: the whole public website, keeping Quadem blue.

## What changed

- Shared near-black and light theme tokens, self-hosted Inter, rounded image panels and compact capsule navigation.
- Homepage built around a clear website offer, original blue Quadem sculpture, real project preview, four service introductions, process, founder, regional plans, FAQ and contact paths.
- Shared page openings across listing and service pages. The portfolio labels internal and in-progress work; it no longer invents fallback projects when the CMS is unavailable.
- Founder copy explains how the engagement works. The SEO page no longer carries unsourced industry statistics.
- Service, project, article, offer, calculator, contact and international pages use the shared visual system. The international funnel retains its existing market restrictions.
- Native FAQ disclosures, keyboard-accessible mobile navigation and focus return, explicit filter selection, less headline tracking, useful text-led blog cards and adequate mobile calculator spacing.
- Navigation is recreated on each Astro route change, keeping its active state current. The capsule uses an opaque surface without a transformed or blurred fixed layer.

## Content ownership

Prices, published projects, FAQs, process steps, service detail content and contact settings still come from Payload CMS. Newly written headline and introductory copy lives in the Astro templates. No CMS schema, payment or account logic changed. The earlier audit's CMS mutation script has not been applied; its prepared copy changes are separate from this frontend rebuild.

Original Quadem assets and their classifications are recorded in [the asset manifest](rebuild-asset-manifest.md). The reference's client counts, ratings and logos have not been reused.

## Validation

The complete route sweep covered 19 public routes at 1440px and 390px: 38 successful renders, one main H1 per page, no horizontal overflow, no broken image URLs and no JavaScript errors. Routes include the actual digital-marketing-social-media slug, all seven service pages, a project detail, the international page and both legal pages.

Browser interaction checks cover both pricing markets, mobile menu and keyboard behaviour, filters, native FAQs, theme persistence, the enquiry wizard's required fields, partial lead capture, simulated failure and retry, consent, success reset, service preselection, booking destination and calculator selection. Newsletter confirmation was checked separately. All lead and newsletter requests in these tests were intercepted; no real enquiries or emails were sent.

The nine billing and lead-tracking regression tests pass. The ten repository release guards passed, including price consistency, market rules, copy, CSP, booking links, migrations, theme literals, blog routes and international exclusions. The design detector returned no findings. The final production build passed on 19 September at 12:40 UTC, with the direction contract retained in the generated server bundle. The build still reports the existing unused docx imports in the client-won API route; this rebuild does not claim a clean repository-wide TypeScript check.

Machine-readable evidence: [browser results](qa/public-site-2026-09-19.json).

## Final design review

Independent reviewer disposition: **ship**.

| Finding | Status |
|---|---|
| Desktop navigation | Resolved |
| Calculator hero clearance | Resolved |
| Duplicate blog filters | Resolved |
| Empty blog media placeholders | Resolved |
| Excessive tracking | Resolved |
| Redundant preheadings | Resolved |

The last apparent navigation failure was an image-display artifact. Identical screenshot files were presented differently by the image viewer. Enlarged crops of the same pixels and a byte-for-byte comparison confirmed the complete navigation; the reviewer withdrew that finding. No additional UI change was needed after the final production build.

The reusable design system is recorded in root `DESIGN.md` and `.impeccable/design.json`.

## Publication

This is a local, reviewable rebuild. No production deployment, CMS write, commit or push was performed. Start a preview with `npm run dev -- --host 127.0.0.1 --port 4322`; the active preview is http://127.0.0.1:4322/.
