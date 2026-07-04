# Quademdigital.com — Site Audit Fix Spec

**Project:** Quademdigital (id 10018975) · **Target:** quademdigital.com/
**Crawl:** 2026-06-30 11:56 UTC (fresh) · **Health score:** 79/100 · **Pages crawled:** 48
**Platform detected:** Astro (static + on-demand image endpoint `/_image/`)
**Mode:** Fix spec (no direct source access) — hand to developer to apply.

All findings below were verified against the live site on 2026-06-30, not just read from the crawl.

---

## Root-cause summary (read this first)

Most of the 13 active issues collapse into **3 underlying problems**:

1. **Astro image endpoint returns HTTP 500** → causes *Image broken* (6), *Page has broken image* (3), and *More than three parameters in URL* (6). One fix clears all three.
2. **Four `/projects/<case-study>/` pages 302-redirect to `/projects`** → causes *302 redirect* (4), *Redirect chain* (4 of 5), and *Page has links to redirect* (5). One fix clears all three.
3. **Internal linking / sitemap hygiene** → orphan page, single-inlink page, duplicate sitemap entry.

Fixing #1 and #2 resolves ~30 of the ~37 page-instances.

---

## TIER 1 — High impact

### 1A. Broken images — Astro `/_image/` endpoint returns 500
**Issues:** Image broken (Critical, 6) · Page has broken image (Critical, 3) · More than three parameters in URL (Notice, 6 — same URLs)
**Strategy:** config / build (root cause), not per-page.

**Evidence (verified live):**
| Broken transformed URL (all return 500) | Underlying original |
|---|---|
| `/_image/?href=%2F_astro%2Fservice-branding.76guaOet.webp&w=1024&h=1024&f=webp` | `/_astro/service-branding.76guaOet.webp` → **200 OK** |
| `/_image/?href=%2F_astro%2Fservice-video.B6r8Q6lj.webp&…` | original 200 |
| `/_image/?href=%2F_astro%2Ffounder-mock.BBeR7KaY.webp&…` | original 200 |
| `/_image/?href=%2F_astro%2Fservice-web-design.SUIlWH8V.webp&…` | original 200 |
| `/_image/?href=%2F_astro%2Fservice-digital-marketing.BYpYZ2Oo.webp&…` | original 200 |
| `/_image/?href=%2F_astro%2Fservice-seo.Duz22yDZ.webp&…` | original 200 |

Pages rendering these broken `<img>`/`srcset` refs: `/` (homepage), `/about/`, `/services/`.
Confirmed body of the `/_image/` response = `Internal Server Error` (text/plain). The source `.webp` files exist and serve fine.

**What's happening:** Astro's `<Image>` / `<Picture>` component is emitting on-demand optimization URLs (`/_image/?href=…`), but the endpoint that performs the transform is failing in production. This happens when a site uses Astro's image service in a context where it can't run at request time — e.g. deployed as a **static** build to a host with no SSR/serverless function backing `/_image/`, a missing/misconfigured image service (`sharp`/`squoosh`), or an adapter that doesn't wire up the endpoint.

**Fix (developer — pick the one matching the deploy):**
- **Preferred (static hosting):** force image optimization at **build time** so no runtime endpoint is needed. In `astro.config.mjs`:
  ```js
  import { defineConfig } from 'astro/config';
  export default defineConfig({
    image: { service: { entrypoint: 'astro/assets/services/sharp' } },
    // Ensure the build pre-generates optimized assets instead of /_image/ runtime URLs.
  });
  ```
  Ensure `sharp` is installed (`npm i sharp`) and the build runs in an environment that supports it. After rebuild, `<img>` should point to hashed `/_astro/*.webp` files directly, not `/_image/?href=…`.
- **If SSR is intended:** confirm the deploy adapter (Vercel/Netlify/Node) actually exposes the `/_image` route and that `sharp` is available in the serverless runtime. Check deploy logs for the 500's stack trace.
- **Quick interim mitigation (no rebuild):** since every original `/_astro/<name>.webp` returns 200, the templates can reference the originals directly (drop the `/_image/` wrapper). This removes responsive `srcset` resizing but restores visible images immediately.

**Verify after fix:** all 6 image URLs return 200; `/`, `/about/`, `/services/` show images; re-curl `/_image/...` should 200 or the refs should be gone.

---

### 1B. Project case-study pages 302-redirect to `/projects`
**Issues:** 302 redirect (Warning, 4) · Redirect chain (Notice, 4 of 5) · Page has links to redirect (Warning, 5) · part of 3XX redirect (Warning)
**Strategy:** investigate + config — needs a product decision (see question below).

**Evidence (verified live):** each of these 302-redirects to `/projects`, which then 308s to `/projects/` (a 2-hop chain):
| Case-study URL | Status | Redirects to |
|---|---|---|
| `/projects/scaling-user-acquisition/` | 302 | `/projects` → `/projects/` |
| `/projects/revamping-online-store/` | 302 | `/projects` → `/projects/` |
| `/projects/next-gen-ecommerce/` | 302 | `/projects` → `/projects/` |
| `/projects/brand-identity-local-seo/` | 302 | `/projects` → `/projects/` |

These four URLs are **linked internally** from (this is the "Page has links to redirect" / "links to 3xx" list — verified):
- `/projects/` (links to all 4)
- `/services/web-design/` → next-gen-ecommerce, revamping-online-store
- `/services/brand-identity/` → brand-identity-local-seo
- `/services/seo/` → brand-identity-local-seo
- `/` (homepage) → links to `/projects` (no trailing slash → the 308)

**Decision needed (DO NOT auto-fix — confirm intent):**
- **Option A — these should be real case-study pages:** the routes are mistakenly redirecting instead of rendering. Fix the routing so each `/projects/<slug>/` returns 200 with its own content. Then the internal links resolve cleanly and the redirect issues disappear.
- **Option B — case studies were intentionally removed/merged into `/projects/`:** then (a) change the 302s to **301** (permanent) and point them straight to the final `/projects/` (with trailing slash, skipping the chain hop), and (b) update the internal links on `/projects/`, `/services/web-design/`, `/services/brand-identity/`, `/services/seo/`, and `/` to link directly to `/projects/` instead of the dead case-study slugs. Also remove the dead slugs from any sitemap.

**Secondary (independent of A/B): homepage links `/projects` without trailing slash** → triggers a 308. Change the homepage link `href="/projects"` → `href="/projects/"`.

---

## TIER 2 — Internal linking (indexable pages)

### 2A. Orphan page — `/offers/`
**Issue:** Orphan page (Critical, 1, indexable). **Strategy:** per-page.
**Evidence:** `/offers/` returns 200, is in `sitemap.xml`, but has **0 incoming internal links** (and 0 redirect/canonical inlinks). Reachable only via sitemap — invisible to site navigation.
**Fix:** add at least one (ideally a few) dofollow internal links to `/offers/` from relevant pages — e.g. main nav/footer, the homepage, or `/services/`. Confirm with the owner whether `/offers/` is meant to be publicly discoverable (it may be an ads-only landing page — if so, it's a false positive and should be left as-is, optionally removed from the sitemap).

### 2B. Single dofollow inlink — `/calculator/`
**Issue:** Page has only one dofollow incoming internal link (Notice, 1, indexable). **Strategy:** per-page.
**Evidence:** `/calculator/` (200) has exactly 1 dofollow internal inlink.
**Fix:** if this is an important conversion tool, add a few more contextual internal links (e.g. from `/services/*` pages, homepage CTA, footer). Low urgency.

---

## TIER 3 — Config / investigate

### 3A. Page in multiple sitemaps — `/services/video-production/`
**Issue:** Page in multiple sitemaps (Notice, 1). **Strategy:** config.
**Evidence (verified):** `/services/video-production/` appears **twice** as a `<loc>` in `sitemap.xml` (found_in_sitemaps_length = 2; grep confirms duplicate `<loc>` entries).
**Fix:** de-duplicate the sitemap so each URL is listed once. If the sitemap is generated by `@astrojs/sitemap`, check for a duplicate route/entry in the page collection causing the double emit.

### 3B. Redirect hygiene — http→https / www→non-www
**Issues:** part of 3XX redirect (Warning) · HTTP to HTTPS redirect (Notice, 2). **Strategy:** config — mostly expected, low priority.
**Evidence (verified):**
- `http://quademdigital.com/` → 308 → `https://quademdigital.com/` (correct, 1 hop)
- `http://www.quademdigital.com/` → 308 → `https://www.quademdigital.com/` → `https://quademdigital.com/` (**2 hops**)
- `https://www.quademdigital.com/` → 307 → `https://quademdigital.com/`
**Notes / optional improvements:** these protocol/host canonicalizations are normal and fine to keep. Two minor polish items: (1) the `www` HTTPS redirect is a **307 (temporary)** — make it **308/301 permanent** since the www→non-www choice is permanent; (2) optionally collapse the `http://www` 2-hop chain to a single redirect straight to `https://quademdigital.com/`. No action required for SEO correctness. **Do not** change internal links here — they already use the canonical host.

### 3C. Slow page — homepage TTFB
**Issue:** Slow page (Warning, 5). **Strategy:** investigate.
**Evidence (verified, loading time ms):**
| Page | TTFB (ms) | Load (ms) | Size (B) |
|---|---|---|---|
| `/` (homepage) | **4856** | 4858 | 14,766 |
| `/contact/` | 1348 | 1349 | 8,382 |
| `/projects/` | 1361 | 1362 | 7,012 |
| `/about/` | 1112 | 1113 | 7,514 |
| `/calculator/` | 1010 | 1010 | 9,169 |
**Notes:** the homepage TTFB (~4.9s) is the real outlier and worth investigating — could be cold-start, the failing `/_image/` calls blocking render, or slow upstream. The other four (~1–1.4s) are borderline. Recommend: fix 1A first (broken image endpoint may be inflating homepage time), then re-measure. If still slow, investigate hosting/cold-start and consider static/CDN caching.

---

## Not a defect (left as-is)
- **Pages to submit to IndexNow (Notice, 17):** this is a submission opportunity, not an error. Optional: if the site supports IndexNow, submit these URLs to speed up indexing. No source change required. Out of scope unless you want it.

---

## Issues NOT touched (per instruction)
Only the issues above (the 13 with affected pages) were analyzed. The remaining ~160 Site Audit checks returned 0 affected pages and were not modified. No unrelated issues were altered.

---

## After applying fixes — re-check list

**Pages to open in a browser and confirm:**
1. `https://quademdigital.com/` — images render; check homepage TTFB.
2. `https://quademdigital.com/about/` — founder image renders.
3. `https://quademdigital.com/services/` — all 5 service images render.
4. `https://quademdigital.com/projects/` — links to case studies resolve to 200 (Option A) or point to `/projects/` (Option B).
5. `https://quademdigital.com/services/web-design/`, `/services/brand-identity/`, `/services/seo/` — case-study links no longer redirect.
6. `https://quademdigital.com/offers/` — now reachable via at least one internal link.

**Direct checks (curl):**
- `/_image/?href=%2F_astro%2Fservice-seo.Duz22yDZ.webp&w=1024&h=1024&f=webp` → expect **200** (or gone).
- `/projects/scaling-user-acquisition/` → expect **200** (Option A) or a single **301** to `/projects/` (Option B).
- `sitemap.xml` → `/services/video-production/` listed **once**.

**⚠️ Trigger a re-crawl in Ahrefs** (Site Audit → project Quademdigital → Re-crawl, or wait for the scheduled crawl) so the health score and issue counts update to reflect the fixes. Nothing is marked resolved until a fresh crawl runs.
