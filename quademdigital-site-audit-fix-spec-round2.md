# Quadem Digital — Site Audit Fix Spec (Round 2 / cleanup)

**Project:** Quademdigital (Ahrefs 10018975) · **Target:** https://quademdigital.com/
**Stack:** Astro + Vercel · **Crawl:** 2026-06-28 22:35 UTC
**Health score: 93 / 100** (was 65.6 — up +27.4) · broken 3→0 · all critical link/404 issues cleared.

> These are the **transitional items** created by Round 1's trailing-slash redirects, plus a few
> pages the first pass didn't cover. Knocking these out should push the score into the high 90s.
> Spec mode — hand to developer. Do not auto-merge/auto-publish.

---

## 1. Internal links point at redirecting (non-slash) URLs  🟡 (32 links)

**Root cause:** Round 1 added 308 redirects from `/path` → `/path/`. But internal links across the
site still use the **non-slash** href, so every click now goes through a redirect. Ahrefs flags this
as "Page has links to redirect" (32), "3XX redirect" (29), and "Redirected page has no incoming
internal links" (26) — all the same underlying cause.

**Fix:** update internal `href`s to the canonical **trailing-slash** form. These are the
destinations being linked to (update every link that points to the left → use the right):

| Linked as (redirects) | Should be |
|---|---|
| `/services` | `/services/` |
| `/contact` | `/contact/` |
| `/privacy-policy` | `/privacy-policy/` |
| `/terms-of-service` | `/terms-of-service/` |
| `/projects` | `/projects/` |
| `/blog` | `/blog/` |
| `/about` | `/about/` |
| `/services/video-production` | `/services/video-production/` |
| `/offers/free-seo-audit` | `/offers/free-seo-audit/` |
| `/offers/social-media-bonus` | `/offers/social-media-bonus/` |
| `/offers/web-dev-discount` | `/offers/web-dev-discount/` |
| `/blog/why-your-business-needs-custom-website-2026` | …append `/` |
| `/blog/how-quaderp-transforms-retail-operations` | …append `/` |

Most of these live in shared **nav / footer / CTA components** (e.g. "Book a Free Consultation" →
`/contact`, footer legal links → `/privacy-policy`). Fix them in the template/components once and
the bulk clears. Tip: grep the codebase for `href="/` without a trailing slash and add it.
(The 308s can stay as a safety net — but no internal link should rely on them.)

---

## 2. Noindex pages still in sitemap  🔴 (2)

`/admin/campaigns/` and `/portal/` were set to `noindex` in Round 1 (correct) but are **still listed
in the sitemap** — contradictory signal.

**Fix:** exclude them from the Astro sitemap. With `@astrojs/sitemap`:

```js
// astro.config.mjs
sitemap({
  filter: (page) =>
    !page.includes('/admin/') && !page.includes('/portal/'),
}),
```

**Verify:** `curl https://quademdigital.com/sitemap-0.xml` should no longer list those two URLs.

---

## 3. Remaining short meta descriptions  🟡 (3)

New pages not covered in Round 1. Rewrite to 110–160 chars:

| Page | Now | Proposed (chars) |
|---|---|---|
| `/case-study-1/` | 90 | Case study: how Quadem Digital redesigned an online store's user experience to drive a major spike in sales and conversions. See the results. (140) |
| `/case-study-2/` | 92 | Case study: how Quadem Digital built a multi-channel ad strategy that brought in high-quality leads and scaled user acquisition. See the results. (143) |
| `/blog/future-of-web-dev/` | 98 | Discover the latest trends and frameworks shaping web development — from server components to AI-driven UIs — and what they mean for your site. (141) |

---

## 4. Titles too long  🟡 (4) — blog posts

All 4 are blog posts where the "| Quadem Digital Blog" suffix pushes them over length. Recommend
shortening the suffix to "| Quadem Digital" (and trimming the longest headlines):

| Page | Now (chars) | Proposed (chars) |
|---|---|---|
| `/blog/how-to-choose-right-digital-agency/` | 78 | How to Choose the Right Digital Agency \| Quadem Digital (54) |
| `/blog/nigerian-business-social-media-marketing/` | 84 | Why Nigerian Businesses Need Social Media Marketing in 2026 \| Quadem Digital (74)* |
| `/blog/mastering-seo-5-strategies-dominate-search/` | 78 | Mastering SEO: 5 Strategies to Dominate Search \| Quadem Digital (62)* |
| `/blog/5-signs-business-needs-website-redesign/` | 78 | 5 Signs Your Business Needs a Website Redesign \| Quadem Digital (62)* |

\* Still slightly over 60 chars — Google may truncate the tail, but the keyword-rich start is
intact. Acceptable; shorten further only if you want zero truncation.

**Template note:** consider changing the blog title template from
`{title} | Quadem Digital Blog` → `{title} | Quadem Digital` globally, then trim individual
headlines as needed.

---

## 5. Orphan pages  🔴 (5) — needs internal links

These indexable pages have no incoming internal links. Add links from relevant pages/nav:

| Page | Suggested link source |
|---|---|
| `/case-study-1/` | Already linked from `/projects/` — should clear next crawl if links use slash form |
| `/case-study-2/` | Same as above |
| `/case-study-3/` | Same as above |
| `/offers/` | Link from nav or homepage "Offers" / from individual offer pages (breadcrumb) |
| `/calculator/` | Link from `/services/` and/or nav CTA ("Get a Quote") |

> The 3 case studies should de-orphan automatically once §1's slash-link fix lands (the `/projects/`
> cards will then count as proper internal links). `/offers/` and `/calculator/` need a real nav or
> in-content link.

---

## After edits — re-check & re-crawl

**Verify in browser / curl:**
- View source of homepage + footer → internal links use trailing slash (`/contact/` not `/contact`)
- `curl https://quademdigital.com/sitemap-0.xml` → no `/admin/` or `/portal/`
- `/case-study-1/`, `/case-study-2/`, `/blog/future-of-web-dev/` → new meta descriptions
- 4 blog posts → shortened titles

**Then trigger a re-crawl** in Ahrefs (Site Audit → Quademdigital → Run crawl) to confirm the
redirect-related warnings drop and the score rises.
