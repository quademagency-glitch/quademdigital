# Quademdigital — Site Audit Fix Spec

**Project:** Quademdigital (`quademdigital.com/`, project_id 10018975)
**Crawl audited:** 2026-06-29 23:40 UTC · Health Score **100/100** · 68 pages · 0 broken · 0 critical
**Mode:** Fix spec (no source access) — hand to your developer. Verified against the live site 2026-06-30.

> Overall the site is healthy. Everything below is warning/notice level. The single highest-value item is **internal linking**; the redirect items mostly trace back to **one trailing-slash inconsistency** plus a **www/http redirect chain** that are quick server-side fixes.

---

## 1. Internal linking — "only one dofollow incoming internal link" (16 indexable pages) — PRIORITY

**What Ahrefs found:** 16 indexable, HTTP-200 pages each receive only ONE dofollow internal link — from their section index (hub) page. Verified: each child is linked solely from its parent listing.

| Child page (gets 1 inlink) | Only inbound link from |
|---|---|
| /blog/how-to-choose-right-digital-agency/ | /blog/ |
| /blog/future-of-web-dev/ | /blog/ |
| /blog/nigerian-business-social-media-marketing/ | /blog/ |
| /blog/how-quaderp-transforms-retail-operations/ | /blog/ |
| /blog/mastering-seo-5-strategies-dominate-search/ | /blog/ |
| /blog/local-seo-strategies/ | /blog/ |
| /blog/5-signs-business-needs-website-redesign/ | /blog/ |
| /blog/why-your-business-needs-custom-website-2026/ | /blog/ |
| /projects/scaling-user-acquisition/ | /projects/ |
| /projects/revamping-online-store/ | /projects/ |
| /projects/next-gen-ecommerce/ | /projects/ |
| /projects/brand-identity-local-seo/ | /projects/ |
| /offers/free-seo-audit/ | /offers/ |
| /offers/social-media-bonus/ | /offers/ |
| /offers/web-dev-discount/ | /offers/ |
| /calculator/ | /services/ |

**Why it matters:** internal links pass authority and tell Google a page's relative importance. One link = thin signal. These are all indexable pages you presumably want ranking.

**Fix (template + per-page, your editorial call — no fabricated links):**
- **Blog template — add "Related articles":** at the bottom of each blog post, add a 3-item "Related Articles" block linking to other posts in the same/related category. This alone lifts every blog child from 1 → ~4 inlinks. Use real, topically-relevant matches (e.g. the two SEO posts ↔ each other; web-dev ↔ custom-website ↔ redesign).
- **Service pages → relevant case studies:** from each `/services/*` page, link to the matching `/projects/*` case study (e.g. SEO service → brand-identity-local-seo project; web-design → next-gen-ecommerce or revamping-online-store). And link service pages to the matching `/offers/*` where relevant (SEO service → free-seo-audit; web-dev → web-dev-discount).
- **Body-copy contextual links:** where a blog post mentions a service ("our SEO process", "custom website"), link that phrase to the relevant `/services/*` page.
- **Footer:** consider a slim footer block linking the 3 `/offers/*` pages site-wide (gives each offer a site-wide inlink).
- **Target:** every page ≥ 3 dofollow internal links. Do NOT mass-add identical link blocks just to hit a number — keep them contextual.

---

## 2. Redirect items (root cause: trailing slash + www/http chain)

### 2a. "Page has links to redirect" (1 indexable page) + part of "3XX redirect"
**Found & verified live:** the homepage `/` "Get Started" CTA links to **`/contact`** (no trailing slash), which 308-redirects to **`/contact/`**. The homepage currently contains BOTH `href="/contact"` and `href="/contact/"`.

**Fix (per-link, trivial):** change the CTA `href` from `/contact` → `/contact/` so it points at the final 200 URL directly. Then grep the whole codebase/templates for `"/contact"` (no trailing slash) and `href="/contact"` and normalise all to `/contact/`. No redirect, no lost link equity.

### 2b. "Redirect chain" (1) + the www/http rows in "3XX redirect"
**Found & verified live** — `http://www.quademdigital.com/` currently takes **two hops**:
```
http://www.quademdigital.com/  →(308)  https://www.quademdigital.com/  →(307)  https://quademdigital.com/  (200)
```
Also `https://www.quademdigital.com/` → 307 → `https://quademdigital.com/` (the 307 should be a permanent 301/308).

**Fix (server/CDN config — one rule):** collapse host+protocol canonicalisation into a SINGLE permanent hop. Any of `http://`, `https://`, `www.` should 301/308 straight to `https://quademdigital.com/<path>` in one step. On most hosts this is one redirect rule ordered before the trailing-slash rule. Also change the `https://www → non-www` redirect from **307 (temporary) to 301/308 (permanent)** so it passes equity and Ahrefs stops flagging it.

> Note: the bare `http://` and `www.` entries themselves are EXPECTED canonicalisation, not defects — the only real problems are (i) the extra hop and (ii) the 307 being temporary instead of permanent.

---

## 3. HTTP to HTTPS redirect (2) — NO FIX NEEDED
`http://www.quademdigital.com/` and `http://quademdigital.com/` correctly redirect to HTTPS. This is correct, expected behaviour — it's a notice, not a defect. Leave as-is (the only tweak is folding them into the single-hop rule in 2b).

---

## 4. Page in multiple sitemaps (1) — minor config
**Found:** homepage flagged as appearing in more than one sitemap. Live check: only `sitemap.xml` exists (no sitemap_index). The homepage is listed as `<loc>https://quademdigital.com</loc>` (**no trailing slash**) while every other URL uses a trailing slash, and the canonical home is `https://quademdigital.com/`.

**Fix (config):**
- Make the homepage `<loc>` consistent: `https://quademdigital.com/` (with trailing slash) to match canonical and the rest of the sitemap.
- Confirm there's no second/stale sitemap still being served or previously submitted in Google Search Console / Ahrefs that also lists the homepage; if one exists, remove the duplicate so each URL appears in exactly one sitemap.

---

## 5. Slow page (1) — INVESTIGATE ONLY
**Page:** `/services/video-production/` (HTTP 200, non-indexable per crawl flag). Single page flagged for load time. No code change prescribed without performance data. Suggested checks: page weight / unoptimised hero video or images, render-blocking assets, server response time. Treat as monitoring — revisit if it recurs or the page becomes important.

---

## 6. Pages to submit to IndexNow (29) — not a code defect
These 29 indexable 200 pages haven't been pushed via IndexNow (faster discovery for Bing/Yandex). This is an action, not a source fix.

**Options:**
- Submit via your CMS/host's IndexNow integration (many have a one-click plugin), OR
- POST the URL list to the IndexNow API with your site key. Full list of 29 URLs is in the audit (all under `https://quademdigital.com/`, e.g. `/`, `/about/`, `/services/`, `/services/seo/`, `/services/web-design/`, `/services/brand-identity/`, `/services/video-production/`, `/projects/` + 4 case studies, `/offers/` + 3 offers, `/blog/` + 8 posts, `/contact/`, `/calculator/`, `/privacy-policy/`, `/terms-of-service/`).
- I can generate the ready-to-send IndexNow payload + key-file instructions if you want — just ask.

---

## Out of scope (per your instructions)
Untouched: the ~165 issue types with 0 affected pages, and anything not listed above.

## After fixes — re-check + re-crawl
See chat message for the page list to spot-check in a browser and the re-crawl reminder.
