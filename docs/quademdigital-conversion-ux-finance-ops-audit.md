# Quadem Digital: Conversion, UX, Engineering, Finance & Operations Audit

**Site:** https://quademdigital.com · **Basis:** source review of `main` @ `4e5051d` · **Date:** 2026-08-10

> The live site was unreachable from the review environment, so this audit was performed
> against the source that generates every page rather than the rendered site. Every finding
> is traced to file and line so it can be verified directly. Items that depend on current
> **CMS content** (published testimonials, stats toggle, live pricing values, schema phone
> number) are flagged and need a look at production to confirm.

**Severity counts:** 6 critical · 6 high · 10 medium · 5 strengths

---

## 0. Triage: start here

| Ref | What breaks | Who it hits | Effort |
|---|---|---|---|
| F-01 | Light mode renders dark text on a near-black page; the choice persists in `localStorage` | Anyone who taps the ☀️ in the navbar | 15 min |
| F-03 | Homepage contact form skips the CRM, auto-reply and nurture sequence | Every lead converting on the homepage | 30 min |
| F-02 | Footer newsletter submits to a dead endpoint and lands the visitor on a 404 | Every list signup, every page | 10 min |
| F-07 | Paystack payments never mark the invoice paid: two independent bugs | Every client paying online | 45 min |

### Strengths to protect

1. **Won-lead automation**: contract, welcome pack and setup guide generated as real `.docx`
   and delivered on a 2h / 24h / 7-day stagger (`src/pages/api/client-won.ts`).
2. **Per-page WhatsApp messages** on the floating button (`BaseLayout.astro:275`).
3. **Mobile hero**: steps down cleanly across four breakpoints (`HeroSection.astro`).
4. **Edge-caching middleware**: correctly refuses to cache anything authenticated (`src/middleware.ts`).
5. **Brand Studio page**: the only page with proper conversion tracking. This is the pattern
   to roll out sitewide (`brand-studio.astro:254–300`).

---

## 1. Critical

### F-01 · Light mode makes the site unreadable, permanently, for that visitor

`:root[data-theme="light"]` (`src/styles/style.css:2815`) redefines `--bg-primary`,
`--bg-secondary`, `--bg-card`, but the tokens actually in use are `--bg-page` and
`--bg-surface` (`style.css:7`), which are never overridden. `body` uses `var(--bg-page)`
(`style.css:62`). Result: `#1a1a2e` text on `#050814` ≈ **1.2:1 contrast**.

The preference is persisted to `localStorage` (`main.js:602`), so one tap on the toggle, which sits beside "Book a Call" on every page: leaves the visitor with an unreadable site
on every future visit.

**Fix:** add `--bg-page` / `--bg-surface` to the light block (`#f8f9fc` / `#ffffff`) and delete
the three unread tokens. Then walk the whole site in light mode: the footer, pricing cards and
form fields carry hard-coded dark values. If that's more than an hour, remove the toggle until
it can be done properly.

### F-02 · The footer newsletter form is dead on every page

`BaseLayout.astro:253` uses `class="mini-newsletter-form"` with no `method`.
`main.js:323` binds `#newsletterForm || .newsletter-form`: neither matches. Native submit
issues a **GET** to `/api/newsletter`, which exports POST only (`api/newsletter.ts:7`) → 404.
On the homepage the `#newsletterForm` branch matches the *main* form, so the footer form is
never even a binding candidate.

**Fix:** `querySelectorAll('#newsletterForm, .newsletter-form, .mini-newsletter-form')` and bind
each (the current code binds one form only). Add `method="POST"` to both forms so a JS failure
degrades to a real submission.

### F-03 · Homepage leads bypass the CRM, auto-reply and nurture sequence

Two forms, two destinations. `/contact/` (`contact.astro:125`) and `/calculator/` post to
`/api/submit-form`, which saves a Lead to Payload, emails a notification, sends an auto-reply,
adds to the Resend audience and fires `lead.created` for the Day 1/3/7 nurture
(`api/submit-form.ts:118–136`).

The **homepage** (`index.astro:304`) and every CMS-built page (`[slug].astro:85`) post to
`https://formspree.io/f/xgobwrdw` instead: none of the five happen. The prospect hears nothing
until the Formspree email is noticed manually.

**Fix:** repoint both at `/api/submit-form` with `<input type="hidden" name="source">`. Keep
Formspree as a backstop for two weeks, then retire it (free tier caps at 50/month).

### F-04 · The homepage form discards its own qualifying answer

`index.astro:321` renders `<select name="service">`; `main.js:281–289` builds the payload from
`source, name, email, message, budget, services[]` and never reads `service`.

**Fix:** rename the field to `services[]`, or add `service: formData.get('service')`.

### F-05 · The H1 ships invisible and waits for React

`HeroHeadline.tsx:76` sets `opacity: isReady ? 1 : 0` with `isReady` initially `false`, so the
SSR HTML contains the H1 at zero opacity. It reveals only when the splash dismisses or a 2.5s
fallback fires (`HeroHeadline.tsx:36`). LCP is gated behind hydration, and if the bundle fails
or is blocked the headline never appears.

**Fix:** render at full opacity by default; make the reveal an enhancement that runs once
`isReady` flips.

### F-06 · A 1.8-second splash screen sits in front of every first visit

`main.js:528`: a fixed `setTimeout`, not a load gate. Stacked on top of F-05, that's ~2s of
self-inflicted delay before anyone can read the value proposition, on a site already built for
speed (Astro + edge caching).

**Fix:** delete it. If the brand moment matters, fade the mark over already-painted content.

---

## 2. Conversion & sales

### F-12 · No money event is tracked outside Brand Studio (High)

`trackEvent` (`main.js:6`) fires for calculator interactions, video plays, wizard steps and
portal logins (`main.js:692, 811, 883, 898`), and for nothing that represents money. No
`generate_lead` in GA4; no tracking on form submit, newsletter submit, WhatsApp click, Calendly
click or pricing CTA.

**Fix:** lift the Brand Studio delegated `[data-bs-event]` tracker into `main.js` as a global
click delegate; tag every CTA with `data-event` / `data-loc`; fire `generate_lead` on form
success and mark it a conversion. Track WhatsApp clicks with their originating page.

### F-11 · Exit-intent popup rarely fires and breaks its own promise (High)

`main.js:584–592` registers `mouseleave` with `{ once: true }` but gates it on a `canShow` flag
that flips at 20s: the first cursor exit inside 20s consumes the listener permanently. When it
does fire it offers a "free website audit" but links to `/contact/` rather than the existing
`/offers/free-seo-audit/` page (`BaseLayout.astro:295`).

**Fix:** unsubscribe inside the handler only after the popup shows; point the CTA at the offer
page; cut the gate to ~8s.

### F-18 · Contact wizard asks for budget before identity (Medium)

`contact.astro:144–194`: services → budget → name/email. Abandonment at step 2 leaves nothing.
Neither step 1 nor step 2 has a required field, so the qualification can be skipped entirely.

**Fix:** reorder to services → name/email → budget, submitting the lead at step 2 and patching
budget afterwards. Make step 1 genuinely required.

### F-16 · All social proof can be absent simultaneously (Medium)

Testimonials require `published === true` (`TestimonialsSection.astro:10`); featured work the
same (`FeaturedWork.astro:9`); stats default off (`index.astro:78`); the logo marquee needs
`clientLogos` (`SocialProof.astro:20`). The homepage can run hero → pricing with zero evidence
anyone has hired you. **Needs a production check.**

### F-19 · The strongest sales asset is optional and thirteenth on the page (Medium)

The risk-reversal block, *"if we don't deliver what we agreed, you don't pay"*, renders only
when CMS fields are set, and appears after the FAQ (`index.astro:255–268`).

**Fix:** move it directly under the hero as an unconditional one-line strip, and repeat it beside
the pricing table.

### F-17 · Fifteen sections, eleven CTAs, no single next step (Medium)

Both money-decision modules (calculator, pricing) land before the first testimonial.

**Fix:** move proof above price; collapse the four service promos into one four-card section;
pick one primary action and demote the rest.

### F-15 · "Transparent Pricing" whose fallback price is "Custom" (Medium)

`PricingSection.astro:19` returns `'Custom'`; static fallback tiers read `Custom`, `Custom`,
`Retainer`.

**Fix:** a real "from" number on every tier.

---

## 3. UX & interface design

**The motion budget is overspent.** Running at once on the homepage: splash screen, animated
gradient mesh, three parallax orbs, a 3D-rotated hero card on an 8s float loop, a headline
rotating every 2.8s, a synced background carousel, a logo marquee, scroll reveals on nearly every
block, button glows and a floating WhatsApp button. Cut the splash (F-06), the parallax orbs and
the hero float loop.

**The hero rotates through the service menu instead of making a promise.** "Websites / Brands /
Campaigns / Videos / Growth" on a 2.8s timer says *we do many things*. The tagline underneath: 
*"A founder-led digital studio in Accra. You work directly with the person building your brand"*: 
is far stronger and should be considered for the H1.

### F-20 · Four accessibility defects that also cost conversions (Medium)

- `pointer-events: none` on the whole hero content column (`index.astro:35`): the headline can't
  be selected or copied.
- FAQ accordion buttons have no `aria-expanded` (`FAQSection.astro:22`).
- The theme preference applies after `DOMContentLoaded` (`main.js:602`) → flash of dark on every
  load for light-mode users. Belongs in a blocking `<head>` script.
- The rotating headline sits inside `aria-live="polite"` (`HeroHeadline.tsx:90`) and changes every
  2.8s: screen readers announce a new word indefinitely. Mark it `aria-hidden` and give the H1 a
  static accessible label.

### Smaller items

- Homepage form success/error states render **above** the form; on mobile the confirmation lands
  off-screen and the visitor assumes failure.
- Invoice status renders raw from the database: clients see lowercase `pending`.
- The calculator's "Book a Strategy Call" jumps straight to Calendly, skipping the WhatsApp path
  most Ghanaian SME buyers prefer.
- FAQ search has no results count or empty state.

---

## 4. Engineering, performance & search

### F-22 · Open Graph image is a relative path (High)

`BaseLayout.astro:22` sets `ogImage = "/images/og-card.webp"`, emitted verbatim at `:103` and
`:110`. OG requires an absolute URL; WhatsApp, LinkedIn and Facebook enforce it. Link previews in
the channel this business actually sells through almost certainly render with no image.

**Fix:** `new URL(ogImage, Astro.site).href`. Verify with the LinkedIn Post Inspector and a real
WhatsApp share. Confirm `og-card.webp` exists at ≥1200×630.

### F-21 · `/brand-studio/` is not in the sitemap (Medium)

`sitemap.xml.ts:15–29` hand-maintains `staticRoutes`; the newest revenue page is missing.

**Fix:** add it now, then generate from a glob over `src/pages` excluding `/api/`, `/admin/`,
`/portal/`, `/invoice/`.

### Structured data left on the table

- Use **`LocalBusiness`** rather than `Organization`, with the Accra address and service area.
- Add **`FAQPage`** schema: the questions and answers are already in the CMS.
- ⚠️ The schema `telephone` falls back to the literal `1234567890` when the CMS field is blank
  (`index.astro:116`). **Verify what production is emitting.**

### Performance

Third-party scripts are correctly deferred until first interaction with a 3.5s fallback
(`BaseLayout.astro:315–366`): good practice, undermined by eager Ahrefs analytics in `<head>`
and by the splash screen (F-06). Pricing and calculator pages make two *sequential* third-party
calls before a price is correct (F-13/F-14).

---

## 5. Marketing & buyer behaviour

**Pick a voice.** The hero says "founder-led studio… you work directly with the person building
your brand"; About says "Hey, I'm the face behind Quadem Digital"; the auto-reply is signed "The
Quadem Digital Team" and the body copy runs on "we" and "our team". A buyer who notices concludes
*either they're smaller than they're pretending, or they're outsourcing my project*: both worse
than the truth. Commit to founder-led: first person throughout, name and face above the fold,
direct WhatsApp, and *"You'll always be talking to me."*

**The channel the site is built for is the one it can't measure.** WhatsApp float on every page
with per-page pre-filled messages, WhatsApp CTAs in pricing, contact and risk-reversal: the right
instinct for this market, and zero tracking on any of it (F-12).

**Too many doors for one operator.** Ten offers: five services, Brand Studio, QuadERP, the
calculator, three lead magnets, a newsletter. The concentration argument points at **Brand
Studio**: productized, recurring, one repeatable production process, already properly tracked.
Make it the flagship; everything else supports it.

**The blog doesn't feed the funnel.** No in-content CTA pattern, no post-to-service internal
linking, no lead magnet tied to any post. Add a topic-matched offer block to the end of every post.

---

## 6. Finance & cash collection

### F-07 · Paystack payments succeed and then fail on our side: twice (High)

1. `invoice/[id].astro:198` passes `documentId: invoiceData._id`. Payload's REST API returns
   `id`, not `_id`, so this is `undefined` and `verify-paystack.ts:8` rejects with a 400: **the
   client sees a verification error after the money has left**.
2. Even with a valid id, `verify-paystack.ts:48` PATCHes `status: 'Paid'` while
   `cms/src/collections/Invoices.ts:31` defines lowercase `pending | paid | overdue`. Payload
   rejects the value and the response is never checked.

**Fix:** use `invoiceData.id`, send `'paid'`, check the PATCH response and surface failures.
Confirm with a live 1-cedi transaction: item 1 is a high-confidence inference from Payload's REST
behaviour, not an observed error.

### F-08 · The verifier marks any invoice paid from any successful reference (High)

`verify-paystack.ts:30–50` checks only `data.status === 'success'`. It never checks the **amount**
against the invoice total, the **currency**, that the reference **belongs to that invoice**, or
that it **hasn't already been used**. One genuine 1-cedi reference can clear an invoice of any
size, repeatedly.

**Fix:** re-read the invoice server-side, recompute the total from its line items, require
`paystackData.data.amount === Math.round(total * 100)` and a matching currency, store the
reference on the invoice and reject reuse. Never trust an amount or id from the browser.

### F-09 · Client invoices are publicly readable and crawlable (High)

`lib/payload.ts:31` attaches the admin API key to all reads, so `/invoice/<id>` renders data the
CMS gates behind `read: Boolean(user)` (`Invoices.ts:16`) to anyone with the URL. No `noindex` on
the page (only `/portal/` and `/admin/campaigns/` have it) and `robots.txt` is `Allow: /`.
`invoiceId` is hand-typed, so URLs are enumerable. Exposed: client name, email, project, line
items, amounts.

**Fix:** add `noindex` + `Disallow: /invoice/` today. Then store a random UUID per invoice and
require it as `/invoice/<id>/?k=<token>`: same emailed-link experience, no enumeration.

### F-13 · Ghana pricing depends on a hard-coded rate and a free third-party API (Medium)

`main.js:945–968` pins GHS at `11.49` and calls `ipapi.co` on every pricing/calculator view
(free tier ≈1k/day), `return`ing on any non-OK response, so once the quota is hit, **every
Ghanaian visitor sees dollar prices** silently.

**Fix:** read `x-vercel-ip-country` server-side in the middleware and render the right currency in
the HTML: no client lookup. Use the existing `priceGHS` CMS field as the source of truth for
Ghana and USD elsewhere; stop converting entirely. Nothing goes stale, and you can price for the
local market rather than translating dollars into it.

### F-14 · Prices visibly change while the buyer reads them (Medium)

Two client-side round trips mean `$2,500` becomes `GH₵ 28,725` mid-evaluation, making the price
feel provisional. The F-13 fix removes it.

### Commercial levers

1. **Make deposits structural.** The Invoices model has issue date, due date, tax rate and line
   items: no deposit, schedule or partial payment. A 50% deposit before work starts is the
   largest available improvement to cash timing and doubles as qualification.
2. **Nothing chases an overdue invoice.** The `overdue` status exists and nothing computes or acts
   on it. Resend is already wired up and the won-lead automation is a working scheduled-email
   pattern: reminders at day 3, 7 and 14 are an afternoon's work.
3. **Weight the mix toward recurring.** Brand Studio at GH₵ 1,800/mo is the only recurring line.
   Six clients ≈ GH₵ 10,800/mo of baseline that arrives regardless of project closes, which is
   what lets you decline bad-fit work and ask for deposits without fearing the answer.

---

## 7. Operations

**Credit first:** the lead-to-cash automation is genuinely strong: capture → Payload → auto-reply
→ audience → Day 1/3/7 nurture, then on `won` a hook converts to Client and generates a service
agreement, welcome pack and service-specific setup instructions as real Word documents on a
2h / 24h / 7-day stagger. Everything below protects this rather than replacing it.

### F-10 · Portal access codes can be brute-forced (High)

`api/login.ts:16–25` looks up `clients.accessCode` with no rate limit, no lockout and no failure
delay; the UI asks for a "6-digit code" (`portal/index.astro:139`). Behind it: client files,
timelines, invoices.

**Fix:** rate-limit by IP (5 attempts → 15-minute cooldown), lengthen codes to ~12 random
characters, add a fixed delay on failure.

### F-23 · Every failure in the lead pipeline is silent (High)

`api/submit-form.ts:58, 92, 125, 135`: four failure paths, all ending in `console.error`. On
Vercel that's a log nobody reads. `lib/payload.ts:5` notes the CMS instance "was getting
overloaded by traffic bursts", so these failures are not hypothetical.

**Fix:** email yourself the raw submission on any failure in the lead path.

### The weekly reconciliation habit

Once F-12 lands, compare three numbers every Monday:

| Count | Where | A gap means |
|---|---|---|
| Form submit events | GA4 | Baseline: what visitors believe they did |
| Lead records created | Payload → Leads | Fewer than GA4 → submissions failing before they reach you |
| Contacts added | Resend audience | Fewer than Leads → nurture not starting for some leads |

Three numbers that should match. This check would have caught F-02 and F-03 the week they shipped.

### Response time needs a mechanism

The auto-reply promises 24 hours and nothing enforces it. Add a saved Payload view for leads with
status `new` older than 24h; check it daily.

### Single points of failure

One Resend key, one Paystack account, one Payload instance described in your own code as small and
overload-prone, one Vercel project, one person who knows how it fits together. The headcount can't
be fixed; the knowledge can. Write a one-page runbook: DNS, credentials by service, what to do if
the CMS is down, how to issue an invoice manually, and keep it somewhere a trusted person can
reach.

---

## 8. Thirty days, in order

### Day 1: stop the bleeding
1. Light-theme background tokens, or remove the toggle. `F-01`
2. Repoint homepage + CMS-page forms at `/api/submit-form` with a `source` field. `F-03 F-04`
3. Fix the newsletter selector; add `method="POST"` to both forms. `F-02`
4. Make the OG image absolute; verify with a real WhatsApp share. `F-22`
5. `noindex` on the invoice page + `Disallow: /invoice/`. `F-09`

### Week 1: get paid, and see what's happening
1. Fix the Paystack path (`id`, lowercase `paid`, check the response); live 1-cedi test. `F-07`
2. Add amount, currency and replay verification to the payment endpoint. `F-08`
3. Global click tracker + `generate_lead` conversion in GA4. `F-12`
4. Email alerts on lead-pipeline failures. `F-23`
5. Delete the splash screen; un-hide the headline. `F-05 F-06`

### Week 2: make the homepage argue better
1. Risk-reversal under the hero, unconditional. `F-19`
2. Fill every empty social-proof slot. `F-16`
3. Proof above price. `F-17`
4. Capture name/email at wizard step 2. `F-18`
5. A real "from" number on every tier. `F-15`
6. Fix the exit popup listener; point it at the SEO-audit offer. `F-11`

### Week 3: currency, search, small cuts
1. Server-side currency via `x-vercel-ip-country`; use `priceGHS` directly. `F-13 F-14`
2. Generate the sitemap from the filesystem; verify `/brand-studio/`. `F-21`
3. Add `FAQPage` + `LocalBusiness` schema; check the phone number isn't the placeholder.
4. Clear the four accessibility defects. `F-20`
5. Rate-limit and lengthen portal access codes. `F-10`
6. Cut the parallax orbs and hero float loop.

### Week 4: commercial, not technical
1. Commit to founder-led voice everywhere; rewrite the auto-reply signature. `§5`
2. Deposit and payment-schedule fields on invoices; terms on the document. `§6`
3. Overdue-invoice reminder job on the existing Resend pattern. `§6`
4. Topic-matched offer block at the end of every blog post. `§5`
5. First weekly reconciliation. Write the runbook. `§7`

### How you'll know it worked

By day 30 you should be able to answer four questions you cannot answer today:

- How many people click the WhatsApp button, and from which page?
- How many form submissions become Lead records?
- How many invoices get paid online without you chasing?
- Which page produces the enquiries you actually want?

Everything in the plan either fixes a leak or makes one of those four visible.
