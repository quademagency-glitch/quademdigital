# Fix Spec — "Image file size too large" (Ahrefs Site Audit)

**Project:** Quademdigital (`quademdigital.com`) · project_id 10018975
**Issue:** Image file size too large — **Critical** · issue_id `c64d8113-d0f4-11e7-8ed1-001e67ed4656`
**Affected images:** 3 · **Detected:** crawl of 2026-06-27

---

## Affected assets

| # | Image URL | Current size | HTTP | Linked from page |
|---|-----------|--------------|------|------------------|
| 1 | `https://quademdigital.com/images/offers/web_dev_discount_offer.png` | **1,808,462 B (1.72 MB)** | 200 | `https://quademdigital.com/offers/web-dev-discount/` |
| 2 | `https://quademdigital.com/images/offers/free_seo_audit_offer.png` | **1,603,213 B (1.53 MB)** | 200 | `https://quademdigital.com/offers/free-seo-audit/` |
| 3 | `https://quademdigital.com/images/offers/social_media_bonus_offer.png` | **1,390,743 B (1.33 MB)** | 200 | `https://quademdigital.com/offers/social-media-bonus/` |

**Root pattern:** Promotional offer graphics exported as full-resolution, unoptimized PNGs in `/images/offers/`. Each is ~13–18× over Ahrefs' size budget (~100 KB). PNG is the wrong format for photographic/gradient promo art. Each image is referenced by exactly one offer landing page (1 IMG inlink each), so the fix is contained and low-risk.

**Target:** ≤ ~150 KB per image, no visible quality loss. WebP with PNG fallback.

---

## Fix — per image (apply identically to all 3)

### Step 1 — Resize to actual display size
Check the rendered display width of the `<img>` on each offer page (likely ≤ 1200 px for a content image). Resize the source so its pixel width matches the largest size it's actually displayed at (use 2× that width if you want retina sharpness, but no more). Most 1.5 MB promo PNGs are oversized 2500–4000 px exports.

### Step 2 — Encode WebP + an optimized PNG fallback
Generate two outputs per image, same basename:

```bash
# Requires: cwebp (libwebp) and pngquant + oxipng (or imagemagick)

# --- WebP (primary) ---
cwebp -q 82 -m 6 web_dev_discount_offer.png -o web_dev_discount_offer.webp

# --- Optimized PNG (fallback for old browsers) ---
pngquant --quality=65-85 --strip --force \
  --output web_dev_discount_offer.opt.png web_dev_discount_offer.png
oxipng -o4 --strip safe web_dev_discount_offer.opt.png
# then replace the original .png with web_dev_discount_offer.opt.png (keep the .png filename)
```

Repeat for `free_seo_audit_offer` and `social_media_bonus_offer`.

**If these are flat graphics with text/logos** (not photos): WebP at `-q 82` is ideal. **If they're photographic:** an optimized JPEG fallback (`cjpeg -quality 80`) compresses better than PNG — swap the fallback accordingly.

**Expected result:** ~1.3–1.8 MB → roughly **60–150 KB** WebP, **150–350 KB** PNG fallback. Verify each WebP is < 150 KB; if any is larger, drop quality to 75 or reduce dimensions further.

### Step 3 — Update the markup on each offer page
Replace the bare `<img>` with a `<picture>` element so modern browsers get WebP and old ones fall back to PNG. Example for the web-dev-discount page:

```html
<picture>
  <source srcset="/images/offers/web_dev_discount_offer.webp" type="image/webp">
  <img src="/images/offers/web_dev_discount_offer.png"
       alt="<keep existing alt text>"
       width="<actual width>" height="<actual height>" loading="lazy">
</picture>
```

- **Keep the existing `alt` text** — do not blank it.
- Add explicit `width`/`height` (prevents layout shift) and `loading="lazy"`.
- If you'd rather not touch markup at all: just replace each `.png` in place with its optimized PNG version (Step 2 fallback) — that alone clears the Ahrefs issue, though WebP gives the bigger win.

Apply the same `<picture>` swap on:
- `/offers/web-dev-discount/` → web_dev_discount_offer
- `/offers/free-seo-audit/` → free_seo_audit_offer
- `/offers/social-media-bonus/` → social_media_bonus_offer

---

## Step 4 — Prevent recurrence (systemic)
Add an image-optimization gate so this doesn't reappear:
- **Static/build pipeline:** add an image-min step (e.g. `sharp`/`imagemin`) that auto-converts + compresses anything dropped into `/images/`.
- **WordPress/CMS:** install an image-optimization plugin (ShortPixel, Imagify, EWWW) with auto-WebP + on-upload compression, and set a max-upload-dimension.
- **Manual workflow:** document a "compress before upload" checklist for whoever publishes offer graphics.

---

## Verify after fixing
1. Load each optimized WebP/PNG URL directly and confirm file size in browser DevTools → Network (or `curl -sI <url> | grep -i content-length`).
2. View each offer page in a browser; confirm the graphic still renders crisply with no layout shift.

**Pages to re-check in a browser:**
- https://quademdigital.com/offers/web-dev-discount/
- https://quademdigital.com/offers/free-seo-audit/
- https://quademdigital.com/offers/social-media-bonus/

3. **Trigger a re-crawl** in Ahrefs Site Audit (project Quademdigital) so the issue clears on the next crawl.
