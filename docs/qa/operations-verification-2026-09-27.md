# Operational verification, 27 September 2026

The user requested work on the unverified proposal, portal, payment, campaign,
scheduled-report and GitHub-sync items from the website inventory.

## Released fixes

- Campaign delivery now reserves an attempt atomically in Postgres before any
  send. Concurrent clicks cannot claim the same campaign. Every batch requires
  provider message IDs. Failed or uncertain delivery remains reserved for manual
  reconciliation; it is not marked Sent and cannot be blindly resent. Test sends
  remain drafts. Delivery writes preserve unrelated campaign statistics.
- Proposal provisioning preserves one-off billing (duration 0) and the agreed
  currency, checks invoice totals and required details, serialises concurrent
  provisioning calls, and reports partial failures honestly. Live QA found the
  CMS duration minimum still rejected 0; that validation is now corrected.
- Client currency is stored explicitly, forwarded into onboarding and used for
  invoice defaults. An additive migration adds both live and version columns.
  Existing saved documents and historical onboarding snapshots were not rewritten.
- The portal now reads the client's visible journey steps, excluding internal
  steps. Mobile progress connectors stay inside their card. Operational headings
  are excluded from marketing word-reveal masks, which clipped invoice branding.
  Invoice payment instructions now use a readable matching palette.
- Invoice email uses the invoice's actual currency, escapes interpolated client
  text, checks provider acceptance, has a stable request key, and routes replies
  to ernest@quademdigital.com. A rejected send returns an error, not success.
- Settlement rejects invalid/non-finite amounts. Tests cover deposits, balances,
  replays, currency/amount mismatches, abandoned payments and failed writes.
- All three cron routes offer authenticated dry runs. Health alerts check email
  acceptance, and invoice reminders expose failed checkpoint writes and skip
  zero balances.

## Live evidence

QA proposal 3 was parsed successfully into editable details and six journey
steps. After review it created client 18 and invoice 7 (QD-2026-0001), with
GHS 10 as a test-only amount, 30 percent deposit and duration 0. The invoice is
labelled test-only, and no funds were submitted. It has no due date, keeping it
outside the reminder schedule. Records remain labelled QA operations 2026-09-27.

The real scheduler processed onboarding at 02:00 UTC without a manual queue run.
Documents 9/10 are valid application/pdf files; document 11 is the existing Word
setup format. Agreement extraction confirms one-off/no recurring fee wording.
Welcome and owner notification were delivered. The three new future QA messages
were first verified scheduled, then cancelled to avoid redundant test reminders.
Do not resend this completed QA run.

The original client 17 agreement is delivered. Its setup remains scheduled for
27 September 23:33 UTC and check-in for 3 October 23:33 UTC. Those schedules were
not modified. Future delivery has not yet been observed.

Portal login uses secure HttpOnly cookies and rejects unsigned cookies. The new
client sees its own invoice and visible journey, not the internal control step.
Nineteen browser assertions passed at 390 and 1440 pixels, with no application
errors. Both final mobile screenshots were visually inspected. This is Chromium
coverage, not every physical device or browser.

Paystack live checkout initialisation succeeded. No funds were submitted.
Verification returned abandoned/402 and left the QA invoice pending with zero
paid. Successful settlement is covered by isolated provider fixtures, not a
funded live payment.

Campaign 11 sent one message to Ernest, was delivered and recorded one delivered
contact in CMS statistics. It remains Draft with no sentAt. Subscriber 23 remains
Pending: the test did not alter marketing consent. The weekly report and repaired
invoice email were also confirmed delivered to Ernest.

The three cron dry runs returned 200. The health check correctly found older
suppression records for optin-test@quademdigital.com and automation@quademdigital.com.
Neither appears in active source recipients or the subscriber list. Their blocks
were retained; mailbox existence was not assumed. Existing Vercel cron schedules
remain daily 09:00 reminders, Monday 07:00 report and daily 08:00 health check UTC.
The available Vercel log query returned no historical cron rows; manual report
execution and the separate CMS scheduler were verified, not future Vercel runs.

## Release and checks

Website: dpl_9X5osLGpmJ1eevo2Ez91GXyCGoiV, READY at quademdigital.com.
CMS: 69ad61a2-c933-4bac-9684-59e535362604, SUCCESS.
Currency migration applied successfully. 63 regression tests, CMS typecheck,
production builds, 34 CMS smoke checks and release guards pass. The global guard
used its live URL because localhost was not running. An exploratory root-wide
TypeScript command crossed the separate CMS package boundary and reported its
existing alias/config errors; this is not represented as a passing global check.

The first CMS upload failed before replacing production because --path-as-root
removed the directory expected by Railway. The corrected absolute CMS path,
without that flag, built successfully. Use that layout for future uploads.

The user explicitly approved GitHub synchronisation on 27 September 2026.
All nine pending commits through d7138105 were successfully pushed to
quademagency-glitch/quademdigital, branch hero/page-hero-component. The earlier
automatic approval blocker is resolved; the branch now contains the deployed fixes.

Evidence: docs/qa/operations-verification-2026-09-27.json.
Browser checks: docs/qa/operations-browser-checks.py.
Private resumable state and login material are under /tmp/quadem-ops-*; do not
copy cookies, invoice access URLs or keys into the repository.
