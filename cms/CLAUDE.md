# CMS (Payload) — working rules

## Schema changes require a migration in the same commit

Production uses Postgres (`DATABASE_URL`, Railway). Schema `push` is only
active in development — Payload silently disables it outside dev mode — so
editing a collection or global's `fields` array does nothing to the live
database on its own.

**Any time you add, remove, or rename a field on a collection (`src/collections/*.ts`)
or global (`src/globals/*.ts`), you must write a matching migration in
`src/migrations/` and register it in `src/migrations/index.ts`, in the same
commit as the field change.** Skipping this is exactly what broke the
Services admin pages and four page globals on 2026-06-25 — the field
existed in code, the column didn't exist in Postgres, every read 500'd.

`payload migrate:create` (via `pnpm migrate:create <name>`) is the normal
way to generate one, but the drizzle-kit snapshot tracking here has drifted
from a few earlier hand-written SQL migrations, so the generator currently
asks confusing "is this a rename?" questions about unrelated tables. Until
that's reconciled, write the migration by hand: copy the pattern in
`src/migrations/20260622_020000_add_missing_service_detail_tables.ts` or
`20260625_010000_add_featured_image_and_portfolio_galleries.ts` — plain
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`
statements, wrapped in `DO $$ ... EXCEPTION WHEN duplicate_object THEN
null; END $$` for constraints so it's safe to re-run.

To apply a migration to production directly (when `pnpm migrate` itself
errors — see below), connect with `railway run` and execute the SQL via the
`pg` client already in `node_modules`, then insert a row into
`payload_migrations` recording the migration name and next batch number.

## `pnpm migrate` may not work as-is

The full `payload migrate` CLI currently throws `db.execute is not a
function` when it tries to re-verify the baseline migration, even though
that migration is already correctly recorded in `payload_migrations`. This
needs root-causing separately — don't assume `pnpm migrate` succeeding or
failing tells you anything about whether your migration's SQL is correct.

## After any schema/data change touching production

Run `pnpm smoke-test` (see `scripts/smoke-test.mjs`) against
`https://cms.quademdigital.com` to confirm the API isn't 500ing before
calling the work done.

## Junk files on this drive

The project lives on an external drive whose filesystem causes macOS to
scatter `._*` AppleDouble files everywhere (one per real file). They are
not tracked in git and are safe to delete — `find . -name '._*' -delete` —
but they will trip up tools that glob directories naively (this broke
`payload migrate`'s migration loader once already).
