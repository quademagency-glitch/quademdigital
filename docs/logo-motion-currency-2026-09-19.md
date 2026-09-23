# Logo, motion and Ghana pricing corrections

The user's requested corrections are implemented on the existing MarketingLab rebuild, retaining Quadem blue and the whole public-site scope.

## Causes and changes

- The final stylesheet explicitly hid `.logo img` and `.gl-logo img`. Both rules now display the supplied Quadem mark at responsive sizes, including the footer.
- The home hero had no persistent interaction, and fit-gated process sequences left shorter screens static. The hero is now a raised photographic card with a paper inset, 16px corners, downward shadow, restrained pointer tilt and scroll-driven recession. Its image moves within the crop. A finite settling loop pauses offscreen and when the document is hidden, with cleanup on Astro navigation. Process cards have a one-time arrival in ordinary flow when pinning cannot fit. Shared-page artwork reveals its crop on entering the viewport. Reduced motion immediately disables these effects while leaving content visible.
- The local `/api/geo/` had no edge headers and therefore returned an unknown country and USD. `src/lib/pricingLocation.js` resolves an explicit country choice, then valid edge headers, then Ghana only in development. Unknown production visitors retain the international fallback and can choose their country. No exchange rate or price amount was invented or changed.
- The shared pricing engine now presents a labelled country selector beside price notes, remembers a choice, shares the geo request, supports a selected country even if the request fails and rejects stale responses after another selection or page navigation. Ghana-only links are reversibly hidden. The global funnel keeps its separate Africa guidance with the location selector outside the hidden market block.
- A missing Ghana price can no longer reuse a USD amount and label it as GHS. It falls back to a quote. Screenshot inspection also corrected contrast in the highlighted service price card and the dark introduction heading.

## Verification

The desktop/mobile browser pass uses the real local geo endpoint. All seven service routes show GHS from their actual Africa list; homepage, service catalogue, calculator and global-market routing are covered. Example web-design prices are GH₵2,500 for Landing Page and GH₵5,000 for Corporate Site, not conversions of the dollar list.

Checks cover visible logos, pointer and scroll transforms, phone movement, short-laptop process motion, live reduced-motion changes, country switching, persistent selection, client navigation, hidden-offer restoration, geo failures, stale-response ordering and text contrast. No JavaScript page errors or checked horizontal overflow. Fourteen unit/regression tests and all ten release guards pass. See `docs/qa/logo-motion-currency-2026-09-19.json` for detailed results; the production build also passed.

Preview: http://127.0.0.1:4322/. No deployment, commit, push, CMS mutation or real form/email submission. Browser POSTs were blocked. The unrelated IPv6 app and `.claude/settings.json` remain untouched.
