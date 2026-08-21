# Google Analytics is downloaded twice

**Measured:** 2026-08-21, live homepage, Lighthouse mobile.

The page loads `gtag.js` directly and also loads Google Tag Manager, which
loads its own copy of `gtag.js` for the same GA4 property. Both appear in the
network log:

```
562 KB  googletagmanager.com/gtag/js?id=G-VWQNS4KFSX
315 KB  googletagmanager.com/gtm.js?id=GTM-5CPTKQDB
562 KB  googletagmanager.com/gtag/js?id=G-VWQNS4KFSX&cx=c&gtm=4e68j1h2   <- loaded by GTM
```

Compressed, that is 483 KB of a 1,112 KB page: **43% of the page weight** for
one working analytics setup.

## Your numbers are fine

Worth stating plainly, because it is the scarier possibility: this is **not**
inflating your visitor counts. Only one pageview is recorded per visit. The
network log shows a single `analytics.google.com/g/collect` call. The
`stats.g.doubleclick.net` call alongside it is the normal ads companion ping,
not a second visit.

So this is wasted download, not wrong data.

## Why it has not been removed

Removing the direct `gtag.js` load looks free. It is not.

`src/scripts/main.js:26` reports every conversion with:

```js
window.gtag('event', eventName, eventData);
```

That is a gtag.js pattern. The GTM pattern is `dataLayer.push({event: '...'})`
with a matching trigger configured in the GTM UI. When gtag.js is loaded *by*
GTM, whether it picks up those `gtag('event', ...)` calls depends on how the
container is configured, and the container cannot be inspected from the repo.

Two ways this goes wrong, both silent:

1. **Conversions stop being recorded.** The site keeps working, GA4 keeps
   showing pageviews, and only the events that tell you which marketing works
   quietly disappear. `scripts/main.js:14` documents this exact failure mode
   happening once already with Vercel Analytics.
2. **Pageviews double.** If GTM's GA4 tag fires its own pageview and the
   queued `gtag('config')` fires another, every number doubles.

The saving is real but modest: the script is deferred until first interaction
or 3.5 seconds, so it does not delay the page appearing. It costs data, not
speed. That is not worth risking your conversion data on a guess.

## How to remove it safely

Needs 10 minutes and access to the GTM and GA4 UIs.

1. In GTM, check whether the container has a **GA4 Configuration tag** for
   `G-VWQNS4KFSX`, and whether anything else lives in the container.
2. Open GA4 **DebugView**, and load the site with the Google Analytics
   Debugger extension on. Note exactly what fires on load, then click a
   tracked button (anything with `data-track`, such as Book a Call) and note
   the event.
3. Delete the `gaScript` block in `src/layouts/BaseLayout.astro` (the four
   lines creating and appending it), keeping the GTM block below it.
4. Deploy to a **preview** URL, not production.
5. Repeat step 2 against the preview. You need to see: exactly one `page_view`,
   and your click event still arriving.
6. If the click event does not arrive, either restore the direct load, or add
   a **Custom Event trigger** in GTM for the event name plus a GA4 Event tag
   that forwards it. Then re-test.
7. Only merge once step 5 passes.

If it passes, the page drops roughly 185 KB per visit, which on Ghanaian
mobile data is worth having.
