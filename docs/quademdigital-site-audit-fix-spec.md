# Quadem Digital — Site Audit Fix Spec

**Project:** Quademdigital (Ahrefs project 10018975)
**Target:** https://quademdigital.com/
**Stack:** Astro + Vercel
**Crawl:** 2026-06-28 21:33 UTC · **Health score: 65.6 / 100** (61 crawled · 3 broken · 3 redirects · 0 blocked)
**Spec generated:** 2026-06-28 · spec mode (no source access — hand to developer)

> All values below were verified against the live site. Nothing was fabricated.
> Do **not** auto-merge or auto-publish — review each change.

---

## Recommended order

1. Trailing-slash 301 config (root cause — clears duplicates + most notices)
2. Broken case-study links (biggest health-score lift)
3. Meta description + title rewrites (copy-paste ready)
4. Noindex private pages
5. Lower-priority notices (optional)

---

## 1. Root cause — trailing-slash duplicates  🔴 high impact

**Problem:** Pages resolve at BOTH `/contact` and `/contact/`. The non-slash version returns
HTTP 200 with a self-referencing canonical instead of redirecting. Ahrefs sees two indexable
copies of every page.

**This single gap drives:**
- "Indexable page not in sitemap" (11) — non-slash URLs are crawlable but not in sitemap
- Duplicate rows in the meta-description issues (e.g. `/contact` + `/contact/` both counted)

**Fix:** enforce one canonical form (trailing slash) and 301-redirect the non-slash variants.

```js
// astro.config.mjs
export default defineConfig({
  trailingSlash: 'always',
  // ...existing config
});
```

```json
// vercel.json
{ "trailingSlash": true }
```

**Verify after deploy:** `curl -I https://quademdigital.com/contact` should return `301` → `/contact/`.

Affected non-slash URLs currently returning 200:
`/privacy-policy`, `/projects`, `/contact`, `/services/seo`, `/services/brand-identity`,
`/about`, `/services/video-production`, `/blog`, `/terms-of-service`, `/services/web-design`, `/services`

---

## 2. Broken links → case studies  🔴 critical

The `/projects/` page has 3 project cards, each linking to a case-study page that returns **404**
(verified live). These are also the 3 "broken" pages dragging the health score.

| Source page | Broken link | Anchor | Status |
|---|---|---|---|
| `/projects/` | `/case-study-1` | Read Case Study → | 404 |
| `/projects/` | `/case-study-2` | Read Case Study → | 404 |
| `/projects/` | `/case-study-3` | Read Case Study → | 404 |

**Decision required — pick one:**
- **(A) Build the 3 case-study pages** — *recommended if content exists.* You supply the case-study
  content; the links then resolve and the 404/4XX issues clear automatically.
- **(B) Remove the "Read Case Study →" links** from the 3 project cards until the pages exist.

> Do not fabricate case-study content. The "404 page" and "4XX page" issues (3 each) are the same
> 3 URLs and resolve once this is fixed.

---

## 3. Meta descriptions — rewrites

### Too short (<110 chars) → rewrite to 110–160

| Page | Now | Proposed (chars) |
|---|---|---|
| `/contact/` | 82 | Get in touch with Quadem Digital Enterprise to discuss your web, design, or marketing project. Let's build something great together. (131) |
| `/privacy-policy/` | 90 | Read how Quadem Digital Enterprise collects, uses, stores, and protects your personal information when you use our website and services. (135) |
| `/projects/` | 66 | Explore featured work from Quadem Digital Enterprise — a selection of web, design, and marketing projects we've delivered for our clients. (138) |
| `/services/` | 80 | Comprehensive digital solutions — web design, SEO, branding, and video — to scale your business and dominate your market. Explore our services. (143) |
| `/about/` | 78 | Learn more about the founder of Quadem Digital Enterprise, our story, and the core values that drive the work we do for every client. (133) |
| `/services/web-design/` | 98 | Custom, responsive websites built to convert visitors into loyal customers and grow your business. Professional web design by Quadem Digital. (141) |
| `/terms-of-service/` | 89 | Read the terms and conditions for using Quadem Digital Enterprise's website and services, including your rights and responsibilities. (133) |
| `/portal/` | 49 | *(see §4 — recommend noindex instead)* |
| `/admin/campaigns/` | 61 | *(see §4 — recommend noindex instead)* |

### Too long (>160 chars) → trim to ≤160

| Page | Now | Proposed (chars) |
|---|---|---|
| `/services/video-production/` | 175 | Corporate videos, social content, commercial ads, and event coverage — Quadem Digital delivers cinematic-quality video production that captivates. (148) |
| `/offers/free-seo-audit/` | 219 | Get a free, no-obligation audit of your website's SEO, speed, and UX — plus a custom roadmap to grow your traffic and conversions. Claim yours today. (149) |
| `/offers/social-media-bonus/` | 213 | Book a complete Web Design package this month and get 1 month of dedicated Social Media Management free — driving immediate traffic to your new site. (148) |
| `/offers/web-dev-discount/` | 219 | Get 15% off your first custom web development or app design project with Quadem Digital. New clients only — let's build something amazing together. (146) |

---

## 4. Titles too long → trim

Both contain a redundant "| Special Offer | Quadem Digital" suffix.

| Page | Now (chars) | Proposed (chars) |
|---|---|---|
| `/offers/free-seo-audit/` | 79 | Free Technical SEO & Performance Audit \| Quadem Digital (54) |
| `/offers/web-dev-discount/` | 74 | 15% Off Your First Custom Web Project \| Quadem Digital (53) |

---

## 5. Private pages — recommend noindex

`/admin/campaigns/` and `/portal/` are internal/private (admin + client portal). They should not
be in Google's index at all — better to `noindex` than to SEO-optimize.

```html
<!-- in the <head> of these pages -->
<meta name="robots" content="noindex, nofollow">
```

> **Decision required:** confirm noindex for these two. If confirmed, they drop out of the
> meta-description issue counts as well.

---

## 6. Lower-priority notices (optional)

| Issue | Count | Note |
|---|---|---|
| Pages to submit to IndexNow | 29 | Largely resolved by §1. Optionally enable IndexNow at CDN. |
| Indexable page not in sitemap | 11 | Resolved by §1 (non-slash duplicates). |
| 3XX redirect | 3 | Link query returned 0 rows — likely already resolved / noise. |
| Redirect chain | 1 | Can detail on request. |
| HTTP → HTTPS redirect | 2 | Expected; informational. |
| Structured data rich-result error | 1 | Can pull the specific page on request. |
| Slow page | 11 | Performance — investigate (not a content fix). |
| Orphan pages | 17 | Needs internal-linking plan — see below. |

### Orphan pages (17) — needs your navigation decision
These indexable pages have no internal links pointing to them. They should be reachable from nav,
footer, or related-content links:
`/contact/`, `/privacy-policy/`, `/services/video-production/`, `/services/`, `/admin/campaigns/`,
`/offers/free-seo-audit/`, `/offers/social-media-bonus/`, `/about/`, `/services/brand-identity/`,
`/services/web-design/`, `/terms-of-service/`, `/calculator/`, `/projects/`, `/services/seo/`,
`/blog/`, `/offers/web-dev-discount/`, `/portal/`
(Note: `/admin/campaigns/` and `/portal/` being orphaned is *fine* if they're private — see §5.)

---

## After edits — re-check & re-crawl

**Pages to verify in a browser after deploy:**
- `https://quademdigital.com/contact` → should 301 to `/contact/`
- `https://quademdigital.com/projects/` → case-study links resolve (or are removed)
- `https://quademdigital.com/services/web-design/` → new meta description in page source
- `https://quademdigital.com/offers/free-seo-audit/` → new title + meta description
- `https://quademdigital.com/admin/campaigns/` and `/portal/` → noindex tag present

**Then trigger a re-crawl** in Ahrefs (Site Audit → Quademdigital → Run crawl) to confirm the
issue counts drop and the health score rises.
