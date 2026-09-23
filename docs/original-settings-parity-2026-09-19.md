# Original website settings parity, 19 September 2026

Compared the original public website at https://quademdigital.com/ with the rebuild at http://127.0.0.1:4322/. Read all ten public Payload globals, the service/pricing/calculator/product/proof collections, and the thirteen enabled redirect rules. Opened the original and rebuilt pages in Chromium; compared rendered settings as well as source bindings. No live CMS changes, real form submissions, payments, emails, publishing or deployment were performed.

## Restored controls

| Original settings | Rebuild result |
| --- | --- |
| Site title and description | CMS title supplies the social site name and business schema. CMS description supplies the layout fallback; page-specific SEO overrides and original search descriptions retain priority. |
| Navigation labels, destinations and order | Desktop and mobile both render the CMS menu, including QuadERP. Local links preserve query strings and anchors. External links are never marked as the active local page. |
| Footer headings, links, column preference and tagline | All configured groups and links render; left groups precede right groups within the new four-column layout. Ghana offer visibility remains country controlled. |
| Email, address, WhatsApp number and default message | Read from Site Settings. Restored the global WhatsApp message override. Contact-page-specific wording remains independently editable. |
| Social platforms, labels and profile URLs | Shared renderer supports every configured platform and custom labels in the footer and contact areas. |
| Client logos and certifications | Original logo gate retained: four real client logos are required for the marquee; the current two stay hidden. Certification badges and verification links render only when configured; currently none. |
| Analytics | GTM, GA4, Ahrefs and Metricool identifiers match the original. Tawk remains managed through GTM. Analytics requests were blocked during browser tests to avoid audit traffic. |
| Homepage headline, tagline, supporting text, eyebrow, meta labels and CTA settings | CMS bindings restored within the reference composition. Tagline/supporting text appear in the raised hero; the pipe headline and service words form the cream introduction. CTA labels/links are editable again. Booking labels resolve to the real calendar anchor. |
| Homepage original service media | Four original CMS image links remain after the introduction. The Reels artwork, brand-filled typography and raised hero movement remain intact. |
| Homepage risk reversal, trust highlights, stats switch | Original heading/body and all three trust highlights restored. `showStats=false` remains respected; no fabricated counters. |
| Homepage service promotions | All seven render in CMS order with their headings, accent text, badges, body, CTA label/URL and corresponding original service artwork. Empty CTA labels suppress that CTA. |
| Founder content | Original About-global headline, biography and portrait restored, with the original homepage founder fields as fallbacks. |
| Products, published projects and testimonials | Both original product cards restored with cover images, status and destinations. Published-project filtering stays in place. Testimonials remain opt-in via `published=true`; currently none are published. |
| Homepage contact settings | Actual enquiry form restored at `/#contact`: editable headings, supporting copy, WhatsApp button, submit label and success message. All seven CMS services are selectable. Source attribution and unticked newsletter consent are preserved. |
| Homepage newsletter settings | CMS heading and supporting copy control the footer signup; the original `newsletterForm` hook and `/#newsletter` anchor are retained. The duplicate standalone newsletter section is consolidated into this signup. |
| About global | Title, headline, subheadline, founder name, biography, mission, vision, core values, portrait and SEO fields restored. |
| Services and Projects globals | Original titles/subheadings and SEO controls restored. Existing service content, pricing and published-project filters remain. |
| Contact global | Hero fields restored; original form labels, copy, success message, booking headings, booking visibility and Calendly URL remain connected. Disabled booking falls back to the contact area at `#book`. |
| Web Design, Brand Identity, SEO and Video globals | CMS hero badge/headline/subtitle/CTA labels restored. Other content, galleries, plans, features, FAQs and SEO bindings remain. The SEO hero's free-audit action again opens the original WhatsApp conversation. |
| Pricing, calculator and markets | Same CMS price lists, base currencies and billing cadence. Ghana visitors use the Ghana list in GHS; country selection remains available. `/calculator/` remains functional and the old `/#calculator` anchor reaches its link. International campaign exclusions remain intact. |
| Search, indexing and routing | Original titles, descriptions, social metadata, canonicals, icons, robots, sitemap and business/FAQ schema verified on the comparison routes. All forty sitemap URLs load; all thirteen redirects match status and destination. |
| Payments, banking, mail, webhooks and scheduled jobs | Existing invoice settings and backend routes remain. Bank values were not copied into audit evidence. Production secrets and provider-side delivery were not verifiable from the public site. |

## Deliberate design adaptations

MarketingLab layout, blue branding, original imagery, section motion, mobile process rail and reduced-motion support remain. The old theme switch and exit popup are not reinstated; the section palette and popup suppression were existing rebuild decisions, not lost CMS switches. The giant two-line `WEB DESIGN / AGENCY` display stays; CMS homepage wording controls the surrounding hero/introduction. The original cycling words now appear in the introduction and original-image gallery. Footer column preference controls group order in the new grid. Calculator and newsletter functionality are retained at the locations described above.

## Verification

- All 40 public sitemap URLs: HTTP 200, no server error pages. Sitemap and robots match the original.
- All 13 CMS redirects: expected status and destination.
- Eight original/rebuild page comparisons: homepage, Contact, Services, About, Projects, Web Design, SEO and Global. Titles, selected search/social metadata, canonicals, favicon links and price data match. All four specialized service hero bindings were checked separately.
- 42 browser assertions passed. Includes CMS menu/order, all seven promotions, both product cards, footer groups, proof gates, contact copy, unticked consent, 390px layouts, desktop navigation at 1024/1180px, and pointer-driven raised hero motion. No JavaScript runtime errors.
- Intercepted browser submissions verified homepage success, configured success copy, failure with answers preserved, retry availability and newsletter submission. Every POST was mocked or blocked; no real lead or subscriber was created.
- Homepage LocalBusiness and FAQ structured data match the original.
- 17 regression tests passed, including new query/anchor preservation and CMS promotion ordering/removal/CTA tests.
- Ten release guards passed. The global guard now accepts `PUBLIC_SITE_CHECK_ORIGIN`; it was explicitly rerun against `http://127.0.0.1:4322` and checked all five international funnel pages.
- Production build passed in 1m47s. Existing unused `docx` import warnings remain in the unrelated client-won endpoint.

Local configuration contains CMS and Resend API keys, but not `PAYSTACK_SECRET_KEY` or `RESEND_WEBHOOK_SECRET`. This does not establish whether production has those secrets. Payment processing, webhook signatures and real email delivery still need deployment-environment verification; the mocked form checks do not establish delivery.

Machine-readable evidence: [QA report](qa/original-settings-parity-2026-09-19.json).
Screenshots: [homepage](qa/original-settings-home-desktop.jpg), [mobile enquiry form](qa/original-settings-contact-mobile.jpg), [footer](qa/original-settings-footer.jpg). Temporary raw browser evidence: `/tmp/quadem-settings-audit/`.
