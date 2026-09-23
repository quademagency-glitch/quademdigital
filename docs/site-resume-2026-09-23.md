# Website review and form fixes, 23 September 2026

The user asked to resume all Quadem website work. The review covered public
layouts, motion, regional pricing, enquiry forms and the existing CMS/onboarding
implementation. The open real-email test still has no authorised recipient.

## Changes

- Native form return addresses now stay on the same site. Backslashes, control
  characters and dot-segment paths that would become external redirects are
  rejected. Success/error flags are set as query parameters while preserving
  the destination's other query parameters and anchor, and stale flags are removed.
- Contact-page success and error messages render on the server. Native returns
  preserve the selected service and reach the form anchor.
- Contact and service enquiry forms show all fields in their plain HTML. The
  wizard hides later steps only after its controls initialise. A disabled or
  failed script therefore leaves a usable native form, rather than inaccessible
  required fields and a hidden submit button.
- The mobile project-title/image fixes from the separate 23 September session
  are preserved and included in the reviewed release. See
  [the mobile featured-work report](mobile-featured-work-2026-09-23.md).
  Their new regression checks run with automatic motion enabled, including when
  the OS asks for reduced motion, matching the user's existing site preference.

The form changes touch submit-form.ts, contact.astro, main.js, style.css and
ServiceEnquiryForm.astro. No CMS schema or content changes were needed. No git
commit or push was made.

## Verification

| Check | Result |
| --- | --- |
| Unit/regression tests, including redirect bypasses and native form results | 37 passed, exit 0 |
| All ten repository guards | Exit 0 |
| Final combined Astro production build | Exit 0, 47.55 seconds |
| CMS TypeScript check | Exit 0 |
| Read-only CMS smoke checks | 34 routes OK, exit 0 |
| Form fallbacks, no JavaScript, blocked scripts and normal wizard navigation | 41 checks passed |
| Regional prices, calculators, geo/FX failures and navigation | 88 checks passed |
| Changed form pages at phone/tablet/desktop widths | 24 layout states passed |
| Navigation and form interactions after the changes | 39 checks passed |
| Animated project titles, thumbnail layout, About type and Pause/Resume | 41 checks passed |

The initial public-site review also covered 400 layout states on 40 routes,
92 compact-section checks, 39 interactions and 45 motion checks. Those earlier
checks did not detect the default-motion title-width collision, as explained in
the mobile featured-work report. The new default-motion test measures title width
and line count explicitly instead of treating absence of overflow as readability.

Browser testing uses Chromium, not every physical device or browser. All valid
form submissions are intercepted and analytics are blocked. The two actual local
API probes omit required identity fields and stop before any CRM/email work.
Mocked confirmations establish form behaviour, not actual delivery.

The old local preview on port 4322 returned 404. Testing moved to an owned preview
on port 4336 with the existing toolbar-free QA config. A developer-toolbar module
error then disappeared from the pricing suite. Form API probes were corrected to
include the Origin header a browser sends; without it Astro correctly returned 403.
Thumbnail tests measure layout offsets so an intentional scroll-entry transform
is not mistaken for a permanent image gap. All final checks above passed.

Evidence: [verification JSON](qa/site-resume-2026-09-23.json).
Portable checks: form-fallback-checks.py and featured-work-motion-checks.py in
docs/qa. The pricing harness now accepts PRICING_BASE and PRICING_OUT.

## Release and remaining delivery test

Vercel deployment `dpl_AmRTx9CoQX8Q4Wu5ooua9xnYZUw6` is READY and assigned
to https://quademdigital.com. Deployment URL:
https://quademdigital-gkfhemb28-quademagency-glitchs-projects.vercel.app

The reviewed source snapshot stayed unchanged through upload and verification.
The remote production build completed successfully. Live browser verification
is recorded in the accompanying evidence once it completes.

The upload excludes credentials, private media, assistant settings, audit reports
and test files. The included CMS environment example is documentation only.

No real enquiry, client, onboarding document or email was created. An explicitly
approved inbox and authorisation for labelled QA records are still required to
test actual enquiry/onboarding delivery. Provider acceptance, scheduled delivery
and receipt in the inbox must be reported separately. The minor heading-height
change during motion initialisation remains documented in the separate mobile
report; it was not changed by the form work.
