# CMS workspace release — 5 October 2026

This release integrates the approved CMS redesign with main `6b90c726`,
including all current signing, hiring, projects, messaging, training and team
workflows. The user approved completing integration and production deployment.
The production CMS address is https://cms.quademdigital.com/admin.

The interface has a redesigned sign-in page and dashboard, searchable grouped
navigation, distinct light and dark themes, clearer tables and status labels,
and consistent record editors. Blog posts, campaigns, homepage and site
settings have organised tabs. Native permissions, validation and save controls
remain in place. Campaign and signing actions require saved content, retain
error feedback, and distinguish provider acceptance from delivery.

Newer team collections appear in Team; quote requests appear in Sales. The
signing review recognises direct signer ownership from the newer PDF editor.
The editor itself, signing backend, team workflows and 81 registered migrations
are preserved. No new migration or production setting change is required.

## Verification before release

- Production build and TypeScript passed.
- 130 CMS regression tests and 31 billing/onboarding tests passed. The existing
  proposal test fixture was updated for the access and audit-field imports in
  the current Clients collection.
- 187 browser checks passed: all 60 visible application lists, five intentionally
  hidden collections, 11 settings globals, real sample draft/client saves,
  password reveal, native phone login, editor denial of CRM and finance,
  desktop/mobile layouts, dark mode and native navigation.
- The newer PDF editor rendered all three sample pages, saved a sender text
  place through its existing endpoint, and removed that sample place without
  changing the originals. Six newer team forms passed at 1440px and 390px.
- Compared 83 configured entities and 2,029 stored field definitions against
  current main. Stored definitions, access, hooks and version settings match.
- Read-only production checks found all 81 registered migrations applied and
  no missing schema objects against the latest snapshot.
- The release source matches the tested preview. Only the isolated review
  configuration disables background jobs; production scheduling is retained.

Local browser checks used a separate Postgres database and synthetic records.
Provider credentials were removed. No campaign, signing email, payment or
client onboarding was submitted to production during verification.

The website API key has the `site` role and intentionally cannot open admin
pages. Production verification must use its permitted API reads and public
login checks unless an authenticated administrator session is available;
local authenticated admin tests are not claimed as live admin acceptance.

Sanitized pre-release evidence: `docs/qa/cms-ui-release-2026-10-05.json`.
The previous running Railway deployment was
`50b05a27-2976-4b0a-b2f4-efdbce5b76fc`, commit `6b90c726`, for rollback reference.
