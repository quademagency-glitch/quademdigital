# Quadem Digital: Responsive / Mobile Fix Spec

**Project:** Quademdigital · **Site:** https://quademdigital.com/ · **Stack:** Astro + Vercel
**QA method:** real-browser (Playwright) full-page render + screenshots at **phone 390px / tablet 768px / desktop 1280px** across **19 main pages**.
**Date:** 2026-06-28 · spec mode: hand to developer. Do not auto-merge/auto-publish.

> Scope note: this is **visual responsiveness** (layout/overflow), separate from the SEO fixes.
> The SEO metadata fixes (titles, meta descriptions, noindex, trailing-slash redirects) were
> confirmed served **byte-identical on a mobile user-agent**: they are device-independent and
> need no further work. This document is only about how pages render across screen sizes.

---

## Summary

✅ **Layouts are sound at every breakpoint.** Content stacks and reflows correctly: nav collapses
to a hamburger on mobile, service/offer cards stack cleanly, the quote calculator works on phone,
footer reorganizes properly. No overlapping, clipped, or unreadable content found on any page.

⚠️ **One real issue: sitewide horizontal overflow** caused by decorative background elements that
extend past the viewport edge and aren't clipped. Low visual impact, but it creates a stray
horizontal scrollbar (desktop) and a slight side-swipe (mobile), which also hurts mobile usability.

---

## Issue 1: Horizontal overflow from decorative elements  🟡 (all 19 pages)

**What:** A persistent horizontal scroll exists because absolutely-positioned decorative elements
(gradient mesh, glow, parallax orbs) render beyond the right edge of the viewport and are not
clipped by their container.

**Measured (scrollWidth vs viewport width):**

| Breakpoint | Pages affected | Overflow | Culprit element(s) |
|---|---|---|---|
| **Desktop (1280px)** | **All 19 pages** | **+127px** | `div.parallax-orb`, `div.bg-gradient-mesh` |
| Phone (390px) | home, services | +8px | `div.bg-gradient-mesh.active-bg`, `div.footer-glow` |
| Tablet (768px) | home | +4px | `div.bg-gradient-mesh.active-bg` |

Because these are **shared decorative elements** (same class names on every page), one container-level
fix resolves all 19 pages at once.

### Fix (pick one: option B is cleaner)

**Option A: quick global clamp.** Add to your global stylesheet (e.g. the base layout CSS):
```css
html, body {
  overflow-x: hidden;
  max-width: 100%;
}
```
This hides the stray scroll immediately. Caveat: `overflow-x: hidden` on `html`/`body` can disable
`position: sticky` behavior in some browsers: test any sticky headers after applying.

**Option B: constrain the decorative elements (recommended).** Wrap the orbs/mesh in a container
that clips them, so they never extend past the viewport:
```css
/* the section/wrapper that holds the decorative orbs + mesh */
.your-decor-wrapper {        /* e.g. the hero / page wrapper */
  position: relative;
  overflow: clip;            /* clip is better than hidden: doesn't create a scroll container */
}

/* and/or cap the decorative elements themselves */
.parallax-orb,
.bg-gradient-mesh,
.footer-glow {
  max-width: 100vw;
  pointer-events: none;      /* they're decorative: shouldn't capture clicks */
}
```

**Verify after deploy** (per page, any size):
```js
// in browser console: should be 0 (or ≤2)
document.documentElement.scrollWidth - document.documentElement.clientWidth
```
Expect `0` on desktop and mobile once fixed.

---

## Issue 2: Floating WhatsApp button overlaps content  🟢 (minor, check)

On narrow screens the fixed green WhatsApp chat button sits in the bottom-right and, on some pages,
overlaps the footer's "Services" column / a CTA. Confirm it doesn't cover tappable links on phone.

**Fix (if needed):** add bottom padding to the footer on mobile, or nudge the button up:
```css
@media (max-width: 640px) {
  .whatsapp-float { bottom: 80px; }   /* clear the footer tap targets */
}
```

---

## Not a responsive issue, but flagged during QA: case-study pages are placeholders  📝

`/case-study-1/`, `/case-study-2/`, `/case-study-3/` currently render placeholder copy:
*"We are currently writing this case study…"*. They correctly return HTTP 200 (which fixed the
broken-link/404 issues), but they are **thin/empty content** that could later be flagged as
low-value. **Recommendation:** add real case-study content (problem, approach, results) when ready.
Not urgent for responsiveness: noted for content roadmap.

---

## Pages tested (19)

home · services · services/web-design · services/seo · services/brand-identity ·
services/video-production · projects · case-study-1/2/3 · offers · offers/free-seo-audit ·
offers/social-media-bonus · offers/web-dev-discount · about · contact · blog ·
blog/mastering-seo-5-strategies-dominate-search · calculator

---

## After edits: re-check

- Re-run the overflow check (`scrollWidth - clientWidth === 0`) on home + 2 inner pages at 390px,
  768px, and 1280px.
- Confirm sticky header (if any) still works after the `overflow-x` change.
- Confirm WhatsApp button doesn't cover footer links on a real phone.

> These are CSS-only, visual fixes: they do **not** affect the Ahrefs Site Audit issues. No
> re-crawl needed for this document (re-crawl is still recommended after the Round 2 SEO fixes).
