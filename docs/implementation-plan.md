# Quadem Digital: Website Implementation Plan (Payload CMS)

*A step-by-step plan to infuse the credibility and copy changes into the site, mapped to your actual stack and data model.*

**Stack:** Payload CMS v3 on Next.js · SQLite (dev) / PostgreSQL (prod) · Lexical rich text · local media (S3 ready)
**Globals:** SiteSettings · Homepage · About · ContactPage · ServicesPage · ProjectsPage · QuadERPPage
**Key collections:** Stats · Testimonials · CaseStudies · Services · Offers · PricingPlans · CalculatorServices · Leads · Clients · EmailCampaigns · BlogPosts · Faqs · ProcessSteps · Webapps · Media

> **You're mid-build: use that.** Most tasks below are either (a) content edits in the Payload admin or (b) small schema additions to a global/collection. Where a task needs a new field or block, I've flagged it as **[schema]** so you can bake it in now rather than retrofit.

---

## Before you start

- [ ] **Branch it.** New Git branch (e.g. `credibility-refresh`) for any schema/component changes.
- [ ] **Use drafts.** Payload's draft/version system lets you stage content changes and preview before publishing: enable `versions: { drafts: true }` on the globals and collections you'll edit (Homepage, About, Testimonials, CaseStudies) if not already on.
- [ ] **Confirm the front-end binding.** Know which Next.js components read which global/collection, so a content change actually surfaces on the page.
- [ ] **Gather assets:** your name, founder photo (upload to `Media`), certification badges (later).

---

## Phase 1: Remove the fake signals (do first)

These damage trust more than empty space does. With a CMS, "remove" usually means unpublish/empty, not delete the structure.

### 1.1 The "0" stats counter → `Stats` collection
- **Action:** Either unpublish all `Stats` entries, or add a visibility toggle so the homepage hides the stats block when there's nothing real to show. Don't enter fake numbers.
- **[schema]** Add a `showStats` boolean to the `Homepage` global (or a `published` filter) so the front end conditionally renders the block only when real stats exist.
- **Done when:** No zero-counters render on the homepage.

### 1.2 Mock testimonials → `Testimonials` collection
- **Action:** Delete the Sarah Jenkins / David Chen / Emma Williams seed records. If they came from a seed script, remove them there too so they don't repopulate on the next migration/seed.
- **Action:** Make the homepage testimonials section conditional: render only if `Testimonials` returns ≥1 published entry.
- **Done when:** No placeholder testimonials or mock avatars appear anywhere.

### 1.3 Client logos & case studies → `CaseStudies` collection + `Media`
- **Action:** Remove or unpublish any `CaseStudies` entries and client logos that aren't real (the Osu boutique, electronics retailer, logistics startup, East Legon restaurant: unless any are genuinely yours).
- **Action:** Make the "Trusted by" logo strip and "Featured Work" grid conditional on real published records.
- **Done when:** Every logo and case study is real or gone.

---

## Phase 2: Insert the new credibility copy

Copy comes from the **Credibility Starter Kit** document. Body fields are **Lexical**: paste as rich text, not Markdown.

### 2.1 New hero → `Homepage` global
- **Action:** Update the hero headline + sub-headline fields with the new founder-led copy. Keep both CTAs.
- **[schema]** If the hero is free-text today, give it structured fields: `heroHeadline`, `heroSubheadline`, `primaryCta` (label + link), `secondaryCta`.
- **Done when:** Hero shows the new copy, editable from the admin.

### 2.2 "Why Quadem" trust row → `Homepage` global **[schema]**
- **Action:** Replace the deleted counter slot with a 3-card trust row (direct founder access / built for Ghana / results-focused).
- **[schema]** Add a `trustHighlights` array field (icon, title, description) to the `Homepage` global so the three cards are CMS-editable.
- **Done when:** Three trust cards render in place of the old stats, editable in admin.

### 2.3 Risk-reversal block → `Homepage` global **[schema]**
- **Action:** Add the "New agency. No risk to you." section.
- **[schema]** Add a `riskReversal` group (heading + Lexical body) to the `Homepage` global, with a toggle to retire it later once you have a track record.
- **Done when:** The block renders and is mobile-responsive.

### 2.4 About rewrite → `About` global
- **Action:** Replace the founder-story copy in the `About` global with the new version; insert your real name; keep the founder photo (`Media`).
- **Note:** If the homepage also shows an "about" teaser, point it at the same `About` global fields so you edit copy in one place.
- **Done when:** Both the homepage teaser and `/about` use the new copy with your real name.

---

## Phase 3: Rebuild "Our Work" proof (interim, until clients land)

### 3.1 Concept projects → `CaseStudies` collection **[schema]**
- **Action:** Add 1–2 concept projects, clearly labeled "Concept."
- **[schema]** Add a `projectType` select to `CaseStudies` with values `client` / `concept` / `self`, and surface a "Concept" badge on the front end so nothing implies a fake client relationship.
- **Done when:** Work section shows honest proof of skill, each item correctly typed.

### 3.2 Your own products as proof → `Webapps` collection
- **Action:** Feature QuadERP (and BrandEngine when ready) from the `Webapps` collection as evidence you build real software. Tie into the existing `QuadERPPage` global.
- **Done when:** In-house products are visible as credibility, not just "coming soon."

### 3.3 Certification badges → `Media` + `SiteSettings` **[schema]**
- **Action:** As you earn the free certs (Google Ads, Meta Blueprint, Google Analytics, HubSpot), upload badges to `Media`.
- **[schema]** Add a `certifications` array to `SiteSettings` (badge image + label + verify link) rendered in the footer/About.
- **Done when:** Only genuinely-earned badges display.

---

## Phase 4: Lead capture & conversion

### 4.1 Lead magnet with real email capture → `Leads` collection
- **Action:** Replace the vague "free audit" with a specific magnet ("10-Point Website Audit Checklist for Ghanaian Businesses"). Wire the form to **create a `Leads` record** via Payload's REST/local API (or the Form Builder plugin if you adopt it).
- **[schema]** Add to `Leads`: `source` (select: contact-form / lead-magnet / newsletter / calculator / whatsapp), `magnetRequested`, and `status` (new / contacted / qualified / won / lost) so the collection doubles as a lightweight pipeline.
- **Automation:** Add an `afterChange` hook on `Leads` to (a) email you a notification and (b) deliver the magnet / trigger the welcome sequence via your email tool (Brevo/Mailchimp/Resend).
- **Done when:** A submission creates a `Leads` record, notifies you, and auto-delivers the magnet.

### 4.2 Newsletter signup → `Leads` + `EmailCampaigns`
- **Action:** Connect the "weekly digital growth tips" block to create a `Leads` record (source = newsletter) and push the contact to your email platform. Use `EmailCampaigns` to plan/track sends.
- **Done when:** A test signup lands in `Leads` and your email list.

### 4.3 WhatsApp CTA → `SiteSettings`
- **Action:** Store the WhatsApp number (`+233530890302`) and a default pre-fill message in `SiteSettings` so every CTA pulls from one source. Keep it prominent on hero, services, and pricing.
- **Done when:** One-tap WhatsApp chat works site-wide and the number is editable in admin.

### 4.4 Pricing clarity → `PricingPlans` · `Offers` · `CalculatorServices`
- **Action:** Lead with the monthly plans (`PricingPlans`) as the primary story; relabel project figures as "starting from." Make sure the calculator (`CalculatorServices`) ends in a Calendly booking, and capture calculator completions as `Leads` (source = calculator).
- **Done when:** Pricing reads clearly and the calculator hands off to a booked call + a captured lead.

---

## Phase 5: Off-site credibility (parallel track)

### 5.1 Google Business Profile (external)
- **Action:** Create and fully optimise a profile for Quadem Digital (category, Accra/Greater Accra service area, photos, services, site link).
- **Done when:** "Quadem Digital" appears in Google Search/Maps with complete info.

### 5.2 Real social links → `SiteSettings`
- **Action:** Replace the placeholder `#` links with real, active profiles, stored in `SiteSettings` and pulled into header/footer.
- **Done when:** Every social icon links to a live, branded profile: no dead `#` links.

---

## Phase 6: QA, launch, iterate

### 6.1 Pre-launch checklist
- [ ] No fake stats, testimonials, logos, or case studies remain (check published **and** seed data).
- [ ] New hero, trust row, risk-reversal, and About copy live with your real name.
- [ ] Lead magnet, newsletter, and calculator each create a `Leads` record and fire notifications (test all three).
- [ ] WhatsApp + all CTAs work on mobile and desktop.
- [ ] No `#` placeholder links anywhere.
- [ ] Conditional sections correctly hide when their collection is empty (test with zero records).
- [ ] Fast load and correct layout on a phone.
- [ ] **Migrations:** schema changes applied cleanly to PostgreSQL prod (don't rely only on the SQLite dev DB) and media path/S3 config confirmed for production.

### 6.2 Launch
- **Action:** Run migrations against prod, merge, deploy, verify live matches the draft preview.

### 6.3 Ongoing: swap interim proof for real proof
- **Action:** As Founding Partner Program work goes live: add real `Testimonials`, flip `CaseStudies` from `concept` to `client`, and populate real `Stats`, flipping `showStats` on.
- **Done when:** Within ~6–8 weeks the site shows 2–3 real client results and concept items are retired.

---

## Sequence at a glance

| Priority | Phase | Main collections / globals | Time |
|----------|-------|----------------------------|------|
| 🔴 Today | 1: Remove fake signals | Stats, Testimonials, CaseStudies | 1–2 hrs |
| 🟠 This week | 2: New copy | Homepage, About | Half day |
| 🟠 This week | 3: Interim proof | CaseStudies, Webapps, SiteSettings | Half day |
| 🟡 Next | 4: Lead capture & pricing | Leads, EmailCampaigns, PricingPlans, CalculatorServices, SiteSettings | 1–2 days |
| 🟡 Parallel | 5: Off-site credibility | SiteSettings (+ external) | Ongoing |
| 🟢 Final | 6: QA, launch, iterate | migrations + all | Half day + ongoing |

---

## Schema additions summary (bake in now)

Since the CMS is still being built, add these while you're in the models: cheaper now than later:

- **Homepage:** `trustHighlights` array · `riskReversal` group · `showStats` toggle · structured hero fields.
- **CaseStudies:** `projectType` select (client / concept / self).
- **Leads:** `source` select · `magnetRequested` · `status` pipeline field · `afterChange` notification/email hook.
- **SiteSettings:** `certifications` array · WhatsApp number + default message · real social links.

---

*Copy for each section lives in the Credibility Starter Kit. One rule throughout: ship nothing that isn't true, including seed data, because the whole strategy collapses the moment a prospect catches one faked detail.*
