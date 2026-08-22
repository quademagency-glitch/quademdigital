# Fix Spec: https://quademdigital.com/store-manager/

**Source:** Ahrefs Site Audit, project 10018975 (crawl 2026-06-27).
**Live-verified:** 2026-06-28. No fabricated values: all data from the crawl + live HTTP checks.
**Scope:** This single URL only.

## Stack detected
- **Astro** site hosted on **Vercel**.
- Sitemap: `https://quademdigital.com/sitemap-0.xml` (19 URLs), referenced from `sitemap-index.xml`. Build-generated, almost certainly via `@astrojs/sitemap`. Do NOT hand-edit the XML: it regenerates on deploy.

## Root cause
`/store-manager/` returns **HTTP 302** → `https://quaderp.app/` (external), and the URL is still listed in the sitemap. This triggers 3 Site Audit issues.

## Live HTTP findings
- `GET /store-manager/` → **302**, `location: https://quaderp.app` (server: Vercel)
- Redirect target chains further: `quaderp.app/` → **308** → `www.quaderp.app/` → **200**
- Final 200 URL: **https://www.quaderp.app/**
- Organic traffic to /store-manager/: **0**
- In-content internal links pointing here: **0** (only reference is the sitemap entry itself)

## Issues (grouped by severity)
| # | Issue | Severity | Resolved by |
|---|-------|----------|-------------|
| 1 | 3XX redirect in sitemap | Critical | Fix A |
| 2 | 302 redirect | Warning | Fix B |
| 3 | 3XX redirect (link to redirecting URL) | Warning | Fix A |

---

## Fix A: Remove /store-manager/ from the sitemap (resolves #1 + #3)
The sitemap is build-generated, so fix at the source:

- If `/store-manager/` becomes a pure Vercel-level redirect (Fix B in `vercel.json`) with **no** Astro page/route, `@astrojs/sitemap` will not emit it. Confirm after rebuild.
- If an Astro page file exists (e.g. `src/pages/store-manager/index.astro`), exclude it via the integration filter in `astro.config.mjs`:

```js
import sitemap from '@astrojs/sitemap';
export default defineConfig({
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/store-manager/'),
    }),
  ],
});
```

Rebuild & redeploy, then re-fetch `sitemap-0.xml` and confirm the `/store-manager/` `<loc>` is gone.

## Fix B: Change 302 → 301, pointing at the FINAL 200 URL (resolves #2)
Define the redirect in **`vercel.json`** as permanent, and target the final destination to avoid a 2-hop chain:

```json
{
  "redirects": [
    { "source": "/store-manager", "destination": "https://www.quaderp.app/", "permanent": true }
  ]
}
```

- `"permanent": true` emits a **301**.
- Use `https://www.quaderp.app/` (the only URL in the chain returning 200): NOT `https://quaderp.app/`, which itself 308-redirects.
- If the redirect currently lives in an Astro page/middleware (`Astro.redirect(...)` defaulting to 302), prefer moving it to `vercel.json` so the route renders no Astro page (which also cleanly drops it from the sitemap per Fix A).

---

## Verification checklist (after redeploy)
1. `curl -I https://quademdigital.com/store-manager/` → expect **HTTP 301**, `location: https://www.quaderp.app/`
2. `curl -s https://quademdigital.com/sitemap-0.xml | grep store-manager` → expect **no output**
3. Re-check in a browser.
4. Trigger an Ahrefs re-crawl of this URL so the 3 issues clear.

## Out of scope (noted, not changed)
- `/admin/campaigns/` and `/portal/` are also in the sitemap and may not belong in a public index. Separate decision: not touched here.
