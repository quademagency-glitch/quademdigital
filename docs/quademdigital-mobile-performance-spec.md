# Quademdigital: Mobile Performance Fix Spec

**Site:** quademdigital.com · **Stack detected:** Astro (static) front-end + Payload CMS (`cms.quademdigital.com`) serving media.
**Measured:** 2026-06-30, live, mobile transfer sizes (gzip/brotli). Fix spec: hand to your developer.

> **Headline:** the problem is **images, not code.** All JavaScript + CSS combined is ~32 KB (tiny, and already deferred). Image payload is the entire story: oversized source files served at full resolution to small mobile viewports, with no responsive sizing. Fixing images is where ~all the mobile gain is.

---

## Evidence (real measured bytes)

**Code is fine: leave it alone:**
| Asset | Transfer | Verdict |
|---|---|---|
| ClientRouter JS | 5.8 KB | fine, `type=module` (deferred) |
| BaseLayout JS | 5.6 KB | fine, deferred |
| BaseLayout CSS | 15.5 KB | fine |
| index CSS | 4.8 KB | fine |
| **Total JS+CSS** | **~32 KB** | **not a problem** |

**Images are the problem: intrinsic file size vs. how small they're shown:**
| Image | File is | Shown at | Transfer | Waste |
|---|---|---|---|---|
| Founder photo (`…67979…-857x1200.jpg`) | 857×1200 | 600×800 | **157 KB** | oversized + JPG not WebP/AVIF |
| Client-logo PNG (`…8791…-1080x1080.png`) | **1080×1080** | **160×80** | 24 KB | **45× too many pixels**; PNG for a photo |
| Client-logo JPG (`…b6a2…-1280x853.jpg`) | 1280×853 | 160×80 | 32 KB | ~50× too many pixels |
| service-video.webp | **1024×1024** | card thumb (~400px) | **121 KB** | ~6× too many pixels |
| service-digital-marketing.webp | 1024×1024 | ~400px | 108 KB | ~6× |
| service-branding / seo / web-design .webp | 1024×1024 | ~400px | 90–94 KB each | ~6× each |

**Page weights today (mobile):**
- **Homepage:** ~290 KB, dominated by the 157 KB founder JPG + client-logo images (which repeat in a logos row).
- **Services page:** the 5 service images alone = **491 KB**: they're 1024×1024 each but render as small cards.

**Already done right (keep these):** every `<img>` has explicit `width`/`height` (good for CLS), below-fold images use `loading="lazy"`, local images are WebP, no web-font payload.

---

## Root cause

1. **No responsive images.** Zero `srcset`/`sizes` on the whole page: every device downloads the full-size file regardless of viewport. A 390px-wide phone gets the same 1024px image a desktop does.
2. **Source images far larger than display size.** Worst is the client logo: a 1080×1080 file shown at 160×80.
3. **Wrong formats for two CMS images** (PNG/JPG photos that should be WebP/AVIF).
4. **Payload CMS isn't resizing on request.** I tested `?width=320`, `?w=320`: the CMS ignored them and returned the full file. So the resizing must be configured in Payload, not appended at the URL.

---

## Fix plan (in impact order)

### Fix 1: Generate responsive image sizes in Payload CMS *(biggest win)*
In the Payload collection that stores media (likely `Media`/`uploads`), configure the `imageSizes` array so each upload produces small/medium/large derivatives + a WebP/AVIF version. Example:
```ts
// payload Media collection upload config
upload: {
  formatOptions: { format: 'webp', options: { quality: 72 } },
  imageSizes: [
    { name: 'thumb',  width: 200,  height: undefined },
    { name: 'card',   width: 480,  height: undefined },
    { name: 'medium', width: 800,  height: undefined },
    { name: 'large',  width: 1200, height: undefined },
  ],
}
```
Then **re-process existing uploads** (Payload regenerates sizes on re-save, or run a one-off script over the collection). After this, Payload exposes each size's URL in the media doc (`doc.sizes.card.url`, etc.).

### Fix 2: Emit `srcset` + `sizes` from Astro
Update the Astro components/templates that render CMS and local images so they output responsive markup instead of a single `src`. Two paths:

**a) Local images in `/images/*` (service cards, etc.):** use Astro's built-in `<Image>` / `getImage()` (astro:assets) which auto-generates `srcset` + modern formats at build time:
```astro
---
import { Image } from 'astro:assets';
import serviceVideo from '../images/service-video.webp';
---
<Image src={serviceVideo} alt="Video production"
       widths={[200, 400, 600]} sizes="(max-width: 640px) 45vw, 400px" />
```
Drop the source files to ~600px max: nothing renders larger than a card.

**b) CMS images:** once Fix 1 produces sizes, build `srcset` from the size variants:
```astro
<img
  src={media.sizes.card.url}
  srcset={`${media.sizes.thumb.url} 200w, ${media.sizes.card.url} 480w, ${media.sizes.medium.url} 800w`}
  sizes="(max-width: 640px) 45vw, 480px"
  width={media.width} height={media.height}
  alt={media.alt} loading="lazy" decoding="async" />
```

### Fix 3: Right-size the obvious offenders now (quick manual wins, even before the pipeline)
- **Client-logo images** shown at 160×80: replace the 1080×1080 PNG and 1280×853 JPG with ~320×160 WebP. Drops ~24 KB→~3 KB and ~32 KB→~4 KB each, ×N logos in the row.
- **Founder photo:** export a 600×800 (and a 1200×1600 @2x) WebP. Drops 157 KB → ~35–50 KB.
- **5 service WebPs:** re-export at ~600px instead of 1024px. ~491 KB → ~120–150 KB total on the services page.

### Fix 4: LCP hint for the hero image
The largest above-the-fold image (likely the hero/founder or first service image) should NOT be `loading="lazy"`: it's the LCP element. Set `loading="eager"` + `fetchpriority="high"` on just that one, and add a `<link rel="preload" as="image" imagesrcset=…>` in `<head>` for it. Keep everything below the fold `loading="lazy"` (already done).

### Fix 5: Confirm Brotli + long cache on the CMS
Local `/_astro/*` assets are fingerprinted (good: cache them `immutable, max-age=31536000`). Verify `cms.quademdigital.com` sends `Cache-Control` + Brotli on media; if it's a bare Payload/Express server behind no CDN, putting Cloudflare in front of the CMS subdomain would add compression + edge caching for free.

---

## Expected outcome
Homepage image payload should fall from ~250 KB of images toward ~60–90 KB; the services page from ~491 KB toward ~130 KB. That directly improves **LCP** (largest image paints sooner) and total transfer on mobile/3G-4G: the metrics that make mobile "feel slow."

## What I did NOT change
No code edits (no source access). No changes to JS/CSS (they're already lean). This is independent of the Site Audit fix spec: different problem set.

## Verify after changes (mobile)
- Re-run Google PageSpeed Insights (mobile) on `/`, `/services/`, `/services/video-production/`, and a blog post: compare LCP and "Properly size images" / "Serve images in next-gen formats" audits before/after.
- In Chrome DevTools (mobile emulation, Network, "Img" filter): confirm the phone now downloads the small `srcset` candidate, not the 1024px/1080px original.
- Confirm no layout shift (CLS) regression: keep the `width`/`height` attributes.
