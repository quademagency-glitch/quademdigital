# Google Analytics was downloaded twice

**Measured:** 2026-08-21, live homepage.
**Removed:** 2026-08-21. This is kept as the method for re-checking it.

The page loaded `gtag.js` directly and also loaded Google Tag Manager, which
loads its own copy of `gtag.js` for the same GA4 property. Both appeared in the
network log:

```
562 KB  googletagmanager.com/gtag/js?id=G-VWQNS4KFSX
315 KB  googletagmanager.com/gtm.js?id=GTM-5CPTKQDB
562 KB  googletagmanager.com/gtag/js?id=G-VWQNS4KFSX&cx=c&gtm=4e68j1h2   <- loaded by GTM
```

Compressed, the direct load alone was 184 KB per visit, out of a 1,112 KB page.

## The numbers were never wrong

Worth stating plainly, because it is the scarier possibility: this was **not**
inflating visitor counts. Only one pageview was ever recorded per visit. It was
wasted download, not bad data.

## Why it took measuring to remove

Deleting the direct load looks free. It was not.

`src/scripts/main.js:26` reports every conversion with:

```js
window.gtag('event', eventName, eventData);
```

That is a gtag.js pattern. The GTM pattern is `dataLayer.push({event: '...'})`
with a matching trigger configured in the GTM UI. Whether GTM's copy of gtag.js
picks up those `gtag('event', ...)` calls depends on how the container is
configured, and the container cannot be inspected from the repo. Two ways it
could have gone wrong, both silent:

1. **Conversions stop being recorded.** The site keeps working, GA4 keeps
   showing pageviews, and only the events that tell you which marketing works
   quietly disappear. `scripts/main.js:14` documents this exact failure mode
   happening once already with Vercel Analytics.
2. **Pageviews double.** If GTM's GA4 tag fires its own pageview and the queued
   `gtag('config')` fires another, every number doubles.

## How it was settled

Neither guessing nor a staged deploy. The live site was loaded in a real browser
twice, once as it was and once with the direct script blocked, and what GA4 was
actually sent was compared. Requests to the collect endpoint were answered with
a 204, the way Google answers them, so the probe never reached the real
property and no fake events landed in the reports. A 204 rather than an abort
matters: aborting makes GA4 retry, which looks like double counting.

The result was identical either way:

| | as it was | direct script blocked |
|---|---|---|
| page_view | 1, `tid=G-VWQNS4KFSX` | 1, `tid=G-VWQNS4KFSX` |
| a `data-track` click | `whatsapp_click`, `ep.loc=risk-strip`, `ep.page=/` | same |

Both copies read the same `window.dataLayer`, which is why the queue stub in
`BaseLayout.astro`'s head still works with the direct load gone.

## Re-checking it

If conversion tracking ever goes quiet, this is the first thing to test, because
a container change could break the arrangement without touching the repo.

1. Open the site with the Google Analytics Debugger extension on, or watch the
   network panel for requests to `analytics.google.com/g/collect`.
2. On load you should see exactly one with `en=page_view`.
3. Click anything carrying a `data-track` attribute, such as the WhatsApp
   button. You should see a second request with `en=` set to that event name.

If step 3 produces nothing, either restore the direct load in
`BaseLayout.astro`, or add a Custom Event trigger in GTM for the event name
plus a GA4 Event tag that forwards it.
