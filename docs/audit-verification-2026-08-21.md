# Audit closure: what was checked, and how

**Verified:** 21 August 2026, against the live site.

The audit's own verification checklist, worked through item by item. This exists
so the list is not re-argued from commit messages later. A commit message says
what someone intended; this says what the running site does.

Two items could not be closed here, and both need Ernest rather than code. They
are at the bottom.

## How the money paths were tested without side effects

Three of these items are about things that cost money or create records, so
testing them naively would have put fake data into the business:

- **Form submission.** `/api/submit-form/` was intercepted in the browser and
  answered with a success response, so no Lead was created, no auto-reply was
  emailed and no nurture sequence started.
- **Analytics.** Requests to Google's collect endpoint were answered with a 204,
  the way Google answers them, so no fake conversion reached the reports. A 204
  rather than a dropped request matters: dropping makes GA4 retry, which looks
  like double counting.
- **Newsletter.** `/api/newsletter/` was intercepted the same way, so no
  subscriber was created.

## Closed

| Item | Result |
|---|---|
| Light mode | Toggle present and working; the hard-coded dark literals were swept onto tokens |
| Footer newsletter form | POSTs as JSON via fetch, page does not navigate. This was the F-02 bug: the footer form's class was never bound, so the browser did a native GET to a POST-only route |
| Homepage form reaches the CRM | Posts to `/api/submit-form/` with `source: homepage` |
| Service selection survives | Payload carried `services: ["web"]`, so the select is read rather than discarded |
| Invoice pages | `noindex` present in `src/pages/invoice/[id].astro` |
| Hero headline | Server-rendered as text, no `opacity: 0`, so it does not wait for React |
| Splash screen | Gone, no markers in the HTML |
| `generate_lead` | Fires on submit with `source: homepage` and `services: web` |
| WhatsApp clicks | Fire as `whatsapp_click` with `loc` and `page` attached |
| Exit popup | Arms after 8 seconds, links to `/offers/free-seo-audit/` |
| Contact wizard order | Step 1 services, step 2 name and email, step 3 budget. Identity is captured before the question people abandon on |
| Footer social links | Real profiles: `linkedin.com/company/quadem-digital`, `instagram.com/quadem_digital`, `x.com/quadem_agency`. Note the X handle differs from the others |
| Trailing slash | `/contact` returns 308 to `/contact/` |
| Link previews | `og:image` resolves, HTTP 200 |
| About page photo | Uses `founder-portrait`, not the mock |
| Case study metrics | Real and specific: 94 performance score, 151 products live, 6 core features, 100/100 SEO. No "100% Completed" |
| Logo marquee | Not rendered. It stays hidden until there are enough real logos, rather than showing a thin row that reads as no clients |

## Still open, both needing Ernest

**A live Paystack payment has never been tested end to end.** The two bugs that
stopped invoices being marked paid are fixed in code and the verifier now checks
amount, currency and reference reuse, but no real transaction has run through it
since. This needs a 1 cedi payment against a real invoice, then confirming the
invoice flips to `paid`. It is the one item on the list that cannot be proven
from the outside, and it is the one where being wrong costs an actual client
their money and your credibility at the worst possible moment.

**There are no testimonials.** The collection is empty, so the section correctly
hides itself rather than inventing anyone. The audit asked for three with real
names. That needs real clients to agree, which `docs/testimonial-outreach.md`
covers. Nothing in the code is blocking it.
