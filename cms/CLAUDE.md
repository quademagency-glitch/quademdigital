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
