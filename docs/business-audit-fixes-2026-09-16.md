# Business audit fixes

Prepared 16 September 2026 for quademdigital.com. Changes are local until released.

## Website changes

- Replace the unfinished international proof card with the real Omek case study and its measurement limits.
- Share billing-frequency handling across price cards. `/mo` reads as monthly, including both international retainers.
- Replace three misleading case-study destinations with the actual Omek project or the clearly labelled independent search study.
- Put client work immediately after the homepage hero. Show three projects, with client work first, and keep internal-work labels.
- Focus homepage service sections on web design, SEO and automation. Link to the full services index and remove the separate internal-products block.
- Send booking buttons to `/contact/#book`. Include a direct calendar link if the embed fails.
- Capture campaign attribution across both layouts.
- Count a partially captured enquiry and its later completion as one lead. Count wizard completion only after a successful response. Prevent duplicate concurrent submissions, retain the captured lead after failure and reset correctly after success.
- Track confirmed embedded Calendly bookings separately as `call_booked`. Only accept messages from the actual Calendly iframe; do not send invitee details to analytics.
- Remove undated urgency labels and unsupported claims about doubling leads.
- Remove two unused homepage CMS requests. This reduces work per request; it is not a measured speed or revenue improvement.

## Prepared CMS changes

The dry run changes 12 documents. Prices stay the same. The exact content and safeguards are in [the CMS update script](../cms/scripts/fix-business-audit.mjs).

- Homepage: "Websites built for enquiries and sales." One service word, clear scope and fixed quote, a 15-minute booking CTA and a client-work CTA.
- Founder copy: explain direct involvement, reviewable progress and handover without emphasising lack of experience or inventing credentials.
- Main navigation: remove the external QuadERP product link.
- Services: lead with websites, clarify that the SEO service does not include paid advertising.
- Video: ask for logo and product photos, make filming optional, and remove the promise of free speculative videos.
- Retainer and revision wording: define a monthly task list and revision rounds in the proposal, with extra work quoted first.
- Social bonus: one platform, one month, up to 12 approved posts using supplied content with a Corporate Site or E-Commerce project. Exclude custom video, ads, ad spend and inbox management.
- 15% discount: new-client design and development fees only. Exclude hosting, domains, licences, ad spend and retainers. Confirm in writing before acceptance.
- Both promotions: no stacking; existing signed agreements keep their terms.

The script defaults to a dry run. Applying it writes a timestamped backup before mutations, checks for concurrent edits, preserves existing fields and verifies the saved content.

```sh
node --env-file=.env cms/scripts/fix-business-audit.mjs
node --env-file=.env cms/scripts/fix-business-audit.mjs --apply
node cms/scripts/smoke-test.mjs
```

## Verification and limits

Nine regression tests pass, covering billing aliases, lead deduplication, failed submissions and retries, concurrent submits, analytics failures and trusted booking events. Eight local routes returned HTTP 200. Targeted HTML checks confirmed the real evidence links, monthly cadence, calendar anchor and fallback, and the three homepage service sections.

The final production build, all ten `check:all` guards and `check:handoff` passed. Repository-wide `astro check` also found a backlog of type errors, mostly in CMS scripts and migrations. Two additional invalid component-attribute comments on service pages were corrected. A successful build is not a claim that the repository has no type errors.

No browser was connected for visual or interactive QA. No real enquiry, booking or email was sent. Actual Calendly availability, mobile appearance, analytics arrival and final enquiry delivery still require a browser smoke test.

The attempted Vercel preview was blocked by automatic approval review because uploading the repository to an external hosting service requires explicit permission in this session. No preview or production deployment was made, and the prepared CMS changes have not been applied.

## Measure after release

Record the release date. Compare weekly qualified enquiries per 100 sessions, booked calls, proposals, won projects and delivery hours. Separate traffic sources and markets. Track `generate_lead`, `enquiry_completed`, `enquiry_failed` and `call_booked`; do not add partial and completed lead events together.

Historical lead totals may be inflated by the old duplicate event. Use completed enquiries and CRM records to establish the baseline. Direct external Calendly bookings are not covered by the iframe event listener. Review after 30 days, allowing more time if enquiry volume is low. Do not infer profit improvement without delivery-hour and sales data.

Calendly event implementation reference: [official embed documentation](https://calendly.com/help/advanced-calendly-embed-for-developers).
