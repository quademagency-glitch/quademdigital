# CMS (Payload): working rules

## Schema changes require a migration in the same commit

Production uses Postgres (`DATABASE_URL`, Railway). Schema `push` is only
active in development, Payload silently disables it outside dev mode, so
editing a collection or global's `fields` array does nothing to the live
database on its own.

**Any time you add, remove, or rename a field on a collection (`src/collections/*.ts`)
or global (`src/globals/*.ts`), you must write a matching migration in
`src/migrations/` and register it in `src/migrations/index.ts`, in the same
commit as the field change.** Skipping this is exactly what broke the
Services admin pages and four page globals on 2026-06-25: the field
existed in code, the column didn't exist in Postgres, every read 500'd.

`payload migrate:create` (via `pnpm migrate:create <name>`) is the normal
way to generate one, and it now works again. The drizzle snapshot drift was
reconciled on 2026-08-01: only 2 of the 13 migrations had ever written a
`.json` snapshot, so the "latest snapshot" was frozen at 2026-06-22 while 11
later migrations (Brand Studio, onboarding_documents, the portfolio galleries)
added tables the snapshot never recorded. Diffing current code against that
stale picture is what produced the confusing "is this a rename?" prompts. The
fix is a single rebaselined snapshot,
`src/migrations/20260801_000000_rebaseline_snapshot.json` (142 tables, the full
current schema), which is the newest `.json` and so becomes the baseline every
future `migrate:create` diffs against. It is snapshot-only (no `.ts`, not in
`index.ts`) because it represents already-applied state: there is nothing to
apply.

Two gotchas when running the generator:
- **Always read the generated `.ts` before applying it.** A migration only
  refreshes the baseline if it writes a `.json` snapshot, and the hand-written
  ones don't, so the drift the rebaseline fixed re-accumulates. On 2026-08-15
  the generator re-emitted every statement from the four migrations since
  20260801 (invoice payment fields, invoice deposits, lead source values, blog
  author defaults) alongside the one new table. Applying that as-is would have
  errored on already-applied objects. Keep only the statements for your change,
  wrap them in the `IF NOT EXISTS` / `EXCEPTION WHEN duplicate_object` pattern,
  and keep the generated `.json`: it does record the full current schema, so
  the *next* `migrate:create` diffs against reality.
- **`brand_studio_page*` is out of the snapshot as of 2026-08-22, and that is
  deliberate.** `BrandStudioPage` was removed from the globals array on
  2026-08-15 when that page was folded into the AI Video & Reels service page,
  but its six tables were left in Postgres (destructive drops are deferred here
  by policy, same as the legacy columns below). While the snapshot still
  recorded them, every `migrate:create` diffed code against them, emitted DROPs
  that had to be trimmed by hand, and, worse, **prompted interactively**: with
  tables both appearing and disappearing in the same diff, drizzle-kit asks
  "is this a rename?" for each one and blocks forever in a non-interactive
  shell. That is why the SEO migration had to be hand-written.
  `20260822_232854_add_crm_versions_and_jobs_queue.json` was generated with
  those six stripped from the baseline first, so it does not carry them and
  neither will anything generated after it. The generator now runs unattended.
  The cost: the six tables still exist in production and no snapshot knows,
  so if `BrandStudioPage` is ever restored the generated `CREATE TABLE`s will
  collide with what is already there. Add `IF NOT EXISTS` if that day comes.
- **The generator will register `._` sidecars as migrations.** It globs the
  directory after writing, and macOS recreates the AppleDouble file for the
  file it just wrote, so `index.ts` gains a bogus
  `import … from './._2026…'` entry. Delete the `._*` files and strip that
  entry before committing.
- **Always run with `NODE_ENV=production`** (the `migrate:create` script already
  does). The config picks `sqliteAdapter` otherwise (dev default), which emits a
  version-6 SQLite snapshot that mismatches the committed version-7 Postgres
  snapshots and makes *every* table look changed.
- If a future schema change ever needs hand-writing anyway, copy the pattern in
  `src/migrations/20260622_020000_add_missing_service_detail_tables.ts` or
  `20260625_010000_add_featured_image_and_portfolio_galleries.ts`: plain
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`
  statements, wrapped in `DO $$ ... EXCEPTION WHEN duplicate_object THEN
  null; END $$` for constraints so it's safe to re-run. If you hand-write, also
  regenerate the snapshot afterward so the baseline stays truthful.

Whether the in-code schema matches the *production* DB (separate from snapshot
drift) is checkable read-only with `scripts/compare-prod-schema.mjs`: see the
`pnpm migrate` section below for what the from-scratch replay uncovered.

## A migration is half the job. The CMS app has to be deployed too.

`pnpm migrate` run from a laptop talks to the production database. It adds the
column and nothing else. The Payload app on Railway is a separate deploy, and
until it is running the code that declares the field, **it does not know the
field exists**: it strips it from incoming writes and omits it from responses,
with no error anywhere.

That bit on 2026-08-29. The order run was: migrate, then the seed scripts, then
the site deploy. `pricing_plans.market` existed in Postgres and the seed wrote
`market: 'international'` to three plans. Payload dropped it. Every other field
in the same request landed, because those fields already existed, so the script
reported six successful writes and the data was wrong in exactly one column.
The column's `DEFAULT 'ghana'` then made all six plans Ghana plans, and the
homepage rendered both markets in one grid, a website at $3,000 beside the same
work at $425.

**Deploy the CMS before running anything that writes a new field.** The tell is
cheap to check and worth doing every time:

```
curl -s "$PUBLIC_PAYLOAD_URL/api/<collection>?limit=1" | jq '.docs[0] | keys'
```

If the new field is not in that list, the app has not caught up and any script
writing it will fail silently. A `where[<field>][equals]=...` filter that
returns every row rather than a subset is the same signal.

The recovery is nothing worse than re-running the seed once the app is up,
provided the scripts are idempotent. Keep them that way.

## `pnpm migrate`: fixed 2026-08-01 (was two separate bugs)

`pnpm migrate` now works. The old `db.execute is not a function` note was a
stale symptom; reproducing the CLI on a throwaway Postgres surfaced the real
causes:

1. **AppleDouble junk crashed the loader.** `payload migrate` globs the
   migrations dir and imports every `*.ts`; the `._*.ts` sidecar files this
   drive scatters are binary, so esbuild aborts with `Unexpected "\x00"` before
   any SQL runs. The `migrate` / `migrate:create` npm scripts now `find
   src/migrations -name '._*' -delete` first, so this can't recur.
2. **The chain wasn't replayable from scratch.** Migration `20260623` copied a
   legacy `services_page.subtitle`/`projects_page.subtitle` column that only
   existed in production; a fresh DB never has it, so replay died there. That
   copy is now guarded with an `information_schema` existence check (no-op on
   prod, which already applied it).

Both npm scripts also now set `NODE_ENV=production` so the CLI targets Postgres,
never the SQLite dev DB. Verified: from an empty Postgres, all migrations replay
to the exact code schema.

A from-scratch replay also revealed **schema/migration drift**: objects the
code defines that no migration ever created: the `onboarding_documents` table +
enum + its rels column, the whole `clients` CRM column set (+ 3 enums), and the
redesigned `contact_page` fields. These are backfilled idempotently by
`20260731_000000_add_onboarding_documents` and
`20260731_120000_backfill_clients_contact_page_columns` (safe no-ops where the
objects already exist). Still deferred: dropping the now-unused legacy columns
(`contact_page.title/description/heading/subheading`, `_pages_v.autosave`,
`_blog_posts_v.autosave`): destructive, so left until confirmed unused in prod.

To check any database against the code schema (read-only, names only, no data):
`PROD_DATABASE_URL=… node scripts/compare-prod-schema.mjs`. It reads the newest
`.json` in `src/migrations`, the same baseline the generator uses, and prints
which one. It used to be pinned to the 2026-08-01 rebaseline and had drifted
four migrations behind by 2026-08-22, reporting live tables as "extra in prod"
when the code had in fact asked for them.

## Scheduled publishing depends on three separate things

Blog Posts and Pages have `versions.drafts.schedulePublish`, which puts a date
picker beside the Publish button. Choosing a date does not publish anything: it
queues a job in `payload_jobs` with `waitUntil` set. Two other pieces make that
job actually run, and removing either leaves the feature silently broken, with
the post staying a draft and no error anywhere.

1. `jobs.autoRun` in `payload.config.ts`, an in-process cron every five minutes.
   It is safe here because Railway runs one long-lived Node process. It would
   not be on the site, which is serverless.
2. `src/instrumentation.ts`, which calls `getPayload({ cron: true })` at boot.
   Payload only creates the cron when something initialises it that way, and of
   the routes Payload ships only the admin panel does. Without this file the
   queue starts on the first admin page load after a deploy, so anything
   scheduled for a day nobody opens the CMS just waits.

To check it is alive: `select * from payload_jobs` on production shows queued
jobs and their `wait_until`. Completed jobs are deleted, which is Payload's
default.

To apply a migration to production directly, connect with `railway run` (or a
direct `DATABASE_PUBLIC_URL`) and either run `pnpm migrate` or execute the SQL
via the `pg` client, then record the migration name + next batch in
`payload_migrations`.

## Redirects live in the CMS, and must not be added anywhere else

The `redirects` collection is the only place a redirect belongs. `src/middleware.ts`
on the site reads it through `src/lib/redirects.ts` and answers before the page
renders, so a redirect added in the admin is live within about a minute with no
deploy. `src/pages/sitemap.xml.ts` derives its exclusions from the same list, so
a redirected address never gets advertised for indexing.

**Do not put a redirect back into `vercel.json` or `astro.config.mjs`.** Both ran
in production before 2026-08-24 (the astro.config comment claiming it was only
for `astro dev` was wrong: the Vercel adapter emits those rules as real 301s),
and both are evaluated at the edge *before* the function. A rule in either place
therefore wins over the CMS, and editing that redirect in the admin would appear
to save and then change nothing. Only the www to apex rule stays in
`vercel.json`, because it is infrastructure and has to survive everything
downstream of it being broken.

Two things learned while moving them:

- **`"trailingSlash": true` in `vercel.json` is applied before the redirects
  array.** Nine of the nineteen entries were slash-less duplicates of the other
  ten and could never be reached: `/case-study-1` was already 308'd to
  `/case-study-1/` before the redirect list was consulted. Verified live before
  deleting them. So the CMS stores one entry per redirect and matches ignoring
  the trailing slash.
- **`src/lib/redirects.ts` holds a frozen copy of the rules as they stood on
  2026-08-24.** It is not a second source of truth and must not be edited to add
  a redirect. It is used only when the CMS read fails outright, so a CMS restart
  cannot turn a set of indexed 301s into 404s. A successful but empty read means
  "no redirects" and is honoured.

The site guards against the two ways a redirect can break a page, so neither
needs guarding again elsewhere: a rule whose old address is a real page is
ignored (the CMS cannot see the site's routes, so that check lives in
`resolveRedirect`), and a chain that loops serves the page instead of handing
the browser a bounce.

## `payload.update` reapplies field defaults, so background writes clobber

`payload.update` rebuilds the whole document and reapplies every field's
`defaultValue` for anything the incoming `data` does not name. That is fine for
an ordinary edit and quietly destructive for a write that happens on its own,
away from the request that triggered it.

It bit the video pipeline on 2026-08-22. Setting a video to "plays with sound"
reverted to "background loop" the instant transcoding started: the async
status write named only `videoStatus`, so `videoUsage` went back to its
default. The transcode itself was correct, because the setting is read before
any of it, so the file kept its audio while the doc claimed it had none, and
the page would have rendered a showreel as a silent loop with no controls.
`kind` had the same exposure. Nothing about it was visible from a passing
build; it took uploading a real video to production to see it.

**For any write that is not part of the request that triggered it, use
`payload.db.updateOne({ collection, id, data, returning: false })`.** It writes
the named columns and touches nothing else, and it fires no collection hooks,
so it cannot recurse into whatever scheduled it.

**"Part of the request" is easy to get wrong, and it bit again on 2026-08-25.**
The Resend webhook PATCHed `subscribers` over REST, which looks like an ordinary
request rather than a background write. It is not: the request it belongs to is
Resend's, not the subscriber's, and Resend sends several events for one message
that arrive at the same instant. Two of them raced. Each read the row, merged
its own change and wrote the row back, so an `email.sent` event carrying a copy
of the row from before both a confirmation and a hard bounce put the subscriber
back to `pending` with no confirmation date, 37 milliseconds later. Nothing
errored and the API reported success to both. Left alone that loses consent
records at random under load.

The rule is therefore about **who else might be writing at the same time**, not
about whether there is an HTTP request in the picture. Anything driven by an
external system, a webhook, a cron or a queue goes through `db.updateOne`. The
`subscribers` `/delivery-event` endpoint exists only to give the site a way to
do that.

Two things made it findable, and both are worth keeping. Versions were on, so
the five writes and their order were visible after the fact; without them there
was nothing to look at. And the test asserted on the stored row rather than on
the page saying "You are in", which is what the confirm page said while the
database disagreed.

Same trace, second bug: a `beforeValidate` hook that filled in a missing value
regenerated it on **every** update, because a PATCH does not name every field.
That silently invalidated every unsubscribe link already sitting in an inbox.
Guard a generate-if-missing hook with `operation === 'create'`.

## Client paperwork and pictures live in different buckets

`media` goes to `S3_BUCKET` (`quadem-cms-media-prod`), whose policy lets the
world read any object. That is correct for pictures and is exactly what a CDN
in front of it will need. `onboarding-documents` goes to
`S3_DOCUMENTS_BUCKET` (`quadem-client-documents-prod`), created 2026-08-25
with all four public access blocks on and no bucket policy at all.

They were one bucket until then, and that was the hole. The `read` access on
`OnboardingDocuments` correctly refuses an SLA to a stranger, but the S3 object
URL handed the same bytes to anyone holding the link, so the access control was
guarding a door with the back one standing open. Nothing was ever exposed:
there were zero documents, and all 955 objects in the pictures bucket were
`.webp`, `.avif` or `.svg`.

**Before pointing a new upload collection at a bucket, ask what goes in it.**
Anything a client sends belongs in the documents bucket, not the pictures one.

With `S3_DOCUMENTS_BUCKET` unset the documents collection falls back to the
container's disk and loses uploads on the next deploy. That is chosen on
purpose: a loud, recoverable failure beats a quiet fall back into a public
bucket.

One related fix landed with it. `generateEmailDraft` now takes the upload's own
buffer instead of fetching `doc.url`. That fetch asked Payload's file route for
a document whose read access requires a login, from a background call carrying
no session, so it could only ever return 403. It had never been seen to fail
because no document has ever been uploaded.

## The mailing list is here, and the audience id is not configurable

`subscribers` is the system of record for who has asked to hear from Quadem.
Resend is the transport and nothing more. Where the two disagree, this wins.

Everything that adds a person goes through `recordSubscriber` in the site repo
(`src/lib/subscribers.ts`), which holds two rules that were previously nowhere:

- **Nobody is moved out of unsubscribed, bounced or complained by filling in a
  form.** That is how a sending domain gets blocklisted.
- **`consentAt` is only written by a caller that actually got consent.** The
  contact and offer forms have no opt-in tick box, so enquirers are recorded as
  `pending` with no consent date. A campaign only ever goes to `subscribed`.

**`NEWSLETTER_AUDIENCE_ID` is a constant on purpose. Do not put it back in the
environment.** `RESEND_AUDIENCE_ID` is set to
`5e4d5e4d-5e4d-5e4d-5e4d-5e4d5e4d5e4d`, a placeholder that is not a real
audience, and **Resend answers 200 with an empty list for an audience id that
does not exist**, rather than 404. That made the Monday report state
"Newsletter contacts: 0" every week with complete confidence while five people
sat on the real list, and sent every won client into an audience that is not
there. There is one audience on the account, "General".

Three things about the site half, all found the hard way on 2026-08-25:

- **Register a webhook with the trailing slash.** `vercel.json` sets
  `trailingSlash: true`, so `/api/resend-webhook` answers 308 and a sender that
  does not follow redirects never reaches the handler.
- **A new Vercel environment variable needs a redeploy, not just saving.** Astro
  inlines `import.meta.env` at build time, so the running build cannot see a
  variable added after it. Proved by the endpoint answering 503 until a
  `vercel redeploy`.
- **Astro's CSRF check rejects a form-encoded POST with no `Origin` header,**
  with a 403 raised before the route runs. JSON POSTs are exempt, which is why
  the Paystack and Resend webhooks are unaffected and why a `curl -d` test of a
  form route looks broken when it is not.

## Campaign statistics are counted, never incremented

`campaignEvents` holds one row per delivery event, and the `stats` group on
`emailCampaigns` is recalculated from it by a single `UPDATE ... FROM (SELECT
...)`. Do not replace that with "read the total, add one, write it back".
Resend sends several events for one message at the same instant and a
read-modify-write loses some of them; that is the same race that put a
subscriber back to pending on 2026-08-25.

Three things that are easy to get wrong here:

- **Count `DISTINCT email`, not rows.** Resend fires an open every time the
  tracking pixel loads, so one person reopening a message four times is four
  events and one opener. Counting rows reports thirty opens from a list of
  five.
- **Payload rejects a duplicate `unique` value itself, before Postgres sees
  it,** and throws a validation error rather than a `23505` duplicate-key
  error. Code that catches only the Postgres shape will answer 500 to a
  retried webhook, and Resend will retry it until it gives up. Look the id up
  first; keep the catch for the race.
- **`campaign_events.campaign_id` is `NOT NULL` with `ON DELETE cascade`, and
  the generator wants to change it to `ON DELETE set null`. Do not let it.**
  Setting a NOT NULL column to null is impossible, so deleting a campaign
  would fail outright.

A campaign send tags every message with `campaign_id`, and Resend echoes tags
on every delivery webhook. That tag is the only thread back from an event to
the campaign, so a send that does not carry it produces statistics that stay
empty for ever. A test send carries the same tag deliberately, and a real send
clears the log first, because a campaign only goes out once and anything in
there beforehand is a test.

## Onboarding documents record where they came from

`onboarding-documents` drafts a covering email with Gemini whenever a document
is created. That is right for one Ernest uploads by hand and wrong for the
three the client-won automation writes, which already have an email composed
and scheduled. `origin: 'automation'` is what switches the draft off. Anything
that files a document from code must set it, or every won client fires three
pointless AI calls.

Uploading to Payload from a server route is `multipart/form-data`: a `file`
part built as a `Blob` with its mime type, and a `_payload` part holding the
JSON. Do not set `Content-Type` by hand, because that drops the boundary and
the upload is rejected as malformed.

## Two sessions in one tree: read HEAD, not the working copy

On 2026-08-25 two agents worked this repo at once. Nothing was lost, but three
things went wrong and all three have the same shape.

**A shared file's working copy is not what production runs.** `BaseLayout.astro`
had an uncommitted `noindex` prop from the other session. Passing that prop
typechecked, deployed and did nothing, because the committed layout has no such
prop and Astro ignores unknown ones. It would have been reported as fixed.
**Before relying on anything in a file that `git status` lists as modified or
untracked, read `git show HEAD:<path>`.** That is the only honest view of what is
deployed. The same applies to a new component: `SiteHead.astro` existed in the
tree and in no commit.

**`migrate:create` diffs the whole in-code schema.** With another session's
collection changes sitting uncommitted, a generated migration and its snapshot
bake in half-finished work from somebody else. Hand-write a small migration
instead, or wait. `20260825_120000_add_campaign_send_record` is hand-written for
exactly this reason and says so.

**`src/migrations/index.ts` is shared and the generator rewrites it.** Committing
it wholesale takes the other session's entries with it, and referencing a
migration file they have not committed breaks the build. The pattern used here:
save the working copy, commit a version carrying only your own entries, then put
the saved copy back. The other session's generator runs also left
`._`-prefixed AppleDouble imports in it twice, which would have failed the CMS
build; those are junk and safe to strip on sight.

## Video uploads need ffmpeg in the image

`src/lib/videoPipeline.ts` shells out to `ffmpeg` and `ffprobe` to transcode
uploaded video. The Dockerfile installs them (`apk add --no-cache ffmpeg`).
Without them the pipeline records `videoStatus: failed` with a readable reason
rather than crashing, so a container built without that line degrades quietly:
video gets stored and served exactly as it came off a camera, which is
routinely ten times the bytes a browser needs.

Transcoding runs **after** the upload is saved, never during it, and one at a
time process-wide. Both are deliberate and both are load-bearing on an instance
this small. See the comments in that file, and `docs/media-optimization.md` in
the site repo for the whole picture.

Encoding settings for pictures and video both live in `src/lib/mediaPresets.ts`.
Two scripts in the site repo copy those constants because they cannot import
across packages (`scripts/image-weight.mjs`, `scripts/optimize-video.mjs`);
change them together.

## After any schema/data change touching production

Run `pnpm smoke-test` (see `scripts/smoke-test.mjs`) against
`https://cms.quademdigital.com` to confirm the API isn't 500ing before
calling the work done.

## Junk files on this drive

The project lives on an external drive whose filesystem causes macOS to
scatter `._*` AppleDouble files everywhere (one per real file). They are
not tracked in git and are safe to delete, `find . -name '._*' -delete`, 
but they will trip up tools that glob directories naively (this broke
`payload migrate`'s migration loader once already).
