# CMS wiring fixes, 20 September 2026

The completed production deployment and live verification are recorded in
[the 21 September release report](cms-release-preflight-2026-09-21.md).
All three migrations applied and the CMS callback URL is corrected.

The five issues in [the audit](cms-wiring-audit-2026-09-20.md) are repaired and
deployed. A controlled live inbox delivery test still needs an approved recipient.

## Lead capture

The initial capture returns a signed, 24-hour token bound to that lead ID and
normalized email. The final details require that token before the server uses
its CMS API key. Missing, expired or altered tokens return 403 without a write.
The signing secret is the existing shared `CMS_WEBHOOK_SECRET`, domain-separated
for this purpose; it must contain at least 16 characters.

An unsuccessful CMS update now returns 502, or 503 for missing configuration.
The browser retains the same lead ID, token and entered details so retry updates
that record. Tokens are redacted from pipeline alerts and responses are not
cached. Forms already open during deployment need a refresh to use the new
token protocol.

## Won clients and onboarding

Won-lead conversion sets the client pipeline to Won and preserves the enquiry
context. It does not invent the agreed service, price or start date. Missing
details appear as **Review needed** on the client. Saving the required details
queues onboarding; a complete proposal-created client uses the same workflow.

The client save queues a `clientOnboarding` job in the same database transaction.
The existing five-minute worker starts after the client commits. Per-client
concurrency prevents simultaneous runs. Three private documents are saved before
five emails are submitted: welcome, agreement, setup, check-in and owner notice.

Every step retains its request key, result and failure in the client record.
**Onboarding delivery** shows the current state; **Delivery details** retains
document IDs, provider IDs and scheduling times. **Retry incomplete onboarding**
queues a continuation, skipping completed steps. Document keys are unique, and
email retries use the same provider idempotency key and payload. Ordinary editor
saves cannot overwrite the worker's delivery checkpoints.

Email API errors and missing confirmations are failures, including responses
from an incompatible older frontend. Provider acceptance is distinguished from
inbox delivery. Document dates are written only after the corresponding emails
are accepted. A failure while saving those dates can be retried without
resending. Inbox outcomes remain available through Resend's delivery history;
the onboarding status does not claim that recipients received the messages.

An uncertain send older than 23 hours stops for manual reconciliation against
the recorded key; it is never blindly resent. This leaves a margin before
[Resend's 24-hour idempotency retention](https://resend.com/docs/dashboard/emails/idempotency-keys).
If a request was rejected before acceptance and its original scheduled time
has passed, reconcile it instead of changing a possibly accepted request's
payload. Client details are frozen when a run begins, so edits during a retry
cannot change the contents of an email with an existing request key.

Raw HTTP requests now use
[`scheduled_at`](https://resend.com/docs/dashboard/emails/schedule-email), with
the existing defaults of two hours, one day and seven days. The former optional,
untracked audience/event side effect is removed from this transactional workflow;
the explicit queued emails handle onboarding. Newsletter consent and subscription
flows retain their separate behavior.

## Homepage editing

Homepage now has a **Main hero** group for the top heading, accent,
supporting copy, founder note, image, caption and credit. Existing eyebrow,
metadata and both CTA controls drive the top hero. Empty image selection keeps
the current cinematic image and its qualifications.

The existing headline, service words and supporting text are clearly labelled
as introduction fields. Promotion rows control the main service cards' order,
heading, body, badge and CTA. Removing a CTA label removes the promotional
image, title and CTA links; the artwork's source-credit links remain.
Clearing promotion rows falls back to the Services collection. The current
seven artwork families remain attached to their corresponding service types.

## Migration and release

Registered additive migration:
`cms/src/migrations/20260920_220000_cms_wiring_and_onboarding.ts`.
It includes the client history columns, unique document key, job concurrency
column/task enums and hero fields. The generated schema snapshot and Payload
types are updated. Rollback keeps the added columns and delivery evidence.

Release the CMS and frontend together, with Won transitions paused during the
rollout. The CMS container runs migrations before starting the app. Prefer CMS
first: a queued step sent to an older frontend fails visibly and is retryable.
Then release the frontend and verify `/api/client-won/` reports version 2 before
retrying those clients. An old CMS sending its legacy event to the new frontend
receives 409, so do not leave that combination serving new Won transitions.

Required configuration: the same `CMS_WEBHOOK_SECRET` on both apps;
`ASTRO_SITE_URL` in CMS; `PUBLIC_PAYLOAD_URL`, `PAYLOAD_API_KEY` and
`RESEND_API_KEY` on the frontend. Normal CMS database/storage credentials remain
required. `RESEND_WEBHOOK_SECRET` is needed for live delivery webhook recording.
Production configuration and deployment parity were checked on 21 September;
see the release report for the checks and the limits on reading sensitive values.

Existing Won clients are not retroactively emailed. Review them individually;
only use the retry control after checking whether the old workflow already sent
their onboarding. Records with no new delivery ledger cannot prove what the old
workflow did.

After release, run a controlled enquiry and onboarding with explicitly approved
test recipients, then verify the CRM record, retained attachments, scheduled
messages and inbox outcomes. No live records, emails or subscribers were changed
while implementing or testing these fixes.

## Verification

Isolated regression tests cover unauthorized updates, token binding/expiry,
capture, upstream failures and retry, Won conversion, queue transaction scope,
checkpoint protection, partial email failure, stable retry keys, expired-key
reconciliation, duplicate documents, filing failures and legacy protocol refusal.

The read-only CMS fixture and browser checks in `docs/qa/cms-wiring-*` verify
actual edited content and CTA destinations at desktop and phone sizes. The
fixture makes no external requests and rejects writes.

- 34 Node regression tests passed.
- 25 browser assertions passed at 1440, 390 and 320px, with no runtime errors.
- CMS TypeScript check and production build passed. The first sandboxed build
  stalled; the same build outside the sandbox completed with jobs disabled.
- All ten repository checks passed, including read-only CMS pricing/content
  checks and registration of all 58 migrations.

The frontend build result and final handoff checks are recorded in `HANDOFF.md`.
