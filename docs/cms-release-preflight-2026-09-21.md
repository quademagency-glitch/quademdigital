# CMS production release, 21 September 2026

The user approved “Deploy production.” The CMS and frontend are now deployed,
all three pending migrations have applied, and the live verification passed.
No test email has been sent; the test-recipient question remains unanswered.

Production: https://quademdigital.com · CMS: https://cms.quademdigital.com

- Railway CMS deployment: `b154c5f6-98f7-46df-aa26-aa19aa0b4c30`, `SUCCESS`.
- Vercel frontend deployment: `dpl_4Bj2rq1fZjgVRd9aMhKwhmr44tDZ`, `READY`,
  assigned to `quademdigital.com`.
- Frontend deployment URL:
  https://quademdigital-2a29etq9o-quademagency-glitchs-projects.vercel.app

## Release verification

The CMS deployed first. Its startup logs confirm all three migrations ran in
batch 52. A read-only database check found zero pending migrations and zero
missing columns against the latest schema snapshot. The new document/job/hero
indexes and onboarding task enums exist. The jobs queue was empty.

All 34 CMS smoke checks passed. Five additional authenticated reads passed:
homepage, clients, client versions, onboarding documents and jobs. The running
CMS returns all seven main-hero fields and all three client onboarding fields.

The frontend then deployed with production configuration. Vercel reports READY
and the production domain alias. Live reads of the homepage, contact, services,
projects, about and global pages all returned 200. The homepage contains its
CMS-controlled heading. `/api/client-won/` returns version 2. An invalid event
with the shared key returns 409, proving authentication without sending mail;
an unsigned lead-enrichment request returns 403 before any write. No enquiry,
client, subscriber, document or message was created by these probes.

The first Railway upload failed before deployment because the CLI could not
resolve the relative path prefix. Repeating it with the absolute CMS path
succeeded. Vercel's direct management API later returned 403; the authenticated
CLI successfully confirmed the deployment status and live domain assignment.

Post-deployment evidence:
[production release JSON](qa/cms-production-release-2026-09-21.json).
The preflight evidence below remains a record of the state before deployment.

Preview: https://quademdigital-n22qkp3m7-quademagency-glitchs-projects.vercel.app

Sanitized evidence: [production preflight JSON](qa/cms-production-preflight-2026-09-21.json).
Implementation details: [CMS wiring fixes](cms-wiring-fixes-2026-09-20.md).

## Production configuration

- Vercel's existing `quademdigital` project has all required variable names:
  `PUBLIC_PAYLOAD_URL`, `PAYLOAD_API_KEY`, `RESEND_API_KEY`,
  `CMS_WEBHOOK_SECRET`, `RESEND_WEBHOOK_SECRET` and `CRON_SECRET`.
- Most Vercel values are marked sensitive and cannot be read back. Their
  presence was verified; unseen values were not assumed to match local values.
- The readable production Resend key was checked directly against Resend. It
  matches the local key and both `quademdigital.com` and `go.quademdigital.com`
  are verified sending domains. No message was submitted.
- Railway's saved `ASTRO_SITE_URL` incorrectly pointed at
  `http://localhost:4321`. It now points at `https://quademdigital.com`.
  `--skip-deploys` was used, and the active deployment ID remained unchanged.
  The successful CMS deployment now includes this correction.
- Railway's shared callback key matches the local key and exceeds the signing
  minimum. An invalid event sent to the live frontend authenticated and received
  the expected HTTP 400 before all email/document work. This verifies the shared
  key without sending a message or creating a record.
- Railway's production service uses root directory `/cms`, with no start-command
  override. Its Dockerfile starts with migrations followed by the server.
  Railway [automatically detects Dockerfiles](https://docs.railway.com/builds/dockerfiles)
  in the source root even when the default builder setting is Railpack.

## Migration scope

Before deployment, a read-only transaction confirmed exactly these pending
migrations, in this order. All three are now applied:

1. `20260912_143000_add_homepage_hero_eyebrow_and_meta`
2. `20260912_170000_add_media_thumbnail_avif`
3. `20260920_220000_cms_wiring_and_onboarding`

The preflight schema lacked 23 columns covered by these migrations. The jobs
queue was empty at inspection. The newest migration also creates the AVIF
filename index that the schema snapshot expects but the earlier column-only
migration omitted. The changes add columns, indexes and enum values; they do not
delete client data or send messages. All three ran at container startup.

All 58 registered migration imports resolve. Both application production builds
passed in the preceding implementation pass. The remote preview, production
frontend build and production CMS Docker build also passed. Docker remains
unavailable locally.

## Deployment inputs

The Vercel upload was inspected with `vercel deploy --dry --json`: 488 entries,
10,671,523 bytes before upload deduplication. Local credentials, assistant
settings, QA reports, output artwork, dependency folders and CMS build output
are excluded. The example environment file contains documentation, not runtime
credentials. CMS source stays included because the frontend prebuild compares
its market and lead-field contracts.

The CMS now also has a `.dockerignore` excluding local credentials, dependencies,
build outputs, SQLite files, private media and AppleDouble sidecar files.

The preview lacks email/webhook configuration intentionally: no production email
secrets were copied into it. It is a frontend review artifact, not proof of the
complete production onboarding path. Build status was checked using Vercel's
management API; no forms were submitted through the preview.

## Rollout procedure and remaining delivery test

Steps 1–4 are complete. No jobs were pending in the post-migration check, so no
retry was needed. Step 6 remains pending an explicitly approved test recipient.

1. Avoid marking clients Won during the coordinated rollout.
2. Upload the reviewed CMS source to its existing Railway production service.
   The container runs all three pending migrations before the new server starts.
3. Confirm successful deployment, run the 34-route CMS smoke test, and repeat the
   read-only schema and migration-ledger check. Confirm the new fields are
   returned by authenticated CMS reads.
4. Release the frontend to the existing Vercel production project. Verify the
   production deployment is ready and `/api/client-won/` identifies version 2.
5. Retry any onboarding steps that failed while the two versions differed.
   Do not trigger historical Won clients without checking their prior sends.
6. Use the explicitly approved test inbox for one labelled enquiry. Check the
   initial lead, signed-token enrichment and final stored details. Use that test
   lead's Won conversion, fill its agreed test scope/price/start date, and verify
   the new client's queue state, three retained documents, per-step provider IDs,
   immediate delivery and the future scheduling times. Leave marketing consent
   unticked and do not use a real customer's record.

The live test sends real messages and needs an approved recipient. The user has
been asked which inbox may receive them; no address has yet been authorized.
Scheduled acceptance is not the same as later inbox delivery, so those outcomes
must be reported separately.
