# Quadem Digital: Site Audit Fix Spec

**Project:** Quademdigital (`quademdigital.com/`) · Ahrefs project 10018975
**Crawl:** 2026-06-29 20:15 UTC · Health score 94.6/100 · 92 pages crawled
**Mode:** Fix spec (no direct source access): hand to developers. No values fabricated; all data pulled from the live crawl.

---

## ROOT CAUSE (fixes ~80% of issues)

**Trailing-slash mismatch.** The site canonicalises every URL to a **trailing slash** and 308-redirects the no-slash version. But internal links across the site are written **without** the trailing slash. So every nav/menu/card link fires a 308 redirect.

This single inconsistency is what generates:
- "3XX redirect" (23 pages): mostly the no-slash → slash hops
- "Page has links to redirect" (5 pages): the pages whose links point at no-slash URLs
- "Orphan page" (4 pages): the slash version receives 0 internal links because links go to the no-slash version
- contributes to "Redirected page has no incoming internal links" (15)

**Fix once, at the source:** update internal links to include the trailing slash so they point directly at the final URL. Do NOT remove the redirect rule (it's a healthy safety net): fix the *links*.

---

## ISSUE 1: Internal links point to redirects  (Priority: HIGH · template fix)

**Affected source pages (5) and the no-slash links they contain:**

| Source page | Bad links (no trailing slash) → should be |
|---|---|
| `/services/` | `/services/brand-identity`, `/services/seo`, `/services/video-production`, `/services/web-design` → add `/` |
| `/offers/` | `/offers/free-seo-audit`, `/offers/social-media-bonus`, `/offers/web-dev-discount` → add `/` |
| `/projects/` | `/projects/brand-identity-local-seo`, `/projects/next-gen-ecommerce`, `/projects/revamping-online-store`, `/projects/scaling-user-acquisition` → add `/` |
| `/blog/` | 8 post links (`/blog/future-of-web-dev`, `/blog/how-quaderp-transforms-retail-operations`, `/blog/how-to-choose-right-digital-agency`, `/blog/local-seo-strategies`, `/blog/mastering-seo-5-strategies-dominate-search`, `/blog/nigerian-business-social-media-marketing`, `/blog/5-signs-business-needs-website-redesign`, `/blog/why-your-business-needs-custom-website-2026`) → add `/` |
| `/` (home) | `/contact` → `/contact/` |

**Fix:** In the templates/components that render these listing links (service cards, offer cards, project cards, blog index loop, header/footer nav), append a trailing slash to each generated href. If links come from a CMS/data file, normalise the slug output to include `/`. One template edit per listing type covers all rows.

**Verify after:** the 5 source pages above should show 0 internal outlinks to 3xx.

---

## ISSUE 2: Orphan pages  (Priority: HIGH · Critical · 4 pages)

These indexable pages get **0 internal href inlinks** (only reachable via redirect/sitemap):

- `/services/branding--graphic-design/`
- `/services/web-design--development/`
- `/services/digital-marketing--social-media/`
- `/services/seo--paid-ads/`

**Diagnosis:** These are the *real* (double-dash) service detail pages. But the `/services/` listing links to a **different, older set** of slugs (`/services/brand-identity/`, `/services/seo/`, `/services/web-design/`, `/services/video-production/`): see Issue 1. So the live service pages have no inbound links and the linked-to slugs are a separate, partly-redirecting set.

**Decision needed (investigate):** Which slug set is canonical?
- **(A)** `/services/branding--graphic-design/` style (these are the indexable, in-sitemap pages), then update the `/services/` listing to link to THESE, and 301 the old short slugs to them.
- **(B)** the short slugs (`/services/seo/` etc.), then those need to be the canonical pages and the double-dash ones redirected.

**Recommended:** Option A: link the `/services/` cards to the four double-dash URLs above. That fixes the orphans AND removes 4 of the Issue 1 redirect links in one edit. Please confirm the slug set before I finalise the link targets.

---

## ISSUE 3: 404 / 4XX page  (Priority: HIGH · Critical · 1 URL)

- **Broken URL:** `https://quademdigital.com/sitemap-index.xml` → **404**
- Inbound internal links: 0. `origin: null`: Ahrefs found it by guessing a common sitemap path, OR it's referenced in `robots.txt`.

**Fix:** Check `robots.txt` for a `Sitemap: https://quademdigital.com/sitemap-index.xml` line. The real sitemap is `https://quademdigital.com/sitemap.xml` (confirmed 200, referenced by other pages). Either:
- update `robots.txt` to point at `/sitemap.xml`, **or**
- create `/sitemap-index.xml` as a proper sitemap index that references `/sitemap.xml`.

This is the only 404 and the only 4XX: same URL appears in both issues.

---

## ISSUE 4: Title too long & Meta description too short  (Priority: MEDIUM · per-page · 8 pages)

### 4a. Titles too long (4 blog posts, currently 71–81 chars; target ≤ ~60)
All exceed length because of the ` | Quadem Digital` suffix. Suggested trims (review/approve: keep keyword, drop year/filler):

| URL | Current (len) | Suggested (len) |
|---|---|---|
| `/blog/how-to-choose-right-digital-agency/` | How to Choose the Right Digital Agency for Your Business \| Quadem Digital (73) | How to Choose the Right Digital Agency \| Quadem Digital (54) |
| `/blog/nigerian-business-social-media-marketing/` | Why Every Nigerian Business Needs Social Media Marketing in 2026 \| Quadem Digital (81) | Social Media Marketing for Nigerian Businesses \| Quadem Digital (62) |
| `/blog/mastering-seo-5-strategies-dominate-search/` | Mastering SEO: 5 Strategies to Dominate Search Rankings \| Quadem Digital (72) | Mastering SEO: 5 Strategies to Rank Higher \| Quadem Digital (58) |
| `/blog/5-signs-business-needs-website-redesign/` | 5 Signs Your Business Needs a Website Redesign in 2026 \| Quadem Digital (71) | 5 Signs You Need a Website Redesign \| Quadem Digital (51) |

These are suggestions based on each post's existing title: confirm wording before applying. Edit in the CMS/post meta per page.

### 4b. Meta descriptions too short (4 service pages, currently 73–75 chars; target 110–160)
Current descriptions are accurate but short. Suggested expansions (review/approve: built only from each page's stated service, nothing invented):

| URL | Current (len) | Suggested (len) |
|---|---|---|
| `/services/branding--graphic-design/` | Distinct visual identities that make your brand memorable and professional. (75) | Distinct visual identities: logos, brand systems and graphic design that make your brand memorable, consistent and professional across every touchpoint. (151) |
| `/services/web-design--development/` | Custom, responsive websites built to convert visitors into loyal customers. (75) | Custom, responsive websites built to convert visitors into loyal customers: fast, mobile-friendly and designed around your brand and business goals. (147) |
| `/services/digital-marketing--social-media/` | Engaging content and strategies to grow your audience and brand presence. (73) | Engaging content and social media strategies to grow your audience, build brand presence and turn followers into customers across the platforms that matter. (155) |
| `/services/seo--paid-ads/` | Targeted traffic strategies to put your brand in front of the right people. (75) | SEO and paid ad strategies that put your brand in front of the right people: driving targeted, high-intent traffic that converts into measurable results. (153) |

Edit in the CMS/page SEO meta per page.

---

## ISSUE 5: Sitemap & redirect chain  (Priority: MEDIUM · config · 7 items)

### 5a. Indexable pages not in sitemap (6 pages)
These return 200, are indexable, but are missing from `sitemap.xml`:
- `/privacy-policy/`
- `/terms-of-service/`
- `/services/brand-identity/`
- `/services/web-design/`
- `/services/seo/`
- `/calculator/`

**Fix:** Add these to `sitemap.xml` (with `<lastmod>`). **Caveat:** `/services/brand-identity/`, `/services/web-design/`, `/services/seo/` overlap with the Issue 2 slug decision: if you consolidate onto the double-dash slugs (Option A), do NOT add the short slugs to the sitemap; redirect them instead. Resolve Issue 2 first.

### 5b. Redirect chain (1)
- `http://www.quademdigital.com/` → `https://www.quademdigital.com/` → `https://quademdigital.com/` (2 hops)

**Fix:** Add a server rule that sends `http://www.` **directly** to `https://quademdigital.com/` in a single 301/308 hop, skipping the intermediate `https://www.` step. (Most hosts/CDNs let you combine the HTTPS + www-strip into one redirect.)

---

## NOT TOUCHED (out of scope / healthy / housekeeping)
- HTTP→HTTPS redirect (2): expected, healthy.
- Pages to submit to IndexNow (33): submission housekeeping, not a defect.
- Slow page (1): needs separate performance investigation.
- "Page has only one dofollow incoming internal link" (5): minor internal-linking depth, low priority.
- "Redirected page has no incoming internal links" (15): largely resolves once Issue 1 trailing-slash links are fixed; re-evaluate after re-crawl.

---

## After edits: re-check & re-crawl
Spot-check these in a browser (should be 200, no redirect, correct title/meta):
1. `/services/`: service card links should NOT redirect
2. `/services/branding--graphic-design/`: should now have internal inlinks
3. `/blog/`: post links should NOT redirect
4. One trimmed-title blog post + one expanded-meta service page
5. `robots.txt` / `/sitemap.xml`: sitemap reference resolves (no `/sitemap-index.xml` 404)

Then **trigger a fresh crawl in Ahrefs** (Site Audit → Quademdigital → Re-crawl) to confirm the issue counts drop.
