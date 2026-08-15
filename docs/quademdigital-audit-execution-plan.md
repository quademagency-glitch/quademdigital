# Implementation Plan — Conversion, Payment & UX Fixes

Companion to `docs/quademdigital-conversion-ux-finance-ops-audit.md`. That document explains
*why*; this one is the work order. Findings are referenced as `F-xx`.

**How to use this:** the phases are ordered so each one is independently shippable. Every task
has an exact file, the current code, the replacement, and a verification step. Don't batch
phases into one commit — if something regresses you want to know which fix did it.

**Baseline:** `main` @ `4e5051d`. Node ≥ 22.12, `pnpm install`.

---

## Phase 0 — Decide one thing first

**F-01 (light mode) needs a decision before any code gets written**, because the two options are
very different amounts of work.

The light theme is broken because `:root[data-theme="light"]` redefines the *text* tokens but not
the *background* tokens, so you get `#1a1a2e` text on `#050814` — about 1.2:1 contrast. The token
fix is five lines. The problem is what's underneath it:

| Where | What's there | Count |
|---|---|---|
| `src/styles/style.css` | Hard-coded dark hex (`#1a1a24`, `#050814`, `rgba(9,9,15,…)`) | ~21 |
| `src/styles/style.css` | `rgba(255,255,255,0.0x)` raised surfaces — invisible on a light ground | ~25 |
| 20 `.astro` files | Inline `rgba(0,0,0,0.2)` fields, `color: white`, `#1a1a24` panels | ~60 |

None of that responds to a token change. Fixing light mode *properly* is a sweep of roughly 100
touchpoints across 21 files, and it needs a browser to verify.

### Option A — Remove the toggle (recommended for today)

Ten minutes, zero risk, and it stops the damage immediately. A missing feature costs nothing; a
feature that makes your site unreadable costs you the visitor permanently, because the choice is
written to `localStorage` and survives their next visit.

1. Delete the toggle button — `src/layouts/BaseLayout.astro:169`.
2. Delete `initThemeToggle()` — `src/scripts/main.js:597–621` — and its call at `main.js:32`.
3. Add a one-line migration so people already stuck in light mode get released. In
   `BaseLayout.astro`, inside `<head>`, before any stylesheet:

   ```html
   <script is:inline>
     try { localStorage.removeItem('quadem-theme'); } catch (e) {}
     document.documentElement.removeAttribute('data-theme');
   </script>
   ```

   Leave this in for a couple of months, then remove it.
4. Leave the `:root[data-theme="light"]` CSS in place — it's inert once nothing sets the attribute,
   and it's the starting point for Option B later.

### Option B — Fix light mode properly (schedule as its own piece of work)

Do this when you have a half-day and a browser open. The method matters more than the diff:

1. **Define every background token in both themes.** Note that `--bg-primary`, `--bg-secondary`
   and `--bg-card` are currently used in six places in `style.css` but are *only* defined in the
   light block — so in dark mode (your default) they resolve to nothing. Fixing that is worth
   doing regardless of which option you pick.

   ```css
   :root {
     --bg-page: #050814;
     --bg-surface: #0a0f25;
     --bg-primary: #050814;      /* add — currently undefined in dark */
     --bg-secondary: #0a0f25;    /* add */
     --bg-card: #0a0f25;         /* add */
     --surface-raise: rgba(255, 255, 255, 0.03);
     --surface-sunken: rgba(0, 0, 0, 0.20);
     --field-bg: rgba(0, 0, 0, 0.30);
     --field-text: #ffffff;
   }

   :root[data-theme="light"] {
     --bg-page: #f8f9fc;
     --bg-surface: #ffffff;
     --bg-primary: #f8f9fc;
     --bg-secondary: #eef0f5;
     --bg-card: #ffffff;
     --text-primary: #1a1a2e;
     --text-muted: #5a5a7a;
     --border-color: rgba(0, 0, 0, 0.1);
     --surface-raise: rgba(0, 0, 0, 0.035);
     --surface-sunken: rgba(0, 0, 0, 0.05);
     --field-bg: #ffffff;
     --field-text: #1a1a2e;
   }
   ```

2. **Sweep the literals into tokens.** Every `rgba(255,255,255,0.0x)` background becomes
   `var(--surface-raise)`; every `rgba(0,0,0,0.2)` form field becomes `var(--field-bg)`; every
   `color: white` on a field becomes `var(--field-text)`. Work file by file from the table above,
   largest first: `contact.astro` (11), `calculator.astro` (9), `campaigns.astro` (7).

3. **Verify in a browser, page by page**, in both themes. Pay attention to the footer (it pins a
   dark background in light mode by design), the pricing cards, and every form field — dark text
   in a dark field is the failure mode to watch for.

> **Decision:** Option ☐ A ☐ B — pick before starting Phase 1.

---

## Phase 1 — Stop the lead leak (half a day)

### 1.1 · Newsletter form is dead sitewide (F-02)

The footer form's class is `mini-newsletter-form`; the JS binds `.newsletter-form`. It never
matches, so the browser does a native **GET** to a POST-only route and your subscriber lands on a
404. The current code also only ever binds *one* form per page.

**`src/scripts/main.js`** — replace `initNewsletter()` (line 322) so it binds all of them:

```js
function initNewsletter() {
    const forms = document.querySelectorAll(
        '#newsletterForm, .newsletter-form, .mini-newsletter-form'
    );

    forms.forEach((form) => {
        if (form.dataset.initialized) return;
        form.dataset.initialized = 'true';

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btn = form.querySelector('button');
            const emailInput = form.querySelector('input[type="email"]');
            const originalText = btn ? btn.textContent : 'Subscribe';

            if (!emailInput || !emailInput.value) return;

            const check = isValidEmail(emailInput.value);
            if (!check.valid) {
                emailInput.setCustomValidity(check.reason);
                emailInput.reportValidity();
                setTimeout(() => emailInput.setCustomValidity(''), 3000);
                return;
            }
            emailInput.setCustomValidity('');

            if (btn) { btn.textContent = 'Subscribing...'; btn.disabled = true; btn.style.opacity = '0.7'; }

            try {
                const formAction = form.getAttribute('action');
                if (formAction) {
                    const response = await fetch(formAction, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                        body: JSON.stringify({ email: emailInput.value })
                    });
                    if (!response.ok) throw new Error('Subscription failed');
                }

                if (btn) btn.textContent = '✓ Subscribed!';
                form.reset();
                window.trackEvent?.('newsletter_subscribe', {
                    location: form.classList.contains('mini-newsletter-form') ? 'footer' : 'page'
                });
                setTimeout(() => { if (btn) btn.textContent = originalText; }, 3000);

            } catch (error) {
                console.error('Newsletter error:', error);
                if (btn) btn.textContent = 'Try Again';
                setTimeout(() => { if (btn) btn.textContent = originalText; }, 3000);
            } finally {
                if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
            }
        });
    });
}
```

Then add `method="POST"` to both forms so a JS failure degrades to a real submission rather than a
404 — **`src/layouts/BaseLayout.astro:253`** and **`src/pages/index.astro:243`**.

Finally, give `/api/newsletter` a `GET` export that redirects to `/` — belt and braces, so nobody
ever sees a raw 404 from a subscribe attempt.

**Verify:** subscribe from the footer on three different pages. You should stay on the page, see
"✓ Subscribed!", and receive the welcome email. Nothing should navigate.

---

### 1.2 · Homepage leads bypass the CRM (F-03, F-04)

The homepage and every CMS-built page post to Formspree, so those leads get no Payload record, no
auto-reply, no audience add and no nurture sequence. The homepage form also asks "Service
Interested In" and then discards the answer, because the submit handler never reads `service`.

**`src/pages/index.astro:304`**

```diff
- <form class="contact-form" id="contactForm" action="https://formspree.io/f/xgobwrdw">
+ <form class="contact-form" id="contactForm" action="/api/submit-form" method="POST">
+     <input type="hidden" name="source" value="homepage">
```

**`src/pages/index.astro:321`** — renaming the field is the whole fix for F-04; `main.js` already
collects `services[]` via `getAll()`:

```diff
- <select id="homeService" name="service" required>
+ <select id="homeService" name="services[]" required>
```

**`src/pages/[slug].astro:85`** — same treatment, with `value="cms-page"` as the source.

**Verify:** submit the homepage form. Confirm all four: a new row in Payload → Leads with
`source: homepage` and the service populated; a notification email to you; an auto-reply to the
address you used; the address appears in the Resend audience.

> Leave the Formspree endpoint live but unreferenced for two weeks in case something was depending
> on it. Then delete it — its free tier caps at 50 submissions/month, which is not a ceiling you
> want on your primary form.

---

### 1.3 · Link previews have no image (F-22)

`ogImage` is a relative path. Open Graph requires an absolute URL and WhatsApp, LinkedIn and
Facebook all enforce it — so links you paste into WhatsApp, which is where you actually sell,
render as bare text.

**`src/layouts/BaseLayout.astro`** — after line 23:

```ts
const ogImageUrl = new URL(ogImage, Astro.site ?? Astro.url).href;
```

Then use `ogImageUrl` in place of `ogImage` at **line 103** (`og:image`) and **line 110**
(`twitter:image`).

**Verify:** `curl -s https://quademdigital.com/ | grep 'og:image'` should show a full
`https://…` URL. Then paste a link into a WhatsApp chat with yourself and confirm the card
renders. Also confirm `public/images/og-card.webp` exists and is at least 1200×630 — WhatsApp is
strict about aspect ratio.

---

### 1.4 · Invoices are public and crawlable (F-09)

`src/lib/payload.ts:31` attaches your admin API key to every read, so `/invoice/<id>` serves data
the CMS gates behind authentication to anyone with the URL. There's no `noindex`, `robots.txt` is
`Allow: /`, and `invoiceId` is hand-typed so URLs are guessable.

**Part 1 — today (5 minutes).** In `src/pages/invoice/[id].astro`, add to the `<fragment slot="head">`:

```html
<meta name="robots" content="noindex, nofollow">
```

and in `public/robots.txt`:

```
Disallow: /invoice/
Disallow: /portal/
Disallow: /admin/
```

**Part 2 — this week.** Add an unguessable token so the URL can't be enumerated:

1. Add to `cms/src/collections/Invoices.ts`:
   ```ts
   {
     name: 'accessToken',
     type: 'text',
     admin: { readOnly: true, description: 'Auto-generated. Part of the invoice link.' },
     hooks: { beforeChange: [({ value }) => value || crypto.randomUUID()] },
   }
   ```
2. In `src/pages/invoice/[id].astro`, after loading `invoiceData`:
   ```ts
   const key = Astro.url.searchParams.get('k');
   if (!invoiceData.accessToken || key !== invoiceData.accessToken) {
     return Astro.redirect('/404');
   }
   ```
3. Update `src/pages/api/send-invoice-email.ts` to build links as
   `/invoice/<invoiceId>/?k=<accessToken>`.

Backfill tokens on existing invoices before switching the check on, or old links will break.

**Verify:** an invoice URL without `?k=` redirects to 404; the emailed link works.

**Commit:** `fix: stop lead and subscriber loss at the front door (F-02, F-03, F-04, F-09, F-22)`

---

## Phase 2 — Get paid (half a day)

### 2.1 · Paystack never marks the invoice paid (F-07)

Two independent failures in the same path. First, the page passes `invoiceData._id`; Payload's
REST API returns `id`, so this is `undefined` and the endpoint rejects it with a 400 — the client
sees a verification error *after* their money has left. Second, even with a valid id the endpoint
PATCHes `status: 'Paid'` while the collection defines lowercase `pending | paid | overdue`, so
Payload rejects the value — and the response is never checked, so it fails silently.

**`src/pages/invoice/[id].astro:198`**

```diff
- documentId: invoiceData._id,
+ documentId: invoiceData.id,
```

The rest is handled by the rewrite below.

### 2.2 · The verifier will clear any invoice from any reference (F-08)

It confirms a reference is a successful transaction, then marks the invoice paid. It never checks
the amount, the currency, whether the reference belongs to that invoice, or whether it's been used
before. One genuine 1-cedi payment reference can clear an invoice of any size, repeatedly.

First add a field to `cms/src/collections/Invoices.ts` to store the reference:

```ts
{ name: 'paystackReference', type: 'text', unique: true, admin: { readOnly: true } },
```

Then replace the body of **`src/pages/api/verify-paystack.ts`** from the Paystack verify call
onward:

```ts
const paystackData = await paystackRes.json();

if (!paystackRes.ok || !paystackData.status) {
    return json({ error: paystackData.message || 'Payment verification failed' }, 400);
}
if (paystackData.data.status !== 'success') {
    return json({ error: `Payment status is ${paystackData.data.status}` }, 400);
}

const baseUrl = import.meta.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';
const authHeaders = { 'Authorization': `users API-Key ${payloadToken}` };

// Re-read the invoice server-side. Never trust an amount that came from the browser.
const invoiceRes = await fetch(`${baseUrl}/api/invoices/${documentId}`, { headers: authHeaders });
if (!invoiceRes.ok) {
    return json({ error: 'Invoice not found' }, 404);
}
const invoice = await invoiceRes.json();

// Replay guard — a reference may only ever be applied once.
if (invoice.paystackReference && invoice.paystackReference !== reference) {
    return json({ error: 'This invoice already has a recorded payment.' }, 409);
}
if (invoice.status?.toLowerCase() === 'paid') {
    return json({ success: true, message: 'Invoice already marked paid.' }, 200);
}

// Recompute the expected amount from the invoice's own line items.
const subtotal = (invoice.items || []).reduce(
    (acc: number, item: any) => acc + (item.rate * item.quantity), 0
);
const total = subtotal * (1 + (invoice.taxRate || 0) / 100);
const expectedMinorUnits = Math.round(total * 100);
const expectedCurrency = (invoice.currency || 'USD').toUpperCase();

if (paystackData.data.amount !== expectedMinorUnits) {
    console.error(
        `Payment amount mismatch on ${documentId}: ` +
        `paid ${paystackData.data.amount}, expected ${expectedMinorUnits}`
    );
    return json({ error: 'Payment amount does not match the invoice total.' }, 400);
}
if ((paystackData.data.currency || '').toUpperCase() !== expectedCurrency) {
    return json({ error: 'Payment currency does not match the invoice.' }, 400);
}

// Everything checks out — record it, and confirm the write actually landed.
const patchRes = await fetch(`${baseUrl}/api/invoices/${documentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ status: 'paid', paystackReference: reference })
});

if (!patchRes.ok) {
    console.error('Invoice PATCH failed:', await patchRes.text());
    return json({
        error: 'Payment received but the invoice could not be updated. Please contact us.'
    }, 500);
}

return json({ success: true, message: 'Payment confirmed.' }, 200);
```

with a small helper at the top of the file:

```ts
const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
```

> Note the deliberate asymmetry: a *failed write after a successful payment* returns a 500 with a
> message telling the client to contact you, because that is a case a human must resolve. Silence
> is the one outcome that isn't acceptable.

**Verify — do this with real money before sending another invoice.** Create a test invoice for
GH₵ 1 and pay it end to end. Confirm the status flips to `paid` in Payload and the reference is
stored. Then try to replay: POST the same reference against a different `documentId` and confirm
you get a 409 or an amount-mismatch 400.

**Commit:** `fix: make Paystack payments actually settle invoices, and verify them (F-07, F-08)`

---

## Phase 3 — See what's happening (half a day)

### 3.1 · Track the events that represent money (F-12)

You have a `trackEvent` helper wired to GA4 and Vercel. It fires for calculator interactions,
video plays and portal logins — and for nothing that represents revenue. There's no
`generate_lead` in GA4, and no data at all on WhatsApp clicks, which is the channel you designed
the whole site around.

The Brand Studio page already does this correctly (`brand-studio.astro:254–300`). Lift that
pattern to the whole site.

**`src/scripts/main.js`** — add a delegated click tracker and call it from `initAll()`:

```js
function initClickTracking() {
    if (window._clickTrackingBound) return;
    window._clickTrackingBound = true;

    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-event], .whatsapp-float, a[href*="wa.me"], a[href*="calendly.com"]');
        if (!el) return;

        const href = el.getAttribute('href') || '';
        let name = el.getAttribute('data-event');
        if (!name && href.includes('wa.me')) name = 'whatsapp_click';
        if (!name && href.includes('calendly.com')) name = 'calendly_click';
        if (!name) return;

        window.trackEvent(name, {
            cta_location: el.getAttribute('data-loc') || undefined,
            page: window.location.pathname,
        });
    });
}
```

Then fire the conversion itself. In `initContactForm()`, on a successful response:

```js
window.trackEvent('generate_lead', {
    source: data.source || 'unknown',
    services: (data.services || []).join(','),
    budget: data.budget || undefined,
});
```

Tag your CTAs as you go — `data-event="book_call"` `data-loc="hero"` on the hero primary,
`data-loc="nav"` on the navbar button, and so on. The WhatsApp float and Calendly links are picked
up automatically by the selector above.

Finally, in GA4: Admin → Events → mark `generate_lead` as a **key event**. Without that step it
won't show up as a conversion.

**Verify:** with GA4 DebugView open, click the WhatsApp float, submit a form, and click a pricing
CTA. All three should appear within seconds.

### 3.2 · Stop losing failures to the logs (F-23)

Every failure path in `src/pages/api/submit-form.ts` (lines 58, 92, 125, 135) ends in
`console.error`. On Vercel that's a log nobody reads — a lead can fail to save and you'll never
know. Your own note in `src/lib/payload.ts:5` says the CMS instance was getting overloaded by
traffic bursts, so this isn't hypothetical.

Add a helper to that file and call it from each `catch` and each `if (error)`:

```ts
async function alertOnFailure(resend: Resend | null, stage: string, detail: unknown, lead: unknown) {
    console.error(`[lead-pipeline] ${stage}:`, detail);
    if (!resend) return;
    try {
        await resend.emails.send({
            from: 'Quadem Digital <hello@quademdigital.com>',
            to: import.meta.env.ERNEST_EMAIL || 'ernest@quademdigital.com',
            subject: `⚠️ Lead pipeline failure at: ${stage}`,
            html: `<p><strong>Stage:</strong> ${stage}</p>
                   <p><strong>Error:</strong></p><pre>${escapeHtml(String(detail))}</pre>
                   <p><strong>Submission:</strong></p><pre>${escapeHtml(JSON.stringify(lead, null, 2))}</pre>
                   <p>The lead may not have been saved. Follow up manually.</p>`
        });
    } catch (e) {
        console.error('[lead-pipeline] alert email itself failed:', e);
    }
}
```

The point is that the raw submission travels with the alert — a lead that reaches you as an email
is recoverable, a lead that reaches a log file is gone.

**Verify:** temporarily point `PUBLIC_PAYLOAD_URL` at a bad host locally, submit a form, and
confirm you get the alert with the submission attached.

**Commit:** `feat: track conversion events and alert on lead pipeline failures (F-12, F-23)`

---

## Phase 4 — Speed and the hero (2 hours)

### 4.1 · Delete the splash screen (F-06)

`src/scripts/main.js:528` holds the page for a fixed 1.8 seconds. It isn't waiting for anything —
the page may be fully rendered. On mobile data in Ghana that's two seconds of self-inflicted delay
in front of your value proposition, on a site you built for speed.

1. Remove the `.loading-screen` markup — `src/layouts/BaseLayout.astro:136–141`.
2. Remove `initLoadingScreen()` (`main.js:512–532`) and its call at `main.js:18`.
3. Keep the `quadem:loaderdone` event firing immediately on load — `HeroHeadline.tsx` listens for
   it, and 4.2 keeps that path working:
   ```js
   document.body.classList.add('loader-done');
   document.dispatchEvent(new CustomEvent('quadem:loaderdone'));
   ```

### 4.2 · Stop shipping the headline invisible (F-05)

`HeroHeadline.tsx:76` renders the wrapper at `opacity: isReady ? 1 : 0` with `isReady` starting
`false` — so your H1 is in the server-rendered HTML at zero opacity, and only appears once React
has hydrated. If the bundle is slow, blocked or fails, the headline never appears at all.

Invert it: render visible, and let the reveal be an enhancement.

```diff
- const [isReady, setIsReady] = useState(false);
+ // Start visible. The reveal animation is an enhancement, never a gate on the H1
+ // being readable — if JS fails, the headline must still be there.
+ const [isReady, setIsReady] = useState(true);
```

If you want to keep the entrance animation, drive it from a separate `hasAnimated` flag that only
ever *adds* motion, and make sure the element's resting state is fully opaque.

**Verify:** load the homepage with JavaScript disabled. The headline must be readable. Then check
that Largest Contentful Paint in Lighthouse drops by roughly the 1.8s you removed.

### 4.3 · Trim the motion budget

Running at once on the homepage: animated gradient mesh, three parallax orbs, a 3D-rotated hero
card on an 8s float loop, a rotating headline, a synced background carousel, a logo marquee,
scroll reveals on nearly every block, and button glows. Cut the three that cost the most and add
nothing to the decision:

- Parallax orbs — `BaseLayout.astro:144–146` and `initParallax()` (`main.js:535–551`).
- The `heroFloat` animation — `HeroSection.astro:142`.
- The `backdrop-filter: blur(20px)` on the hero card (`HeroSection.astro:134`) is expensive on
  mid-range Android; test with it off.

**Commit:** `perf: remove splash screen, render hero headline immediately, trim motion (F-05, F-06)`

---

## Phase 5 — Make the page argue better (1 day)

These are content and ordering changes, not bug fixes. Sequence matters more than code.

1. **Promote the risk reversal (F-19).** Move `index.astro:255–268` to directly under the hero and
   make it unconditional — drop the `riskReversal?.heading || riskReversal?.body` guard and keep
   the current copy as the default. Render it as a one-line strip: *Clear scope · Weekly updates ·
   If we don't deliver what we agreed, you don't pay.* Repeat it beside the pricing table.

2. **Proof before price (F-17).** Move `<TestimonialsSection>` and `<FeaturedWork>` above
   `<PricingSection>` in `index.astro`. Both money-decision modules currently sit before any
   testimonial.

3. **Audit the proof slots (F-16).** All four can be empty at once. Check production: are
   testimonials `published: true`? Is `showStats` on? Are there `clientLogos`? If a slot is empty
   and you have nothing to put in it, replace it with process proof — the guarantee, the timeline,
   the fact that you answer personally. Never leave it blank.

4. **Reorder the contact wizard (F-18).** `contact.astro` currently asks services → budget →
   name/email, so everyone who hesitates at budget leaves you nothing. Change to services →
   name/email → budget, and fire the submit when step 2 completes, patching budget in afterwards
   if they finish. Also make step 1 genuinely required — nothing in steps 1 or 2 is required today,
   so the qualification can be clicked straight through.

5. **Fix the exit popup (F-11).** In `main.js:584–592` the `mouseleave` listener is registered
   `{ once: true }` but gated on a 20s flag, so the first cursor exit inside 20 seconds kills it
   permanently. Remove `{ once: true }` and unsubscribe inside the handler *after* the popup shows.
   Cut the gate to 8s. Point the CTA (`BaseLayout.astro:295`) at `/offers/free-seo-audit/` — it
   currently promises a free audit and delivers a generic contact form.

6. **Give every pricing tier a real number (F-15).** `PricingSection.astro:19` falls back to
   `'Custom'` under a heading that says "Transparent Pricing". Even a conservative "from" figure
   beats declining to answer.

---

## Phase 6 — Currency, search, accessibility (1 day)

### 6.1 · Move currency detection server-side (F-13, F-14)

`main.js:945–968` calls `ipapi.co` on every pricing view (free tier ≈1k/day) and `return`s on any
failure — so once you're over quota, every Ghanaian visitor silently sees dollars. The cedi rate
is also hard-coded at `11.49`, which goes stale on its own.

Vercel gives you the country on the request, free and instantly:

```ts
// src/middleware.ts
const country = context.request.headers.get('x-vercel-ip-country') || 'US';
context.locals.currency = country === 'GH' ? 'GHS' : 'USD';
```

Render the right currency in the HTML from `Astro.locals.currency`, and use the `priceGHS` field
your CMS already has as the source of truth for Ghana rather than converting. Two numbers you
control, no rate that can go stale, no third-party dependency, and no visible price swap while the
buyer is deciding. Delete `initDynamicPricing()` once this lands.

### 6.2 · Sitemap and schema (F-21)

- `src/pages/sitemap.xml.ts:15` — `/brand-studio/` is missing from the hardcoded `staticRoutes`.
  Add it, then replace the hand-list with a glob over `src/pages` filtering out `/api/`,
  `/admin/`, `/portal/`, `/invoice/`. A sitemap you have to remember to update will be wrong again.
- Change the homepage JSON-LD from `Organization` to `LocalBusiness` with your Accra address and
  service area.
- Add `FAQPage` schema to the FAQ section — the questions and answers are already in the CMS, and
  this is the cheapest expanded search result available to you.
- ⚠️ Check production first: the schema `telephone` falls back to the literal `1234567890` when
  the CMS field is blank (`index.astro:116`).

### 6.3 · Accessibility (F-20)

- Remove `pointer-events: none` from the hero content column (`index.astro:35`) and scope it to
  the decorative layer instead — right now nobody can select or copy your headline.
- Add `aria-expanded` to the FAQ accordion buttons (`FAQSection.astro:22`) and toggle it in
  `initFaqAccordion()`.
- Mark the rotating headline `aria-hidden="true"` and give the H1 a static `aria-label`
  (`HeroHeadline.tsx:90`) — it currently sits in an `aria-live` region and changes every 2.8s, so
  screen readers announce it forever.
- If you kept the theme toggle (Option B), move the stored-preference read into a blocking
  `<head>` script to kill the flash of dark on every load.

### 6.4 · Portal brute-force (F-10)

`src/pages/api/login.ts` has no rate limit, no lockout and no failure delay, against a 6-digit
code. Add IP rate limiting (5 attempts → 15-minute cooldown), lengthen new codes to ~12 random
characters, and add a fixed delay on failure so timing leaks nothing.

---

## Definition of done

Once Phases 1–3 are live you should be able to answer four questions you can't answer today:

- [ ] How many people click the WhatsApp button, and from which page?
- [ ] How many form submissions become Lead records? *(GA4 `generate_lead` vs Payload → Leads vs Resend audience — three numbers that should match. A gap tells you which segment of the pipe is leaking.)*
- [ ] How many invoices get paid online without you chasing?
- [ ] Which page produces the enquiries you actually want?

Run that three-number reconciliation every Monday. It's five minutes, and it would have caught
F-02 and F-03 the week they shipped.
