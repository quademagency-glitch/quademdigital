# CMS wiring audit, 20 September 2026

**Follow-up:** the user requested repairs. The original findings below describe
the pre-fix state. See [the fixes and release notes](cms-wiring-fixes-2026-09-20.md)
for the local implementation and validation. Production rollout remains separate.

Decision: the CMS is connected and serving content, but the combined website and
CRM should not receive an unconditional production sign-off. Fix the lead update
authorization and false-success paths first. Align the Won workflow and CMS
editing controls with the intended operator experience.

This qualifies the earlier frontend release assessment. The build, guards and
browser checks passed; those checks did not prove backend write authorization or
delivery failure handling.

## Confirmed findings

### 1. Public lead enrichment can use the server's authority without ownership proof

Priority: high. `src/pages/api/submit-form.ts:184` accepts a caller-supplied
`leadId`, builds a patch and sends it to Payload with `PAYLOAD_API_KEY`. That
branch executes before name/email validation and verifies no lead-specific
token or session. CMS update access requires a user, but this proxy supplies its
own authenticated API key.

An isolated invocation of the actual transpiled handler, with network calls
stubbed, submitted only a lead ID and message. It issued the authenticated PATCH
and returned success. No real lead was targeted. This establishes a code-level
authorization flaw, not evidence that anyone has exploited it.

Repair: issue a signed, expiring token when the initial lead is created, bind it
to that lead, and require it for enrichment. Preserve the wizard's retry and
deduplication behavior.

### 2. Failed final enquiry details are reported as saved

Priority: high. `src/pages/api/submit-form.ts:205` alerts when the CMS rejects
the enrichment patch, but line 235 still returns HTTP 200 and `success: true`.
An initial name/email record can survive while the final message, service
choices, budget and qualifier answers are lost. The browser then resets the form.

Isolated probe: a simulated CMS HTTP 500 produced one alert, then HTTP 200 with
`success: true` to the caller. This is a backend gap that the frontend retry
tests do not catch, because their mocked backend correctly reports failures.

Repair: return an actionable failure for an unsuccessful patch; keep the
existing lead ID and entered details so retry updates the same lead.

### 3. Marking a lead Won does not trigger the client Won automation

Priority: medium. `cms/src/hooks/convertWonLeadToClient.ts:31` creates a client
with `projectStatus: 'onboarding'`, but omits `pipelineStatus`. The client
schema defaults that field to `lead` (`Clients.ts:164`); the welcome/document
automation only runs for `pipelineStatus === 'won'` (`Clients.ts:33`).

The isolated hook probe confirmed that no Won pipeline value is supplied.
Consequently, this path creates a client record but requires a separate Client
Won transition before welcome automation can run. Proposal provisioning does
set `pipelineStatus: 'won'`, so these entry points behave differently.

Repair: make the intended handoff explicit. If Won leads should onboard
immediately, carry the required client details and trigger the same validated
workflow. If a review step is intended, label and expose that step clearly.

### 4. Onboarding can report success when every email and document filing fails

Priority: high. `src/pages/api/client-won.ts:1343` logs failed email responses
and failed document filing, then returns HTTP 200 with `ok: true`. The CMS hook
in `cms/src/collections/Clients.ts:95` checks only `res.ok` and records a
successful trigger. It does not inspect the returned per-email `sent` flags.

Isolated probe: stubbed all five sends to HTTP 500 and all three document saves
to false. The actual handler returned HTTP 200, `ok: true`, `filed: 0`, and all
five `sent` values false. No email or document was sent or created.

Repair: persist per-step results, expose partial/failed delivery in the CMS,
and support idempotent retries. A retry must not resend steps already accepted.

### 5. The homepage is only partly controlled by the CMS

Priority: medium for editing usability. The live Homepage global still exposes
hero and promotion settings, but the current main hero copy and image are
defined in `src/pages/index.astro:49`. CMS `heroHeadline` appears in the lower
introduction; the primary CTA remains connected. The upper secondary CTA is
fixed, while its CMS counterpart renders lower down. Hero supporting copy,
eyebrow and metadata controls do not drive the corresponding upper hero content.

`src/components/home/ServiceStories.astro:17` renders static `serviceStories`
from `src/lib/serviceVisuals.ts`; CMS services feed the directory links, not
those main cards. Editing `homepage.promoSections` no longer edits that visible
card grid. Work imagery comes from the local manifest.

The visual-story report explicitly documents code-owned artwork/copy, so this
is a known design choice rather than a failed API request. It nevertheless
means the CMS cannot deliver full homepage editing as its existing controls
suggest. Either bind the new content to CMS fields or retire/relabel controls
that no longer apply.

## Checks that passed

- Live public smoke test: 34/34 routes returned acceptable responses, including
  the expected authentication refusals for private collections.
- Authenticated history reads: leads, clients, invoices, subscribers, blogPosts
  and pages all returned HTTP 200. This is useful migration coverage, not proof
  that every possible create/update/delete operation succeeds.
- Additional authenticated reads: proposals, journey templates, client journey
  steps, pitches, pitch assets, onboarding documents and the jobs queue returned
  HTTP 200.
- Live Homepage content and its saved CTAs/promotions were readable.
- Resend accepted the read-only audit credentials; both sending domains were
  verified. The website delivery webhook is enabled at the trailing-slash URL.
- Email history includes a delivered lead notification on 14 September. This
  proves a prior send, not today's complete enquiry-to-CRM-to-inbox path. The
  wider account sample also contains failed/bounced messages; this audit did
  not attribute those unrelated records to a particular CMS workflow.

## Limits and release requirements

No live content was edited, no lead/client/invoice was created, no real form was
submitted, and no email was sent. Tests of failing writes and onboarding used
isolated in-memory stubs. No deployment or source behavior change occurred.

Production environment parity between Railway and Vercel was not inspected.
Local configuration has the CMS, Resend, shared webhook and cron keys; local
Paystack and Resend webhook verification keys are absent. That does **not**
establish that either production key is missing. Scheduled publishing's code
and boot initialization exist, but the live jobs queue was empty, so actual
scheduled execution was not demonstrated.

After repairing the confirmed issues, verify one controlled enquiry all the
way into the stored CRM record and inbox, and one controlled onboarding flow
including retained documents and reported delivery outcomes. Review and
authorize the recipients before any such test sends messages.

Temporary evidence: `/tmp/quadem-cms-audit-smoke.log`,
`/tmp/quadem-cms-read-audit-results.json`,
`/tmp/quadem-cms-branch-probes.mjs`, and
`/tmp/quadem-cms-branch-probes.jsonl`.
