**Quadem Digital: business and conversion audit**

16 September 2026. Website: https://quademdigital.com/

The largest commercial risk I see is that the site asks buyers to pay premium prices before giving them enough relevant evidence to feel safe. It also sells a very broad range of work from one person, makes several inconsistent promises, and has tracking that can overcount enquiries. These are plausible causes of lost sales and weak margins. Their actual financial effect needs traffic, sales and delivery-cost data.

This audit inspected current public HTML, destinations of sales links, the deployed JavaScript and relevant local source. It covered the homepage, services index, web design, SEO, video, Fieldwork, portfolio, Omek case study, international page, contact, offers, about, terms, robots and sitemap. No website changes, bookings, form submissions or messages were made. Browser access was unavailable, so mobile appearance, keyboard behaviour, interactive geo pricing and successful enquiry delivery remain unverified. The PageSpeed API returned a quota error; no fresh Lighthouse or Core Web Vitals score is claimed.

**Priority order**

| Priority | Finding | Evidence status | Likely business consequence |
| --- | --- | --- | --- |
| Immediate | International page contains an unfinished proof block and wrong payment frequency | Confirmed in live HTML | Lost trust and incorrect price expectations |
| Immediate | Specific case-study promises lead to the general portfolio | Confirmed by following all three links | Buyers cannot verify the claims used to close them |
| Immediate | Lead tracking can count the same enquiry twice | Confirmed in deployed JavaScript | Misleading conversion counts and campaign decisions |
| High | Premium positioning is supported mostly by technical work and founder assurances | Confirmed content; commercial effect is a hypothesis | Price resistance and lower close rates |
| High | Seven services and multiple products compete for attention | Confirmed content; commercial effect is a hypothesis | Unclear fit, fragmented demand and delivery load |
| High | Booking calls to action frequently lead to enquiry forms | Confirmed destinations; abandonment not measured | Extra friction for ready-to-book prospects |
| High | Discounts, free labour and broad revision promises expose margin | Confirmed offers; actual profitability unknown | More work per sale and weaker realised hourly earnings |
| Medium | Video production promises disagree between pages | Confirmed live copy | Uncertainty about client effort and what is included |
| Investigate | Some public responses are slow, but repeats are fast | Small direct-request sample | Possible first-visit loss; severity not established |

**1. Fix the international sales page first**

[The international page](https://quademdigital.com/global/) serves a proof card containing a developer TODO stating that its reel does not yet exist. This sits near the start of the page. The same page labels both the $1,500 video retainer and the $3,750 growth retainer as one-off purchases, although their descriptions clearly promise monthly delivery.

This is more than imperfect wording: a buyer evaluating the business encounters unfinished evidence and contradictory payment terms in the same visit. Remove the unfinished card until a truthful, relevant sample is ready. Make both retainers explicitly monthly everywhere they appear.

The local source explains the pricing failure: [global.astro](../src/pages/global.astro:172) recognises a billing cycle containing `month`, while the CMS also supports `/mo`. The homepage has a more complete normalisation function. Reuse one canonical interpretation for every price display. The unfinished card is at [global.astro](../src/pages/global.astro:337).

**2. Repair the evidence at the point of sale**

The web-design page promotes two specific stories, and the SEO page promotes a specific client acquisition result. All three links currently end at the generic portfolio:

| Link offered to the buyer | Observed final destination |
| --- | --- |
| `/projects/next-gen-ecommerce/` | `/projects/` |
| `/projects/revamping-online-store/` | `/projects/` |
| `/projects/brand-identity-local-seo/` | `/projects/` |

These are not 404s. They are promises of evidence that the destination does not fulfil. Replace each link with a relevant real study and ensure the accompanying claim is supported by that study. If no supporting study exists, remove the result claim.

Locations: [web-design.astro](../src/pages/services/web-design.astro:677) and [seo.astro](../src/pages/services/seo.astro:666).

**3. Earn the price with client evidence**

[Web design](https://quademdigital.com/services/web-design/) starts at $3,000 for a landing page and $7,500 for a five-page corporate site in the international price list. Those prices are not inherently wrong. The question is whether the buyer sees enough evidence to justify choosing Quadem at those prices.

The homepage leads quickly into a biography that stresses the business's newness and lack of years. The six featured projects include four marked internal; the two external storefronts are described as builds in progress. There was no published client-testimonial section in the homepage response inspected. Most visible outcome numbers describe product counts, shipped features or technical scores.

The [Omek study](https://quademdigital.com/projects/omek-storefront/) is stronger: it documents concrete commercial faults, explains the fixes and reports measured speed improvements. It also responsibly says that it cannot substantiate a sales uplift. Keep that honesty. Lead with this evidence, and collect a client-approved account of the practical difference made: fewer order problems, reduced staff time, improved enquiries or sales, with dates and measurement limits where available.

Move the founder story below relevant work. Describe direct responsibility and delivery standards without asking the buyer to compensate for inexperience. Retain the truthful internal-project labels. Add real customer comments only with permission.

**4. Give the business a clearer primary offer**

The [homepage](https://quademdigital.com/) promotes web development, branding, SEO, video, automation, lead research and social media. It also promotes software projects, with links to store-management and internal admin applications, before its featured work. The navigation sends visitors to QuadERP as well.

Breadth is visible; a specific ideal customer and urgent buying problem are less clear. For a business explicitly delivered by one person, this can also raise an unanswered capacity question. This is a positioning hypothesis, not evidence that a broad agency cannot work.

Test one primary customer/problem/offer combination for 30 days. Existing retail and storefront work makes a focused website-improvement offer for retailers a defensible candidate, but choose using actual close rates, margins and customer access. Put the supporting services beneath that offer. Move internal tools into project explanations with screenshots or demonstrations that show their value.

An illustrative direction, not a validated claim: “I fix the website problems that stop customers enquiring or buying.” Follow it with a defined audience, a real example, a scoped engagement and one clear next step.

Fieldwork is a useful internal model for stronger specificity: it explains who buys, what arrives, how the work is checked and who is not a fit. It discloses that client sales outcomes have not yet been reported. Use that level of clarity elsewhere.

**5. Make booking behave like booking**

The homepage hero's call-booking button targets `#contact`, a general enquiry form. Navigation and many price cards target `/contact/`, where a three-step form precedes the calendar. A buyer who has decided to book still has to locate the booking method.

Use one direct calendar destination or a stable calendar anchor for booking labels. Use an enquiry label where the destination is a form. Explain what the call covers and what the prospect will leave with. Keep WhatsApp as a clear alternative, particularly for local buyers.

The public Calendly URL returned HTTP 200 with a Calendly page title. This verifies a resolving destination, not available appointment slots or a successful booking. The wizard's early lead capture is a useful existing protection against abandonment at the budget step; preserve that protection when simplifying the journey.

**6. Protect margin before increasing lead volume**

The site advertises a [15% first-project discount](https://quademdigital.com/offers/web-dev-discount/) and [a free month of social management with a complete web package](https://quademdigital.com/offers/social-media-bonus/). The inspected offer pages do not clearly specify an end date, a delivery cap for the free month, or whether promotions can be combined.

The homepage also promises to keep refining a design until approval, while other areas describe bounded revisions. Even if project agreements ultimately limit scope, the sales copy can create expectations that are expensive to reverse.

The local video Starter package is GH₵1,800 per month for four videos and twelve branded posts, plus a calendar and one platform. That is GH₵112.50 of revenue per content item if allocated equally, before tool costs, planning, revisions, communication or posting. This is an illustration of delivery pressure, not a finding that the plan loses money.

For each offer, calculate collected revenue less direct tools, contractors and delivery cost, and record every founder hour. Include selling, onboarding, revisions and support. Set a contribution target, revision cap and minimum profitable engagement. Define promotion eligibility and scope. Prefer a bounded bonus or scoped paid diagnostic where free work is attracting low-intent enquiries.

**7. Resolve contradictory production promises**

[The video page](https://quademdigital.com/services/video-production/) describes AI production without a shoot or camera. The homepage video retainer asks the client to film phone clips monthly. The international page also describes phone-filmed production.

These can be legitimate separate services, but the site presents the homepage retainer as the same Starter plan. Decide whether filming is optional, required or a different package, then align the descriptions. A buyer should know what they must supply before booking.

The services index also summarises SEO using Google Ads and Meta Ads, while the SEO service page predominantly sells organic-search work. Separate ad management from SEO in the scope and navigation so enquiries are qualified correctly.

**8. Correct the measurement before judging conversion**

The deployed `BaseLayout` JavaScript contains two `generate_lead` calls for the contact wizard: one after early lead capture, tagged `stage: partial`, and one after final submission. A successfully completed wizard can therefore emit two events for one saved lead. `wizard_completed` is also emitted on submit before the network result is known.

The raw event count can overstate enquiries unless reporting filters or deduplicates it. I did not inspect the GA4/GTM reporting configuration and am not claiming that the current dashboard necessarily doubles its displayed total.

Use one event for successful unique lead creation, a separate event for enrichment/completion and a distinct failure event. Count saved lead IDs in the CRM as the source of truth. Track actual booked calls separately from calendar clicks. Reconcile qualified leads, attended calls, proposals, won work and collected revenue by source.

Source locations matching the deployed behaviour: [main.js](../src/scripts/main.js:569), [main.js](../src/scripts/main.js:1292), [main.js](../src/scripts/main.js:1325).

The repository also captures campaign cookies in `GlobalLayout`, but I found no equivalent first-landing capture in the ordinary layout. Verify attribution for campaigns landing directly on the homepage or service pages; this is a code-review concern rather than a demonstrated reporting failure.

**9. Investigate variable response speed without overstating it**

Direct public requests produced these time-to-first-byte measurements. They include network time and are not browser rendering metrics:

| Page/request | TTFB |
| --- | ---: |
| Homepage, first sample | 6.329 s |
| Homepage, later sample | 0.411 s |
| Homepage, immediate repeat | 0.441 s |
| Web-design service | 3.657 s |
| Video service | 3.582 s |
| SEO service | 2.903 s |
| Contact | 0.707 s |

The first homepage response reported `x-vercel-cache: MISS`. The fast repeats mean it would be misleading to describe the site as consistently taking six seconds to load. Investigate cache misses, cold starts and CMS response times, then measure actual mobile LCP, INP and CLS. The source does repeated CMS reads with a short per-instance cache, so server timing is a reasonable place to investigate rather than assuming images are the cause.

Basic search foundations were present: robots and sitemap returned successfully, and eleven inspected core HTML pages each had a description and one H1, with no page-level noindex meta tag observed. This does not establish indexation, rankings or search demand. Those require Search Console and real query data.

**Recommended work sequence**

1. **Next 48 hours:** remove unfinished proof; correct monthly labels; repair the three evidence links; make booking destinations match their labels; align video requirements; fix duplicate lead events.
2. **Next week:** put one relevant customer problem and the strongest truthful proof near the top of the homepage. Reduce competing product promotion. Define revision and promotion boundaries. Cost every package using actual hours.
3. **Next 30 days:** run one focused acquisition offer and record visits, unique enquiries, qualified enquiries, booked/attended calls, proposals, wins, collected revenue and delivery hours. Break these down by channel, service and market.

Low qualified traffic calls for an acquisition change. Traffic without enquiries calls for a relevance, trust or journey change. Enquiries without wins call for closer inspection of fit, price, proof, response time and sales conversations. Wins without profit call for scope and delivery changes. The website alone cannot identify which of those is currently the biggest loss, but the confirmed faults above should be removed before buying more traffic.
