# Quademdigital — Site Audit Fix Spec

**Project:** Quademdigital (id 10018975) · **Target:** quademdigital.com/
**Crawl:** 2026-06-29 00:15 UTC (Completed) · **Health score:** 82.8 · 93 crawled · 9 broken · 24 redirects
**Stack detected:** Astro (CSS served from `/_astro/…`), `sitemap-0.xml` present.
**Mode:** Spec only — no code changes made. Nothing published.

---

## Root-cause summary

Three of the biggest issues share **one root cause**: internal links are written **without trailing slashes**, but the server 308-redirects every path to its trailing-slash version (Astro default `trailingSlash` behaviour). Fix the link hrefs and you clear *Page has links to redirect* (32), most of *3XX redirect* (24), and *Redirect chain* (1) at once.

A second cluster — *Image broken* (8) + *Page has broken image* (5) — is **one root cause**: service/offer images referenced at `/images/...` return 404 (wrong path or never uploaded).

Priority order below.

---

## TIER 1 — High leverage

### 1. Page has links to redirect (Warning · 32 indexable pages) — VERIFIED
**What's happening:** Internal `<a>` hrefs point to non-slash URLs that 308-redirect. All 55 offending links return 308. The dominant one (32 occurrences — once per page) is the nav link **anchor "Web Design" → `/services`** redirecting to `/services/`. This is a **template (header/nav) fix**.

**Redirect targets receiving internal links (count = inlinks to fix):**
| Count | Bad href (redirects) | Correct href |
|---|---|---|
| 32 | `/services` | `/services/` |
| 2 | `/services/brand-identity` | `/services/brand-identity/` |
| 2 | `/services/seo` | `/services/seo/` |
| 2 | `/services/web-design` | `/services/web-design/` |
| 1 each | `/contact`, `/offers/free-seo-audit`, `/offers/social-media-bonus`, `/offers/web-dev-discount`, `/services/video-production`, `/projects/scaling-user-acquisition`, `/projects/revamping-online-store`, `/projects/next-gen-ecommerce`, `/projects/brand-identity-local-seo`, `/blog/why-your-business-needs-custom-website-2026`, `/blog/how-quaderp-transforms-retail-operations`, `/blog/5-signs-business-needs-website-redesign`, `/blog/how-to-choose-right-digital-agency`, `/blog/future-of-web-dev`, `/blog/mastering-seo-5-strategies-dominate-search`, `/blog/local-seo-strategies`, `/blog/nigerian-business-social-media-marketing` | append trailing `/` |

**Fix:**
- In the **nav/header component** (Astro layout, e.g. `src/components/Header.astro` or `Nav.astro`): change `href="/services"` → `href="/services/"`. This clears the 32-count item across all pages.
- Search the codebase for internal hrefs missing trailing slashes. Grep pattern: `href="/[^"]*[^/]"` (excluding files, anchors `#`, and external `http`).
- **Recommended permanent fix:** set Astro `trailingSlash: 'always'` in `astro.config.mjs` AND make all internal links consistently end in `/`. This prevents the issue recurring on new pages.

### 2. 3XX redirect (Warning · 24 pages) — VERIFIED
**What's happening:** 24 URLs return 3XX. Breakdown:
- **~21 are trailing-slash 308s** (e.g. `/contact` → `/contact/`). These are *expected/healthy* server behaviour — the real fix is #1 (stop linking to the non-slash version). Once no internal link points at them, they stop being flagged as problems. **Do not remove these redirects** — they protect any external inbound links.
- **www / http canonicalisation (keep these):**
  - `http://quademdigital.com/` → `https://quademdigital.com/` (308) ✅ correct
  - `http://www.quademdigital.com/` → `https://www.quademdigital.com/` → `https://quademdigital.com/` (308 → chain) — see #3
  - `https://www.quademdigital.com/` → `https://quademdigital.com/` (307)

**Fix:** No redirect *removal*. Action is entirely #1 (fix the links) + #3 (collapse the www chain). The 307 on `https://www.` → apex should ideally be a **301** (permanent) for SEO clarity, not 307 — confirm with host/CDN config.

### 3. Redirect chain (Notice · 1) — VERIFIED
**Chain:** `http://www.quademdigital.com/` →(308)→ `https://www.quademdigital.com/` →(307)→ `https://quademdigital.com/`
**Fix (server/CDN config):** Collapse to a single hop — `http://www.quademdigital.com/` should 301 **directly** to `https://quademdigital.com/`. Configure one combined rule: any `http://` OR `www.` host → `https://quademdigital.com/<path>` in one 301. Also covers the *HTTP to HTTPS redirect* notice (2).

### 4. Pages to submit to IndexNow (Notice · 32) — VERIFIED (action, not code)
**What's happening:** 32 indexable 200 pages (the full site) are eligible to be pushed to IndexNow for faster crawl/discovery. Not a defect — an opportunity.
**Fix:** Submit these URLs via IndexNow (Bing/Yandex). If on Cloudflare, enable the **Crawler Hints** / IndexNow integration. Otherwise generate an IndexNow key file and POST the URL list. *(Optional — say the word and I can prepare the URL list + submission payload.)*

### 5. Indexable page not in sitemap (Notice · 12) — VERIFIED
**What's happening:** 12 indexable 200 pages are absent from `sitemap-0.xml` — all `/blog/*` and `/projects/*` detail pages:
```
/blog/how-to-choose-right-digital-agency/
/blog/future-of-web-dev/
/blog/nigerian-business-social-media-marketing/
/blog/mastering-seo-5-strategies-dominate-search/
/blog/local-seo-strategies/
/blog/5-signs-business-needs-website-redesign/
/blog/why-your-business-needs-custom-website-2026/
/blog/how-quaderp-transforms-retail-operations/
/projects/scaling-user-acquisition/
/projects/revamping-online-store/
/projects/next-gen-ecommerce/
/projects/brand-identity-local-seo/
```
**Fix:** The Astro sitemap integration is excluding blog/project collections. Check `astro.config.mjs` `@astrojs/sitemap` config (and any `filter`/`serialize` excluding these routes), OR ensure these content-collection pages are statically generated at build so the sitemap picks them up. After rebuild, confirm all 12 appear in `sitemap-0.xml` and resubmit the sitemap in GSC.

---

## TIER 2 — Critical, smaller scope

### 6. Image broken (Critical · 8) + 7. Page has broken image (Critical · 5) — VERIFIED (same root cause)
**What's happening:** 8 image URLs return **404**. They are referenced from 5 pages (services + offers). Same assets, two issue views.

**Broken image assets (404):**
| Image URL | Inlinks |
|---|---|
| `/images/service-web-design.png` | 1 |
| `/images/service-branding.png` | 1 |
| `/images/service-seo.png` | 1 |
| `/images/service-digital-marketing.png` | 1 |
| `/images/service-video.png` | 1 |
| `/images/offers/free_seo_audit_offer.png` | 2 |
| `/images/offers/social_media_bonus_offer.png` | 2 |
| `/images/offers/web_dev_discount_offer.png` | 2 |

**Pages referencing them:**
- `/services/` → 5 service-*.png
- `/offers/` → 3 offer .png
- `/offers/free-seo-audit/`, `/offers/social-media-bonus/`, `/offers/web-dev-discount/` → respective offer .png

**Fix:** Either (a) upload the missing files to `/public/images/...` and `/public/images/offers/...` at the exact paths/case above, or (b) if the files exist under a different name/path, correct the `<img src>` in the service/offer components/pages to match. Note `logo.webp` on the same pages loads fine — so the `/images/` directory resolves; these specific PNGs are simply missing. **Verify exact filename case** (Linux is case-sensitive).

### 8. Orphan page — no incoming internal links (Critical · 3 indexable) — VERIFIED
**Pages (200, indexable, 0 inlinks, 0 redirect-inlinks, but ARE in sitemap):**
- `/case-study-1/` — "Revamping an Online Store for Higher Conversions"
- `/case-study-2/` — "Scaling User Acquisition with Targeted Ads"
- `/case-study-3/` — "Complete Brand Identity & Local SEO"

**Note / likely duplication:** Each `/case-study-N/` has an identical-titled twin under `/projects/…` (e.g. `/projects/revamping-online-store/`) which IS linked. So these are probably **legacy duplicate URLs**.
**Fix — choose one (needs your decision):**
- **(a) If `/case-study-N/` are duplicates of `/projects/…`:** 301-redirect each `/case-study-N/` to its `/projects/…` equivalent and remove from sitemap. (Cleanest — avoids duplicate content.)
- **(b) If they're meant to be live, distinct pages:** add internal links to them from a hub (e.g. the `/projects/` index or relevant service pages) so they're reachable.

Mapping if (a): `/case-study-1/`→`/projects/revamping-online-store/`, `/case-study-2/`→`/projects/scaling-user-acquisition/`, `/case-study-3/`→`/projects/brand-identity-local-seo/`. *(Confirm these pairings before redirecting — based on matching titles.)*

---

## TIER 3 — Quick per-page polish

### 9. Title too long (Warning · 4 indexable) — VERIFIED
Titles exceed ~60 chars (Google truncates). All include " | Quadem Digital" suffix.
| URL | Current title (len) | Suggested (≤60, keep brand) |
|---|---|---|
| `/blog/nigerian-business-social-media-marketing/` | "Why Every Nigerian Business Needs Social Media Marketing in 2026 \| Quadem Digital" (81) | "Why Nigerian Businesses Need Social Media Marketing \| Quadem Digital" — or drop year |
| `/blog/how-to-choose-right-digital-agency/` | "How to Choose the Right Digital Agency for Your Business \| Quadem Digital" (73) | "How to Choose the Right Digital Agency \| Quadem Digital" |
| `/blog/mastering-seo-5-strategies-dominate-search/` | "Mastering SEO: 5 Strategies to Dominate Search Rankings \| Quadem Digital" (72) | "Mastering SEO: 5 Strategies to Dominate Search \| Quadem Digital" |
| `/blog/5-signs-business-needs-website-redesign/` | "5 Signs Your Business Needs a Website Redesign in 2026 \| Quadem Digital" (71) | "5 Signs Your Business Needs a Website Redesign \| Quadem Digital" |
**Fix:** Edit each post's frontmatter `title` (or SEO title field). These are suggestions — adjust wording to taste; do not fabricate claims.

### 10. CSS broken (Warning · 1) + 11. Page has broken CSS (Warning · 1) — VERIFIED (same root cause)
**What's happening:** `https://quademdigital.com/_astro/web-design.NxRZCDPF.css` returns **404**, referenced by `/services/web-design/`.
**Cause:** This is a **stale Astro build-hash CSS file** — the page HTML references an old hashed filename (`web-design.NxRZCDPF.css`) that no longer exists after a rebuild. Indicates the deployed HTML and `/_astro/` assets are **out of sync** (partial deploy / stale cache).
**Fix:** Do a clean rebuild and **full redeploy** of `dist/` (HTML + `_astro/` together) so hashes match; purge CDN cache. Verify `/services/web-design/` references a CSS file that returns 200. `BaseLayout.Bw60rAiN.css` on the same page loads fine — only `web-design.*.css` is stale.

### 12. Structured data — Google rich results validation error (Notice · 1) — VERIFIED
**Page:** `/` (homepage) · Schema type: **LocalBusiness**
**What's happening:** The homepage `LocalBusiness` JSON-LD has a field Google flags as invalid/missing for rich results.
**Fix:** Run the homepage through [Google Rich Results Test](https://search.google.com/test/rich-results) to see the exact field. `LocalBusiness` commonly needs valid `address` (PostalAddress), `name`, and usually `telephone`/`openingHours`/`image`. Correct or complete the flagged property in the JSON-LD. **Do not invent values** — use the business's real NAP details. *(I can review the live JSON-LD and pinpoint the exact field if you want.)*

---

## INVESTIGATE — present data, no auto-fix

### 13. Redirected page has no incoming internal links (Warning · 18)
These are the trailing-slash non-canonical URLs (e.g. `/services`) that only exist as redirect sources. Once Tier 1 #1 repoints the links, this is expected/benign. **No action** beyond #1. Removing the redirects would be harmful (breaks external inbound links).

### 14. Page has only one dofollow incoming internal link (Notice · 2)
Two indexable pages are thinly linked. Low priority. Optionally add 1–2 contextual internal links from related content to strengthen them. (Pull the 2 URLs on request.)

### 15. HTTP to HTTPS redirect (Notice · 2)
Expected, healthy behaviour — covered by consolidating into the single 301 rule in #3. No separate action.

### 16. Slow page (Warning · 1) — VERIFIED
**Page:** `/` (homepage) · **TTFB 1219ms**, total load 1224ms, size 15.5KB.
**Diagnosis:** The page is tiny (15KB) and load≈TTFB, so the delay is **server response time (TTFB), not page weight**. Likely slow origin / cold start / no edge caching.
**Fix (investigate with host):** Enable full-page caching at the CDN for the static homepage, check origin server/host response time, ensure the Astro static output is served as cached static HTML (not re-rendered per request). Target TTFB < 200ms for a static page.

---

## Re-check checklist (after fixes deployed)

Pages to open in a browser and verify:
1. **`/services/`** — all 5 service images load (200, not 404).
2. **`/offers/`, `/offers/free-seo-audit/`, `/offers/social-media-bonus/`, `/offers/web-dev-discount/`** — offer images load.
3. **`/services/web-design/`** — CSS loads, page styled correctly (no stale `_astro` 404).
4. **Any page header/nav** — "Web Design" nav link goes straight to `/services/` (200, no redirect). Check DevTools → Network for 308s on internal links.
5. **`/case-study-1/`, `/case-study-2/`, `/case-study-3/`** — confirm your decision (301 to `/projects/…` OR now linked from a hub).
6. **`http://www.quademdigital.com/`** — confirm single 301 hop to `https://quademdigital.com/` (no chain).
7. **`/sitemap-0.xml`** — confirm the 12 blog/project URLs now appear.
8. **4 long-title blog posts** — confirm shortened titles render in `<head>`.
9. **`/` Rich Results Test** — LocalBusiness passes.

**Then trigger a re-crawl in Ahrefs** (Site Audit → Quademdigital → Re-crawl / Run crawl) to confirm the issues clear and the health score rises.

---

*Generated from Ahrefs Site Audit crawl 2026-06-29. All values pulled from crawl data — none fabricated. No code changed, nothing published.*
